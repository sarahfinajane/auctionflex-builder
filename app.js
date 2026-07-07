const lotsDiv = document.getElementById("lots");
const template = document.getElementById("lotTemplate");

const photoStore = new WeakMap();

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function selectedMasterFrom() {
  const selected = document.querySelector("input[name='masterFrom']:checked");
  return selected ? selected.value : "";
}

function shortenTitle(text) {
  let lines = text.split(/\n/).map(x => x.trim()).filter(Boolean);

  let likely = lines.find(line =>
    line.length > 8 &&
    line.length < 120 &&
    !line.match(/^\$?\d+(\.\d{2})?$/) &&
    !line.toLowerCase().includes("barcode") &&
    !line.toLowerCase().includes("google") &&
    !line.toLowerCase().includes("shopping") &&
    !line.toLowerCase().includes("sponsored") &&
    !line.toLowerCase().includes("results")
  );

  let clean = likely || text;
  clean = clean.replace(/\s+/g, " ").trim();

  if (clean.length <= 50) return clean;

  clean = clean.slice(0, 50);
  clean = clean.slice(0, clean.lastIndexOf(" "));
  return clean.trim();
}

function findPrice(text) {
  const prices = text.match(/\$\s?\d{1,4}(?:,\d{3})*(?:\.\d{2})?/g);
  if (!prices || prices.length === 0) return "";
  return prices[0].replace(/\s/g, "");
}

function guessFrom(text) {
  const lower = text.toLowerCase();

  if (lower.includes("home depot") || lower.includes("homedepot")) return "Home Depot";
  if (lower.includes("target")) return "Target";
  if (lower.includes("lowe")) return "Lowe's";
  if (lower.includes("walmart")) return "Walmart";
  if (lower.includes("amazon")) return "Amazon";

  return "";
}

function buildDescription(lotEl) {
  const master = document.getElementById("masterDescription").value;
  const title = lotEl.querySelector(".title").value;
  const price = lotEl.querySelector(".price").value;
  const from = lotEl.querySelector(".from").value;

  return master
    .replaceAll("{TITLE}", title)
    .replaceAll("{PRICE}", price)
    .replaceAll("{FROM}", from);
}

function refreshDescription(lotEl) {
  if (document.getElementById("copyDescription").checked) {
    lotEl.querySelector(".description").value = buildDescription(lotEl);
  }
}

function getFiles(lotEl, key) {
  const store = photoStore.get(lotEl) || {};
  return store[key] || [];
}

function setFiles(lotEl, key, newFiles, append = true) {
  const store = photoStore.get(lotEl) || {
    stock: [],
    info: [],
    person: []
  };

  if (append) {
    store[key] = [...store[key], ...newFiles];
  } else {
    store[key] = newFiles;
  }

  photoStore.set(lotEl, store);
}

function makePreviews(lotEl, key, previewDiv) {
  previewDiv.innerHTML = "";
  const files = getFiles(lotEl, key).slice(0, 10);

  files.forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    previewDiv.appendChild(img);
  });
}

async function addFilesToSlot(lotEl, key, files) {
  const fileList = Array.from(files).filter(file => file.type.startsWith("image/"));
  if (!fileList.length) return;

  setFiles(lotEl, key, fileList, true);

  const previewSelector =
    key === "stock" ? ".stockPreview" :
    key === "info" ? ".infoPreview" :
    ".personPreview";

  makePreviews(lotEl, key, lotEl.querySelector(previewSelector));

  if (key === "info") {
    await runOCR(lotEl);
  }
}

function setupDropSlot(lotEl, slotEl, inputEl, key) {
  slotEl.addEventListener("click", () => inputEl.click());

  inputEl.addEventListener("change", async e => {
    await addFilesToSlot(lotEl, key, e.target.files);
    inputEl.value = "";
  });

  slotEl.addEventListener("dragover", e => {
    e.preventDefault();
    slotEl.classList.add("dragover");
  });

  slotEl.addEventListener("dragleave", () => {
    slotEl.classList.remove("dragover");
  });

  slotEl.addEventListener("drop", async e => {
    e.preventDefault();
    slotEl.classList.remove("dragover");
    await addFilesToSlot(lotEl, key, e.dataTransfer.files);
  });
}

function applyMasterToLot(lotEl) {
  if (document.getElementById("copySellerCode").checked) {
    lotEl.querySelector(".sellerCode").value = document.getElementById("masterSellerCode").value;
  }

  if (document.getElementById("copyStartBid").checked) {
    lotEl.querySelector(".startBid").value = document.getElementById("masterStartBid").value;
  }

  if (document.getElementById("copyFrom").checked) {
    lotEl.querySelector(".from").value = selectedMasterFrom();
  }

  refreshDescription(lotEl);
}

function applyMasterToExistingLots() {
  const lotEls = Array.from(document.querySelectorAll(".lot-card"));
  lotEls.forEach(lotEl => applyMasterToLot(lotEl));
}

function createRows() {
  lotsDiv.innerHTML = "";

  const count = Number(document.getElementById("lotCount").value || 1);

  for (let i = 0; i < count; i++) {
    const node = template.content.cloneNode(true);
    const lotEl = node.querySelector(".lot-card");

    photoStore.set(lotEl, {
      stock: [],
      info: [],
      person: []
    });

    lotEl.querySelector("h2").textContent = `Lot Line ${i + 1}`;

    [".title", ".price", ".from"].forEach(sel => {
      lotEl.querySelector(sel).addEventListener("input", () => refreshDescription(lotEl));
      lotEl.querySelector(sel).addEventListener("change", () => refreshDescription(lotEl));
    });

    setupDropSlot(
      lotEl,
      lotEl.querySelector('[data-key="stock"]'),
      lotEl.querySelector(".stockPhotos"),
      "stock"
    );

    setupDropSlot(
      lotEl,
      lotEl.querySelector('[data-key="info"]'),
      lotEl.querySelector(".infoPhotos"),
      "info"
    );

    setupDropSlot(
      lotEl,
      lotEl.querySelector('[data-key="person"]'),
      lotEl.querySelector(".personPhotos"),
      "person"
    );

    applyMasterToLot(lotEl);
    lotsDiv.appendChild(node);
  }
}

async function runOCR(lotEl) {
  const files = getFiles(lotEl, "info").slice(0, 5);
  const status = lotEl.querySelector(".status");

  if (!files.length) {
    status.textContent = "Add info/price photos in Slot 2 first.";
    return;
  }

  status.textContent = "Reading Slot 2 now...";

  let fullText = "";

  for (const file of files) {
    const result = await Tesseract.recognize(file, "eng");
    fullText += "\n" + result.data.text;
  }

  const price = findPrice(fullText);
  const from = guessFrom(fullText);
  const title = shortenTitle(fullText);

  if (title) lotEl.querySelector(".title").value = title;
  if (price) lotEl.querySelector(".price").value = price;
  if (from) lotEl.querySelector(".from").value = from;

  refreshDescription(lotEl);

  status.textContent = "Slot 2 read complete. Please review title, store, and price.";
}

function getLotRows() {
  const lotEls = Array.from(document.querySelectorAll(".lot-card"));

  return lotEls
    .map(lotEl => ({
      lotNumber: lotEl.querySelector(".lotNumber").value.trim(),
      sellerCode: lotEl.querySelector(".sellerCode").value.trim(),
      title: lotEl.querySelector(".title").value.trim(),
      startBid: lotEl.querySelector(".startBid").value.trim(),
      description: lotEl.querySelector(".description").value
    }))
    .filter(row => row.lotNumber || row.title);
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function downloadCSV() {
  const headers = ["Lot #", "Seller Code", "Title", "Start Bid", "Description"];
  const rows = getLotRows();

  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map(r => [
      r.lotNumber,
      r.sellerCode,
      r.title,
      r.startBid,
      r.description
    ].map(csvEscape).join(","))
  ].join("\r\n");

  download("auctionflex_import.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

function extFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".png")) return ".png";
  if (name.endsWith(".webp")) return ".webp";
  if (name.endsWith(".jpeg")) return ".jpg";

  return ".jpg";
}

async function downloadImageZip() {
  const zip = new JSZip();
  const lotEls = Array.from(document.querySelectorAll(".lot-card"));

  let count = 0;

  for (const lotEl of lotEls) {
    const lotNumber = lotEl.querySelector(".lotNumber").value.trim();
    if (!lotNumber) continue;

    const stockFiles = getFiles(lotEl, "stock").slice(0, 5);
    const personFiles = getFiles(lotEl, "person");

    let imageNumber = 1;

    for (const file of stockFiles) {
      zip.file(`${lotNumber}_${imageNumber}${extFromFile(file)}`, file);
      imageNumber++;
      count++;
    }

    for (const file of personFiles) {
      zip.file(`${lotNumber}_${imageNumber}${extFromFile(file)}`, file);
      imageNumber++;
      count++;
    }
  }

  if (!count) {
    alert("No Slot 1 or Slot 3 images found.");
    return;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  download("auctionflex_images.zip", blob);
}

document.getElementById("createRows").addEventListener("click", createRows);
document.getElementById("applyMaster").addEventListener("click", applyMasterToExistingLots);
document.getElementById("downloadCsv").addEventListener("click", downloadCSV);
document.getElementById("downloadImages").addEventListener("click", downloadImageZip);

createRows();
