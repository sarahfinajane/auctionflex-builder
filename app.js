const lotsDiv = document.getElementById("lots");
const template = document.getElementById("lotTemplate");

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function shortenTitle(text) {
  let lines = text.split(/\n/).map(x => x.trim()).filter(Boolean);

  let likely = lines.find(line =>
    line.length > 8 &&
    line.length < 120 &&
    !line.match(/^\$?\d+(\.\d{2})?$/) &&
    !line.toLowerCase().includes("barcode") &&
    !line.toLowerCase().includes("google") &&
    !line.toLowerCase().includes("shopping")
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
  lotEl.querySelector(".description").value = buildDescription(lotEl);
}

function makePreviews(input, previewDiv) {
  previewDiv.innerHTML = "";
  const files = Array.from(input.files).slice(0, 5);

  files.forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    previewDiv.appendChild(img);
  });
}

function createRows() {
  lotsDiv.innerHTML = "";

  const count = Number(document.getElementById("lotCount").value || 1);
  const masterSellerCode = document.getElementById("masterSellerCode").value;
  const masterStartBid = document.getElementById("masterStartBid").value;

  for (let i = 0; i < count; i++) {
    const node = template.content.cloneNode(true);
    const lotEl = node.querySelector(".lot-card");

    lotEl.querySelector("h2").textContent = `Lot Line ${i + 1}`;

    if (document.getElementById("copySellerCode").checked) {
      lotEl.querySelector(".sellerCode").value = masterSellerCode;
    }

    if (document.getElementById("copyStartBid").checked) {
      lotEl.querySelector(".startBid").value = masterStartBid;
    }

    [".title", ".price", ".from"].forEach(sel => {
      lotEl.querySelector(sel).addEventListener("input", () => refreshDescription(lotEl));
    });

    lotEl.querySelector(".ocrBtn").addEventListener("click", () => runOCR(lotEl));

    const stockInput = lotEl.querySelector(".stockPhotos");
    const infoInput = lotEl.querySelector(".infoPhotos");
    const personInput = lotEl.querySelector(".personPhotos");

    stockInput.addEventListener("change", () => {
      makePreviews(stockInput, lotEl.querySelector(".stockPreview"));
    });

    infoInput.addEventListener("change", () => {
      makePreviews(infoInput, lotEl.querySelector(".infoPreview"));
    });

    personInput.addEventListener("change", () => {
      makePreviews(personInput, lotEl.querySelector(".personPreview"));
    });

    refreshDescription(lotEl);
    lotsDiv.appendChild(node);
  }
}

async function runOCR(lotEl) {
  const input = lotEl.querySelector(".infoPhotos");
  const files = Array.from(input.files).slice(0, 5);
  const status = lotEl.querySelector(".status");

  if (!files.length) {
    status.textContent = "Add info/price photos in Slot 2 first.";
    return;
  }

  status.textContent = "Reading Slot 2 photos. This can take a minute.";

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

  status.innerHTML =
    "OCR complete. Please review before exporting.";
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

    const stockFiles = Array.from(lotEl.querySelector(".stockPhotos").files).slice(0, 5);
    const personFiles = Array.from(lotEl.querySelector(".personPhotos").files);

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
document.getElementById("downloadCsv").addEventListener("click", downloadCSV);
document.getElementById("downloadImages").addEventListener("click", downloadImageZip);

createRows();
