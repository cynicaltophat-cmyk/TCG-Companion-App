document.addEventListener('DOMContentLoaded', () => {
  // Navigation elements
  const tabSingleBtn = document.getElementById('tabSingleBtn');
  const tabBulkBtn = document.getElementById('tabBulkBtn');
  const tabSingleContent = document.getElementById('tabSingleContent');
  const tabBulkContent = document.getElementById('tabBulkContent');

  // Single page extractor elements
  const extractBtn = document.getElementById('extractBtn');

  // Bulk mode elements
  const bulkUrlsTxt = document.getElementById('bulkUrlsTxt');
  const resetUrlsBtn = document.getElementById('resetUrlsBtn');
  const urlCountLabel = document.getElementById('urlCountLabel');
  const bulkProgressPanel = document.getElementById('bulkProgressPanel');
  const progressPercentDesc = document.getElementById('progressPercentDesc');
  const progressCountDesc = document.getElementById('progressCountDesc');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressCurrentUrl = document.getElementById('progressCurrentUrl');
  const bulkExtractBtn = document.getElementById('bulkExtractBtn');
  const bulkCancelBtn = document.getElementById('bulkCancelBtn');

  // General elements
  const copyBtn = document.getElementById('copyBtn');
  const outputTxt = document.getElementById('outputTxt');
  const statusMsg = document.getElementById('statusMsg');

  // Default URLs (exactly as requested by the user)
  const defaultUrls = [
    "https://yuyu-tei.jp/sell/gcg/s/gd04",
    "https://yuyu-tei.jp/sell/gcg/s/gd03",
    "https://yuyu-tei.jp/sell/gcg/s/gd02",
    "https://yuyu-tei.jp/sell/gcg/s/gd01",
    "https://yuyu-tei.jp/sell/gcg/s/st01",
    "https://yuyu-tei.jp/sell/gcg/s/st02",
    "https://yuyu-tei.jp/sell/gcg/s/st03",
    "https://yuyu-tei.jp/sell/gcg/s/st04",
    "https://yuyu-tei.jp/sell/gcg/s/st05",
    "https://yuyu-tei.jp/sell/gcg/s/st06",
    "https://yuyu-tei.jp/sell/gcg/s/st07",
    "https://yuyu-tei.jp/sell/gcg/s/st08",
    "https://yuyu-tei.jp/sell/gcg/s/st09"
  ];

  // Scraping state
  let bulkScrapingActive = false;

  // Initialize Default URLs
  const loadDefaultUrls = () => {
    bulkUrlsTxt.value = defaultUrls.join('\n');
    updateUrlCount();
  };

  const updateUrlCount = () => {
    const urls = getCleanUrlsList();
    urlCountLabel.textContent = `${urls.length} URL${urls.length === 1 ? '' : 's'} loaded`;
  };

  const getCleanUrlsList = () => {
    return bulkUrlsTxt.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('http'));
  };

  // Set default list on start
  loadDefaultUrls();

  // Watch URL input changes
  bulkUrlsTxt.addEventListener('input', updateUrlCount);
  resetUrlsBtn.addEventListener('click', loadDefaultUrls);

  // Tab switching mechanics
  tabSingleBtn.addEventListener('click', () => {
    tabSingleBtn.classList.add('active');
    tabBulkBtn.classList.remove('active');
    tabSingleContent.classList.add('active');
    tabBulkContent.classList.remove('active');
    
    // Stop scraping if active and switching tab
    if (bulkScrapingActive) {
      cancelBulkScraping();
    }
  });

  tabBulkBtn.addEventListener('click', () => {
    tabBulkBtn.classList.add('active');
    tabSingleBtn.classList.remove('active');
    tabBulkContent.classList.add('active');
    tabSingleContent.classList.remove('active');
  });

  // Helper: Sleep utility to prevent spamming Yu-Yu Tei and causing 429
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Core HTML Scraper function matching parity with content.js
  const parseHTMLContent = (doc, pageUrl) => {
    const prices = {};
    
    // Select all possible elements that can be either a section heading or a card box.
    const allNodes = Array.from(doc.querySelectorAll(
      'h2, h3, h4, h5, [class*="heading"], [class*="title"], .card-box, .card-product, [id^="card-"], .sell-list li, .sell-box, .list-node, .product-item'
    ));

    const cardCodeRegex = /\b([A-Z0-9]{2,}[-_]\d{3,}(?:[+*★A-Za-z_-]+)?)(?!\w)/i;

    let currentGroup = "Base art"; // default baseline

    allNodes.forEach(node => {
      // Check if it's a heading element
      const isHeading = node.tagName.match(/^H[2-5]$/) || 
                        (node.classList && node.classList.contains('title')) || 
                        (node.classList && node.classList.contains('category-title')) || 
                        (node.classList && node.classList.contains('rank-title')) ||
                        /[_-]title|heading/i.test(node.className || "");

      if (isHeading) {
        const text = (node.textContent || "").trim();
        if (text) {
          const normalized = text
            .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) // full-width to half-width
            .replace(/　/g, ' ')
            .toUpperCase();

          let foundAlt = false;
          const altTags = ["LR++", "LR+", "U+", "R+", "C+", "SP", "CHAMPIONSHIP", "NEWTYPE CHALLENGE", "RELEASE EVENT", "PREMIUM GOODS SET", "PARALLEL"];
          for (const tag of altTags) {
            const tagRegex = new RegExp("(?:^|[^A-Z0-9])" + tag.replace(/[+*?^${}()|[\]\\]/g, '\\$&') + "(?:$|[^A-Z0-9])", "i");
            if (tagRegex.test(normalized)) {
              if (tag === "CHAMPIONSHIP") currentGroup = "Championship";
              else if (tag === "NEWTYPE CHALLENGE") currentGroup = "Newtype Challenge";
              else if (tag === "RELEASE EVENT") currentGroup = "Release Event";
              else if (tag === "PREMIUM GOODS SET") currentGroup = "Premium Goods Set";
              else currentGroup = tag;
              foundAlt = true;
              break;
            }
          }

          // Handle Japanese equivalents if not matched yet
          if (!foundAlt) {
            if (normalized.includes("チャンピオンシップ") || normalized.includes("チャンピオン")) {
              currentGroup = "Championship";
              foundAlt = true;
            } else if (normalized.includes("ニュータイプ") || normalized.includes("NEWTYPE")) {
              currentGroup = "Newtype Challenge";
              foundAlt = true;
            } else if (normalized.includes("リリース")) {
              currentGroup = "Release Event";
              foundAlt = true;
            } else if (normalized.includes("プレミアム")) {
              currentGroup = "Premium Goods Set";
              foundAlt = true;
            } else if (normalized.includes("パラレル")) {
              currentGroup = "Parallel";
              foundAlt = true;
            }
          }

          if (!foundAlt && (
            normalized.includes("CARD LIST") || 
            normalized.includes("NORMAL") || 
            normalized.includes("BASE") || 
            normalized.includes("ノーマル") || 
            /(?:^|[^A-Z0-9])(?:LR|SR|R|U|C|SEC)(?:$|[^A-Z0-9])/.test(normalized)
          )) {
            currentGroup = "Base art";
          }
        }
      } else {
        // It's a card element. Avoid double counting nested containers
        if (node.dataset && node.dataset.yytParsed) return;

        const textContent = node.textContent || "";
        let code = "";
        
        const idEl = node.querySelector('.id, .card-id, .card-number, .code, .item-id, .card-code, [class*="id"], [class*="code"]');
        if (idEl) {
          const match = idEl.textContent.match(cardCodeRegex);
          if (match) code = match[1];
        }
        
        if (!code) {
          const match = textContent.match(cardCodeRegex);
          if (match) code = match[1];
        }

        if (!code) return;

        code = code.trim().toUpperCase()
                   .replace(/ー/g, '-')
                   .replace(/－/g, '-');

        let priceVal = null;
        const priceEl = node.querySelector('.price, .sell_price, .price-box, .strong, strong, [class*="price"]');
        if (priceEl) {
          const priceText = priceEl.textContent || "";
          const priceDigits = priceText.replace(/[^\d]/g, '');
          if (priceDigits) {
            priceVal = parseInt(priceDigits, 10);
          }
        }
        
        if (!priceVal) {
          const priceMatch = textContent.match(/(?:¥|￥)\s*([\d,]+)|([\d,]+)\s*円/);
          if (priceMatch) {
             const digits = (priceMatch[1] || priceMatch[2]).replace(/,/g, '');
             priceVal = parseInt(digits, 10);
          }
        }

        if (!priceVal) {
          const numbers = textContent.replace(/,/g, '').match(/\d+/g);
          if (numbers) {
            for (let num of numbers) {
              const parsed = parseInt(num, 10);
              if (parsed >= 10 && parsed <= 500000 && !textContent.includes(code.replace('-', ''))) {
                priceVal = parsed;
                break;
              }
            }
          }
        }

        if (!priceVal) return;

        let cardUrl = pageUrl;
        const linkEl = node.querySelector('a[href]');
        if (linkEl) {
          const href = linkEl.getAttribute('href');
          try {
            cardUrl = new URL(href, pageUrl).href;
          } catch (e) {
            cardUrl = pageUrl;
          }
        }

        let rarity = "";
        const rarityEl = node.querySelector('.rarity, .card-rarity, [class*="rarity"]');
        if (rarityEl) {
          rarity = rarityEl.textContent.trim().toUpperCase();
        } else {
          // General text search for rarity codes in descending order of specificity
          let foundRarity = "";
          const normalizedText = textContent.toUpperCase();
          for (const rTag of ["LR++", "LR+", "U+", "R+", "C+", "SP", "SEC", "LR", "SR", "R", "U", "C", "PARALLEL"]) {
            const rRegex = new RegExp("(?:^|[^A-Z0-9])" + rTag.replace(/[+*?^${}()|[\]\\]/g, '\\$&') + "(?:$|[^A-Z0-9])", "i");
            if (rRegex.test(normalizedText)) {
              foundRarity = rTag;
              break;
            }
          }
          rarity = foundRarity || "C"; // fallback to standard lowest
        }

        if (node.dataset) {
          node.dataset.yytParsed = "true";
        }

        const priceStr = priceVal.toString();
        const isParallel = /パラレル|parallel|alt-art|alternative art/i.test(textContent) || 
                           /パラレル|parallel|alt-art|alternative art/i.test(cardUrl) ||
                           rarity === "PARALLEL";

        let activeGroup = currentGroup;
        if (activeGroup === "Base art" && isParallel) {
          activeGroup = "Parallel";
        }

        const parallelSuffix = (activeGroup && activeGroup !== "Base art") 
          ? `_${activeGroup.toUpperCase().replace(/\s+/g, '')}` 
          : "";

        if (rarity && !code.includes(`_${rarity}`)) {
          prices[`${code}_${rarity}${parallelSuffix}`] = { price: priceStr, url: cardUrl };
        }
        prices[`${code}${parallelSuffix}`] = { price: priceStr, url: cardUrl };
      }
    });

    return prices;
  };

  // ----- SINGLE MODE EXTRACTION -----
  extractBtn.addEventListener('click', async () => {
    statusMsg.textContent = "Connecting to browser tab...";
    statusMsg.className = "status";
    outputTxt.value = "";
    copyBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        statusMsg.textContent = "Error: No active browser tab found.";
        statusMsg.className = "status error";
        return;
      }

      const url = tab.url || "";
      if (!url.includes('yuyu-tei.jp')) {
        statusMsg.textContent = "Error: Please navigate your active browser tab to a yuyu-tei.jp subpage first!";
        statusMsg.className = "status error";
        return;
      }

      statusMsg.textContent = "Parsing page elements...";

      // Inject and execute content script locally on tab
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, (results) => {
        if (chrome.runtime.lastError) {
          statusMsg.textContent = "Execution failed: " + chrome.runtime.lastError.message;
          statusMsg.className = "status error";
          console.error(chrome.runtime.lastError);
          return;
        }

        if (results && results[0] && results[0].result) {
          const parsedPrices = results[0].result;
          const count = Object.keys(parsedPrices).length;

          if (count > 0) {
            // Sort keys so they look clean
            const sortedPrices = {};
            Object.keys(parsedPrices).sort().forEach(k => {
              sortedPrices[k] = parsedPrices[k];
            });

            // Write output
            outputTxt.value = JSON.stringify(sortedPrices, null, 2);
            copyBtn.disabled = false;
            statusMsg.textContent = `Extracted prices for ${count} cards successfully!`;
            statusMsg.className = "status";
          } else {
            statusMsg.textContent = "Parsed 0 card listings. Are you on a selling category grid?";
            statusMsg.className = "status error";
          }
        } else {
          statusMsg.textContent = "Error: Could not retrieve elements from content script.";
          statusMsg.className = "status error";
        }
      });
    } catch (err) {
      statusMsg.textContent = "Error: " + err.message;
      statusMsg.className = "status error";
    }
  });

  // ----- BULK MODE EXTRACTION -----
  bulkExtractBtn.addEventListener('click', async () => {
    const urls = getCleanUrlsList();
    if (urls.length === 0) {
      statusMsg.textContent = "Error: Please specify at least one valid yuyu-tei URL containing http/https.";
      statusMsg.className = "status error";
      return;
    }

    // Toggle scanning buttons & states
    bulkScrapingActive = true;
    bulkExtractBtn.disabled = true;
    tabSingleBtn.style.pointerEvents = 'none'; // Lock navigation
    tabSingleBtn.style.opacity = '0.5';
    resetUrlsBtn.disabled = true;
    bulkUrlsTxt.disabled = true;
    copyBtn.disabled = true;
    
    // Show cancellation controls & progress
    bulkCancelBtn.style.display = 'block';
    bulkProgressPanel.style.display = 'block';
    
    outputTxt.value = "";
    statusMsg.textContent = "Starting multi-source gather...";
    statusMsg.className = "status";

    const megaResults = {};
    let parsedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < urls.length; i++) {
      if (!bulkScrapingActive) break;

      const url = urls[i];
      const displayName = url.split('/').pop() || url; // eg. 'gd04' or 'st01'
      
      // Update Progress UI
      const percent = Math.round((i / urls.length) * 100);
      progressPercentDesc.textContent = `Progress: ${percent}%`;
      progressCountDesc.textContent = `${i} of ${urls.length} pages`;
      progressBarFill.style.width = `${percent}%`;
      progressCurrentUrl.textContent = `Fetching: ${displayName}...`;
      statusMsg.textContent = `Scraping page ${i + 1}/${urls.length}: ${displayName}...`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Parse prices using elements parsed locally
        const parsedPrices = parseHTMLContent(doc, url);
        const cardCountOnPage = Object.keys(parsedPrices).length;

        // Consolidate into main dictionary
        Object.assign(megaResults, parsedPrices);
        parsedCount++;
        
        progressCurrentUrl.textContent = `Success: ${displayName} (${cardCountOnPage} cards parsed)`;

      } catch (err) {
        console.error(`Failed to fetch/parse URL: ${url}`, err);
        failedCount++;
        progressCurrentUrl.textContent = `Failed: ${displayName} - ${err.message}`;
      }

      // Polite delay between requests to preserve the user's connection & site integrity (300ms)
      if (i < urls.length - 1) {
        await sleep(350);
      }
    }

    // Finished or cancelled
    const totalCards = Object.keys(megaResults).length;

    // Reset controls UI
    bulkScrapingActive = false;
    bulkExtractBtn.disabled = false;
    tabSingleBtn.style.pointerEvents = 'all';
    tabSingleBtn.style.opacity = '1';
    resetUrlsBtn.disabled = false;
    bulkUrlsTxt.disabled = false;
    bulkCancelBtn.style.display = 'none';

    // Update progress final state
    progressPercentDesc.textContent = "Progress: 100%";
    progressCountDesc.textContent = `${urls.length} of ${urls.length} completed`;
    progressBarFill.style.width = "100%";

    if (totalCards > 0) {
      // Sort keys nicely
      const sortedMegaResults = {};
      Object.keys(megaResults).sort().forEach(k => {
        sortedMegaResults[k] = megaResults[k];
      });

      outputTxt.value = JSON.stringify(sortedMegaResults, null, 2);
      copyBtn.disabled = false;

      let msg = `Completed! Extracted prices for ${totalCards} cards across ${parsedCount} pages successfully.`;
      if (failedCount > 0) {
        msg += ` (${failedCount} pages failed)`;
      }
      statusMsg.textContent = msg;
      statusMsg.className = "status";
    } else {
      statusMsg.textContent = `Done. Found 0 cards total. (Successfully checked ${parsedCount} pages, failed ${failedCount}).`;
      statusMsg.className = "status error";
    }
  });

  const cancelBulkScraping = () => {
    bulkScrapingActive = false;
    bulkCancelBtn.style.display = 'none';
    bulkExtractBtn.disabled = false;
    tabSingleBtn.style.pointerEvents = 'all';
    tabSingleBtn.style.opacity = '1';
    resetUrlsBtn.disabled = false;
    bulkUrlsTxt.disabled = false;
    progressCurrentUrl.textContent = "Gather cancelled by user.";
    statusMsg.textContent = "One-Shot gather cancelled.";
    statusMsg.className = "status error";
  };

  bulkCancelBtn.addEventListener('click', cancelBulkScraping);

  // ----- SHARED COPY BUTTON -----
  copyBtn.addEventListener('click', () => {
    if (!outputTxt.value) return;

    outputTxt.select();
    navigator.clipboard.writeText(outputTxt.value)
      .then(() => {
        const originalText = statusMsg.textContent;
        statusMsg.textContent = "Copied to clipboard!";
        statusMsg.className = "status";
        setTimeout(() => {
          statusMsg.textContent = originalText;
        }, 1500);
      })
      .catch(err => {
        statusMsg.textContent = "Failed to copy: " + err.message;
        statusMsg.className = "status error";
      });
  });
});
