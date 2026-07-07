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

function buildDescription(lotEl) {
  const master = document.getElementById("masterDescription").value;
  return master
    .replaceAll("{TITLE}", lotEl.querySelector(".title").value)
    .replaceAll("{PRICE}", lotEl.querySelector(".price").value)
    .replaceAll("{FROM}", lotEl.querySelector(".from").value);
}

function refreshDescription(lotEl) {
  const copy = document.getElementById("copyDescription");
  if (!copy || copy.checked) {
    lotEl.querySelector(".description").value = buildDescription(lotEl);
  }
}

function getFiles(lotEl, key) {
  const store = photoStore.get(lotEl);
  return store ? store[key] : [];
}

function addFiles(lotEl, key, files) {
  const store = photoStore.get(lotEl) || { stock: [], info: [], person: [] };
  store[key] = store[key].concat(Array.from(files).filter(f => f.type.startsWith("image/")));
  photoStore.set(lotEl, store);
  showPreview(lotEl, key);

  if (key === "info") {
    runOCR(lotEl);
  }
}

function showPreview(lotEl, key) {
  const preview =
    key === "stock" ? lotEl.querySelector(".stockPreview") :
    key === "info" ? lotEl.querySelector(".infoPreview") :
    lotEl.querySelector(".personPreview");

  preview.innerHTML = "";

  getFiles(lotEl, key).forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
}

function setupSlot(lotEl, slot, input, key) {
  slot.addEventListener("click", () => input.click());

  input.addEventListener("change", e => {
    addFiles(lotEl, key, e.target.files);
    input.value = "";
  });

  slot.addEventListener("dragover", e => {
    e.preventDefault();
    slot.classList.add("dragover");
  });

  slot.addEventListener("dragleave", () => {
    slot.classList.remove("dragover");
  });

  slot.addEventListener("drop", e => {
    e.preventDefault();
    slot.classList.remove("dragover");
    addFiles(lotEl, key, e.dataTransfer.files);
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

function createRows() {
  lotsDiv.innerHTML = "";
  const count = Number(document.getElementById("lotCount").value || 1);

  for (let i = 0; i < count; i++) {
    const node = template.content.cloneNode(true);
    const lotEl = node.querySelector(".lot-card");

    lotEl.querySelector("h2").textContent = `Lot Line ${i + 1}`;
    photoStore.set(lotEl, { stock: [], info: [], person: [] });

    lotEl.querySelector(".title").addEventListener("input", () => refreshDescription(lotEl));
    lotEl.querySelector(".price").addEventListener("input", () => refreshDescription(lotEl));
    lotEl.querySelector(".from").addEventListener("change", () => refreshDescription(lotEl));

    const slots = lotEl.querySelectorAll(".drop-slot");

    setupSlot(lotEl, slots[0], lotEl.querySelector(".stockPhotos"), "stock");
    setupSlot(lotEl, slots[1], lotEl.querySelector(".infoPhotos"), "info");
    setupSlot(lotEl, slots[2], lotEl.querySelector(".personPhotos"), "person");

    applyMasterToLot(lotEl);
    lotsDiv.appendChild(node);
  }
}

function findPrice(text) {
  const prices = text.match(/\$\s?\d{1,4}(?:,\d{3})*(?:\.\d{2})?/g);
  return prices ? prices[0].replace(/\s/g, "") : "";
}

function guessFrom(text) {
  const lower = text.toLowerCase();
  if (lower.includes("home depot") || lower.includes("homedepot")) return "Home Depot";
  if (lower.includes("target")) return "Target";
  if (lower.includes("walmart")) return "Walmart";
  if (lower.includes("lowe")) return "Lowe's";
  if (lower.includes("amazon")) return "Amazon";
  return "";
}

function shortenTitle(text) {
  const lines = text.split("\n").map(x => x.trim()).filter(Boolean);
  let title = lines.find(line =>
    line.length > 8 &&
    line.length < 120 &&
    !line.includes("$") &&
    !line.toLowerCase().includes("barcode") &&
    !line.toLowerCase().includes("shopping")
  ) || "";

  title = title.replace(/\s+/g, " ").trim();
  if (title.length > 50) title = title.slice(0, 50).trim();
  return title;
}

async function runOCR(lotEl) {
  const files = getFiles(lotEl, "info").slice(0, 5);
  const status = lotEl.querySelector(".status");

  if (!files.length) return;

  status.textContent = "Reading Slot 2...";

  let text = "";

  for (const file of files) {
    const result = await Tesseract.recognize(file, "eng");
    text += "\n" + result.data.text;
  }

  const title = shortenTitle(text);
  const price = findPrice(text);
  const from = guessFrom(text);

  if (title) lotEl.querySelector(".title").value = title;
  if (price) lotEl.querySelector(".price").value = price;
  if (from) lotEl.querySelector(".from").value = from;

  refreshDescription(lotEl);
  status.textContent = "Slot 2 read complete. Review title and price.";
}

function applyMasterToExistingLots() {
  document.querySelectorAll(".lot-card").forEach(lotEl => applyMasterToLot(lotEl));
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
  const rows = Array.from(document.querySelectorAll(".lot-card"))
    .map(lotEl => [
      lotEl.querySelector(".lotNumber").value,
      lotEl.querySelector(".sellerCode").value,
      lotEl.querySelector(".title").value,
      lotEl.querySelector(".startBid").value,
      lotEl.querySelector(".description").value
    ])
    .filter(row => row[0] || row[2]);

  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map(row => row.map(csvEscape).join(","))
  ].join("\r\n");

  download("auctionflex_import.csv", new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

function extFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return ".png";
  if (name.endsWith(".webp")) return ".webp";
  return ".jpg";
}

async function downloadImageZip() {
  const zip = new JSZip();
  let count = 0;

  document.querySelectorAll(".lot-card").forEach(lotEl => {
    const lotNumber = lotEl.querySelector(".lotNumber").value.trim();
    if (!lotNumber) return;

    let imageNumber = 1;

    getFiles(lotEl, "stock").slice(0, 5).forEach(file => {
      zip.file(`${lotNumber}_${imageNumber}${extFromFile(file)}`, file);
      imageNumber++;
      count++;
    });

    getFiles(lotEl, "person").forEach(file => {
      zip.file(`${lotNumber}_${imageNumber}${extFromFile(file)}`, file);
      imageNumber++;
      count++;
    });
  });

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
