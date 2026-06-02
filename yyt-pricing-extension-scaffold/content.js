(function() {
  const prices = {};

  // 1. Select all possible elements that can be either a section heading or a card box.
  // This allows traversing them in exact document sequence.
  const allNodes = Array.from(document.querySelectorAll(
    'h2, h3, h4, h5, [class*="heading"], [class*="title"], .card-box, .card-product, [id^="card-"], .sell-list li, .sell-box, .list-node, .product-item'
  ));

  const cardCodeRegex = /\b([A-Z0-9]{2,}[-_]\d{3,}(?:[+*★A-Za-z_-]+)?)(?!\w)/i;

  let currentGroup = "Base art"; // default baseline

  allNodes.forEach(node => {
    // Check if it's a heading element
    const isHeading = node.tagName.match(/^H[2-5]$/) || 
                      node.classList.contains('title') || 
                      node.classList.contains('category-title') || 
                      node.classList.contains('rank-title') ||
                      /[_-]title|heading/i.test(node.className || "");

    if (isHeading) {
      const text = (node.textContent || "").trim();
      if (text) {
        // Normalize full-width characters and capitalize for robust matching
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

        // If it's a normal section header (e.g., LR Card List, R Card List), reset currentGroup to normal.
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
      
      // 1. Try to find the card number inside specialized selectors for pinpoint precision
      let code = "";
      const idEl = node.querySelector('.id, .card-id, .card-number, .code, .item-id, .card-code, [class*="id"], [class*="code"]');
      if (idEl) {
        const match = idEl.textContent.match(cardCodeRegex);
        if (match) code = match[1];
      }
      
      // If not found, search in the item text content general regex
      if (!code) {
        const match = textContent.match(cardCodeRegex);
        if (match) code = match[1];
      }

      if (!code) return; // Not a card element

      // Standardize code: convert to uppercase, and normalize dashes
      code = code.trim().toUpperCase()
                 .replace(/ー/g, '-')
                 .replace(/－/g, '-');

      // 2. Extract price in Japanese Yen
      let priceVal = null;
      
      // Match in price-specific classed elements first
      const priceEl = node.querySelector('.price, .sell_price, .price-box, .strong, strong, [class*="price"]');
      if (priceEl) {
        const priceText = priceEl.textContent || "";
        const priceDigits = priceText.replace(/[^\d]/g, '');
        if (priceDigits) {
          priceVal = parseInt(priceDigits, 10);
        }
      }
      
      // Fallback to scraping the raw item text for ¥ symbol or "円"
      if (!priceVal) {
        const priceMatch = textContent.match(/(?:¥|￥)\s*([\d,]+)|([\d,]+)\s*円/);
        if (priceMatch) {
           const digits = (priceMatch[1] || priceMatch[2]).replace(/,/g, '');
           priceVal = parseInt(digits, 10);
        }
      }

      // Heuristics fallback: find any valid number matching standard pricing ranges (50 to 500k JPY)
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

      if (!priceVal) return; // No price extracted, skip

      // 3. Extract the card detail link
      let cardUrl = window.location.href;
      const linkEl = node.querySelector('a[href]');
      if (linkEl) {
        const href = linkEl.getAttribute('href');
        cardUrl = new URL(href, window.location.origin).href;
      }

      // 4. Extract rarity (C, U, R, LR, etc.)
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

      // Flag parsed to stop parent matching
      if (node.dataset) {
        node.dataset.yytParsed = "true";
      }

      const priceStr = priceVal.toString();

      // Check if parallel/alternative art
      const isParallel = /パラレル|parallel|alt-art|alternative art/i.test(textContent) || 
                         /パラレル|parallel|alt-art|alternative art/i.test(cardUrl) ||
                         rarity === "PARALLEL";

      let activeGroup = currentGroup;
      if (activeGroup === "Base art" && isParallel) {
        activeGroup = "Parallel";
      }

      // Generate localized parallel suffix
      const parallelSuffix = (activeGroup && activeGroup !== "Base art") 
        ? `_${activeGroup.toUpperCase().replace(/\s+/g, '')}` 
        : "";

      // Populate pricing map
      if (rarity && !code.includes(`_${rarity}`)) {
        prices[`${code}_${rarity}${parallelSuffix}`] = { price: priceStr, url: cardUrl };
      }
      prices[`${code}${parallelSuffix}`] = { price: priceStr, url: cardUrl };
    }
  });

  // Clean data-yyt-parsed tags
  document.querySelectorAll('[data-yyt-parsed]').forEach(el => {
    delete el.dataset.yytParsed;
  });

  return prices;
})();
