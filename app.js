window.addEventListener("DOMContentLoaded", () => {
  let lots = [];
  let currentIndex = 0;
  let activeCameraKey = null;
  let activeStream = null;

  const fields = {
    lotNumber: document.getElementById("lotNumber"),
    sellerCode: document.getElementById("sellerCode"),
    startBid: document.getElementById("startBid"),
    title: document.getElementById("title"),
    from: document.getElementById("from"),
    price: document.getElementById("price"),
    description: document.getElementById("description")
  };

  function newLot() {
    return {
      lotNumber: "",
      sellerCode: document.getElementById("copySellerCode").checked ? document.getElementById("masterSellerCode").value : "",
      startBid: document.getElementById("copyStartBid").checked ? document.getElementById("masterStartBid").value : "",
      title: "",
      from: document.getElementById("copyFrom").checked ? selectedMasterFrom() : "",
      price: "",
      descriptionEdited: false,
      description: "",
      stock: [],
      info: [],
      person: []
    };
  }

  function selectedMasterFrom() {
    const selected = document.querySelector("input[name='masterFrom']:checked");
    return selected ? selected.value : "";
  }

  function buildDescription(lot) {
    return document.getElementById("masterDescription").value
      .replaceAll("{TITLE}", lot.title || "")
      .replaceAll("{PRICE}", lot.price || "")
      .replaceAll("{FROM}", lot.from || "");
  }

  function saveCurrentLot() {
    if (!lots.length) return;
    const lot = lots[currentIndex];
    lot.lotNumber = fields.lotNumber.value.trim();
    lot.sellerCode = fields.sellerCode.value.trim();
    lot.startBid = fields.startBid.value.trim();
    lot.title = fields.title.value.trim();
    lot.from = fields.from.value;
    lot.price = fields.price.value.trim();
    lot.description = fields.description.value;
    document.getElementById("savedStatus").textContent = "Saved automatically";
  }

  function loadCurrentLot() {
    const lot = lots[currentIndex];
    fields.lotNumber.value = lot.lotNumber;
    fields.sellerCode.value = lot.sellerCode;
    fields.startBid.value = lot.startBid;
    fields.title.value = lot.title;
    fields.from.value = lot.from;
    fields.price.value = lot.price;

    if (!lot.descriptionEdited && document.getElementById("copyDescription").checked) {
      lot.description = buildDescription(lot);
    }

    fields.description.value = lot.description;
    document.getElementById("lotPosition").textContent = `Lot ${currentIndex + 1} of ${lots.length}`;
    document.getElementById("status").textContent = "";
    renderPreviews();
  }

  function updateDescriptionFromFields() {
    const lot = lots[currentIndex];
    lot.title = fields.title.value.trim();
    lot.from = fields.from.value;
    lot.price = fields.price.value.trim();
    if (!lot.descriptionEdited && document.getElementById("copyDescription").checked) {
      lot.description = buildDescription(lot);
      fields.description.value = lot.description;
    }
  }

  function createLots() {
    saveCurrentLot();
    const count = Number(document.getElementById("lotCount").value || 1);
    lots = Array.from({ length: count }, () => newLot());
    currentIndex = 0;
    loadCurrentLot();
  }

  function applyMasterAll() {
    saveCurrentLot();
    lots.forEach(lot => {
      if (document.getElementById("copySellerCode").checked) lot.sellerCode = document.getElementById("masterSellerCode").value;
      if (document.getElementById("copyStartBid").checked) lot.startBid = document.getElementById("masterStartBid").value;
      if (document.getElementById("copyFrom").checked) lot.from = selectedMasterFrom();
      if (document.getElementById("copyDescription").checked && !lot.descriptionEdited) lot.description = buildDescription(lot);
    });
    loadCurrentLot();
  }

  function goNext() {
    saveCurrentLot();
    if (currentIndex < lots.length - 1) currentIndex++;
    loadCurrentLot();
  }

  function goPrev() {
    saveCurrentLot();
    if (currentIndex > 0) currentIndex--;
    loadCurrentLot();
  }

  function addFiles(key, fileList) {
    const files = Array.from(fileList).filter(f => f.type && f.type.startsWith("image/"));
    if (!files.length) return;

    lots[currentIndex][key] = lots[currentIndex][key].concat(files);
    renderPreviews();

    if (key === "info") runOCR();
  }

  function renderPreviews() {
    ["stock", "info", "person"].forEach(key => {
      const preview = document.getElementById(`${key}Preview`);
      preview.innerHTML = "";
      lots[currentIndex][key].slice(0, 12).forEach(file => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        preview.appendChild(img);
      });
    });
  }

  function setupInputs() {
    [
      ["stockGallery", "stock"],
      ["stockMobileCamera", "stock"],
      ["infoGallery", "info"],
      ["infoMobileCamera", "info"],
      ["personGallery", "person"],
      ["personMobileCamera", "person"]
    ].forEach(([id, key]) => {
      const input = document.getElementById(id);
      input.addEventListener("change", e => {
        addFiles(key, e.target.files);
        input.value = "";
      });
    });

    document.querySelectorAll(".galleryBtn, .cameraBtn").forEach(btn => {
      btn.addEventListener("click", () => document.getElementById(btn.dataset.input).click());
    });

    document.querySelectorAll(".drop-slot").forEach(slot => {
      const key = slot.dataset.key;
      slot.addEventListener("dragover", e => {
        e.preventDefault();
        slot.classList.add("dragover");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
      slot.addEventListener("drop", e => {
        e.preventDefault();
        slot.classList.remove("dragover");
        addFiles(key, e.dataTransfer.files);
      });
    });

    document.querySelectorAll(".desktop-camera-btn").forEach(btn => {
      btn.addEventListener("click", () => openDesktopCamera(btn.dataset.key));
    });
  }

  async function openDesktopCamera(key) {
    activeCameraKey = key;
    const panel = document.getElementById("cameraPanel");
    const video = document.getElementById("cameraVideo");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Webcam capture is not supported in this browser. Use Gallery or Phone Camera instead.");
      return;
    }

    try {
      activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = activeStream;
      panel.classList.remove("hidden");
      panel.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      alert("Camera could not open. Browser permission or device camera may be blocked.");
    }
  }

  function closeDesktopCamera() {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      activeStream = null;
    }
    document.getElementById("cameraPanel").classList.add("hidden");
  }

  function capturePhoto() {
    const video = document.getElementById("cameraVideo");
    if (!activeCameraKey || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob(blob => {
      const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" });
      addFiles(activeCameraKey, [file]);
      closeDesktopCamera();
    }, "image/jpeg", 0.92);
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
      !line.toLowerCase().includes("shopping") &&
      !line.toLowerCase().includes("sponsored") &&
      !line.toLowerCase().includes("google")
    ) || "";
    title = title.replace(/\s+/g, " ").trim();
    if (title.length > 50) {
      title = title.slice(0, 50);
      if (title.includes(" ")) title = title.slice(0, title.lastIndexOf(" "));
    }
    return title.trim();
  }

  async function runOCR() {
    const lot = lots[currentIndex];
    const files = lot.info.slice(0, 5);
    const status = document.getElementById("status");

    if (!files.length) return;
    if (!window.Tesseract) {
      status.textContent = "OCR library did not load. You can type manually.";
      return;
    }

    status.textContent = "Reading Slot 2...";

    try {
      let text = "";
      for (const file of files) {
        const result = await Tesseract.recognize(file, "eng");
        text += "\n" + result.data.text;
      }

      const title = shortenTitle(text);
      const price = findPrice(text);
      const from = guessFrom(text);

      if (title) fields.title.value = title;
      if (price) fields.price.value = price;
      if (from) fields.from.value = from;

      updateDescriptionFromFields();
      saveCurrentLot();
      status.textContent = "Slot 2 read complete. Review title, store, and price.";
    } catch (err) {
      status.textContent = "OCR failed. You can still type title and price manually.";
    }
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
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
    saveCurrentLot();
    const headers = ["Lot #", "Seller Code", "Title", "Start Bid", "Description"];
    const rows = lots
      .filter(lot => lot.lotNumber || lot.title)
      .map(lot => [lot.lotNumber, lot.sellerCode, lot.title, lot.startBid, lot.description]);

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
    saveCurrentLot();

    if (!window.JSZip) {
      alert("ZIP library did not load. Check internet connection.");
      return;
    }

    const zip = new JSZip();
    let count = 0;

    lots.forEach(lot => {
      if (!lot.lotNumber) return;
      let imageNumber = 1;

      lot.stock.slice(0, 5).forEach(file => {
        zip.file(`${lot.lotNumber}_${imageNumber}${extFromFile(file)}`, file);
        imageNumber++;
        count++;
      });

      lot.person.forEach(file => {
        zip.file(`${lot.lotNumber}_${imageNumber}${extFromFile(file)}`, file);
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

  Object.values(fields).forEach(field => {
    field.addEventListener("input", () => {
      if (field === fields.description) {
        lots[currentIndex].descriptionEdited = true;
      } else {
        updateDescriptionFromFields();
      }
      saveCurrentLot();
    });
    field.addEventListener("change", () => {
      updateDescriptionFromFields();
      saveCurrentLot();
    });
  });

  document.getElementById("createLots").addEventListener("click", createLots);
  document.getElementById("applyMasterAll").addEventListener("click", applyMasterAll);
  document.getElementById("nextLot").addEventListener("click", goNext);
  document.getElementById("prevLot").addEventListener("click", goPrev);
  document.getElementById("downloadCsv").addEventListener("click", downloadCSV);
  document.getElementById("downloadImages").addEventListener("click", downloadImageZip);
  document.getElementById("capturePhoto").addEventListener("click", capturePhoto);
  document.getElementById("closeCamera").addEventListener("click", closeDesktopCamera);

  setupInputs();
  createLots();
});
