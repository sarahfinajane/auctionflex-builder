# AuctionFlex Simple Builder

A very simple browser-based AuctionFlex CSV and image-renaming helper.

## What it does

- Creates lot lines.
- Lets you enter:
  - Lot #
  - Seller Code
  - Title
  - Start Bid
  - From
  - Retail Price
  - Description
- Uses a master description template with placeholders:
  - `{TITLE}`
  - `{PRICE}`
  - `{FROM}`
- Lets you upload:
  - Slot 1: stock photos
  - Slot 2: info/price photos for OCR
  - Slot 3: in-person photos
- Exports:
  - `auctionflex_import.csv`
  - `auctionflex_images.zip`

## Image naming

If Lot # is `242`:

- Slot 1 stock photo becomes `242_1.jpg`
- Slot 1 second stock photo becomes `242_2.jpg`
- Slot 3 in-person photo continues after stock photos, like `242_3.jpg`

Slot 2 info photos are only used for OCR and are not included in the image ZIP.

## How to put it on GitHub Pages

1. Create a GitHub account.
2. Create a new repository named `auctionflex-simple-builder`.
3. Upload these files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
4. Go to repository **Settings**.
5. Go to **Pages**.
6. Under **Build and deployment**, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
7. Save.
8. GitHub will give you a website link.

## Important

This runs entirely in your browser. It does not save your work after closing the page yet.

The OCR is basic. Always review the extracted title and price before exporting.
