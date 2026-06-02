# Yu-Yu Tei Chrome Price Extractor Extension

This is a lightweight Google Chrome browser extension designed to solve the server-side scraping blocker (403 Forbidden) when fetching pricing data from **Yu-Yu Tei (yuyu-tei.jp)**. 

Since the extension runs inside your personal browser session, it bypasses Cloudflare protections automatically and extracts the live Japanese Yen (¥) card prices directly into a formatted JSON structure.

---

## 🚀 How to Install & Load the Extension

To install this extension in Google Chrome, follow these quick steps:

1. **Download or Extract the Extension Files**:
   Locate the `/yyt-pricing-extension-scaffold` folder. Ensure it contains the following 4 files:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `content.js`

2. **Open Chrome Extension Management**:
   Open a new tab in Chrome and navigate to:
   ```txt
   chrome://extensions/
   ```

3. **Enable Developer Mode**:
   Toggle the **"Developer mode"** switch in the top-right corner of the Extensions page to **ON**.

4. **Load the Unpacked Folder**:
   - Click the **"Load unpacked"** button in the top-left corner.
   - Select the `/yyt-pricing-extension-scaffold` folder from your local directory.
   - The **Yu-Yu Tei Price Extractor** extension will now show in your active extensions list!

---

## 📊 How to Use It

1. **Visit Yu-Yu Tei**:
   Go to any card catalogue/selling list page on Yu-Yu Tei in your Chrome browser. 
   - *Example URL*: `https://yuyu-tei.jp/sell/gcg/s/gd04` (Gundam TCG Booster Set 4)

2. **Extract prices**:
   - Click the puzzle piece icon next to your address bar, find **Yu-Yu Tei Price Extractor**, and pin it.
   - Click the extension icon to open the popup bubble.
   - Click **"Extract Cards & Prices"**. The tool will parse the live page elements and generate a JSON block containing matching card codes and yen values.

3. **Copy Output**:
   - Click **"Copy JSON Content"** to save the formatted data into your desktop clipboard.

4. **Import into the Gundam TCG App**:
   - Open your Gundam TCG App.
   - Tap the **Show Prices** / **Hide Prices** toggle in the side filter/options panel.
   - Click the **"Import Prices JSON"** button.
   - Paste the copied JSON block inside the input dialog and click **"Import & Save"**!
   - All matching card cards inside set listings, deck builders, and pricing breakdowns will immediately show the live extracted ¥ prices!
