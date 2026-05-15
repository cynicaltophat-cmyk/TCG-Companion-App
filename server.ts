import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import apiApp from "./api/index.ts";
import { rateLimit } from "express-rate-limit";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YYT_BASE_URL = "https://yuyu-tei.jp";
const YYT_GAME_ID = "gcg"; // Gundam Card Game abbreviation
const DATA_DIR = path.join(process.cwd(), "data");
const MARKET_FILE = path.join(DATA_DIR, "market.json");
const debugFile = path.join(process.cwd(), "debug.txt");

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
];

const getHeaders = () => {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Host': 'yuyu-tei.jp',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': ua,
    'Referer': 'https://yuyu-tei.jp/'
  };
};

function getYYTUrl(set: string): string {
  const s = set.toUpperCase();
  // User provided specific link for GD04
  if (s === "GD04") return `${YYT_BASE_URL}/sell/${YYT_GAME_ID}/s/special/8/`;
  
  if (s.startsWith("ST")) return `${YYT_BASE_URL}/sell/${YYT_GAME_ID}/s/${s.toLowerCase()}/`;
  
  let slugPart = s.toLowerCase();
  if (s.startsWith("GD")) {
    const num = s.slice(2);
    slugPart = `bt${num}`;
  }
  
  return `${YYT_BASE_URL}/sell/${YYT_GAME_ID}/s/${slugPart}/`;
}

async function fetchSetPrices(set: string) {
  const s = set.toUpperCase();
  const slugsToTry = [];
  if (s === "GD04") {
    slugsToTry.push("special/8");
    slugsToTry.push("gd04");
  } else if (s.startsWith("GD")) {
    const num = s.slice(2);
    slugsToTry.push(`bt${num}`);
    slugsToTry.push(`gd${num}`);
    slugsToTry.push(`gbt${num}`);
    slugsToTry.push(`bo${num}`);
  } else {
    slugsToTry.push(s.toLowerCase());
  }

  const results: Record<string, { price: string, url: string }> = {};

  for (const slug of slugsToTry) {
    const url = `${YYT_BASE_URL}/sell/${YYT_GAME_ID}/s/${slug}/`;
    try {
      console.log(`[Scraper] Syncing ${set} via ${url}`);
      // Increase delay significantly and randomize
      const delay = 5000 + Math.random() * 8000;
      await new Promise(resolve => setTimeout(resolve, delay));

      const fetchWithRetry = async (targetUrl: string, retries = 3): Promise<Response> => {
        for (let i = 0; i <= retries; i++) {
          const currentHeaders = getHeaders();
          const response = await fetch(targetUrl, { headers: currentHeaders });
          if (response.status === 200) return response;
          if (response.status === 403 && i < retries) {
            const waitTime = (i + 1) * 15000 + Math.random() * 10000;
            console.warn(`[Scraper] Hit 403 Forbidden on ${targetUrl}. Attempt ${i + 1}/${retries + 1}. Waiting ${Math.round(waitTime / 1000)}s...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
          }
          return response;
        }
        return await fetch(targetUrl, { headers: getHeaders() }); 
      };

      const response = await fetchWithRetry(url);
      
      await fs.appendFile(debugFile, `[Scraper] Fetch status for ${url}: ${response.status}\n`);
      
      if (!response.ok) {
        if (response.status === 404) continue;
        if (response.status === 403) {
           console.error(`[Scraper] Permanent 403 Forbidden for ${url}. IP might be throttled.`);
           // We'll continue to other slugs but this is a bad sign
        }
        console.warn(`[Scraper] Failed to fetch ${url}: ${response.status}`);
        continue;
      }

      const body = await response.text();
      const $ = cheerio.load(body);
      
      let foundOnPage = 0;
      
      // Try multiple possible container selectors for Yu-Yu-Tei
      const containers = $("div.card_unit, div.item_single_card, .card_list_item, [class*='card_unit']");
      
      containers.each((i, el) => {
        const text = $(el).text();
        const idMatch = text.match(/([GBS]{1,3}[DT0-9]+-[0-9]+)/);
        const priceMatch = text.match(/([0-9,]+)円/);
        
        // Differentiate by rarity if possible - check icons and text
        const rarityImg = $(el).find("img[src*='rarity/']").attr("src") || "";
        const imgAlt = $(el).find("img[src*='rarity/']").attr("alt") || "";
        const rarityLabel = $(el).find(".rarity_str, .rarity, .card_rarity, [class*='rarity']").text().trim();
        
        let rarityMatch = rarityLabel || imgAlt || "";
        
        if (!rarityMatch && rarityImg) {
          const rMatch = rarityImg.match(/rarity\/([a-z0-9+]+)\.png/i);
          if (rMatch) rarityMatch = rMatch[1].toUpperCase();
        }
        
        // Handle common variations
        if (rarityMatch.includes("パラレル")) {
           rarityMatch = rarityMatch.replace("パラレル", "").trim() + "+";
        }
        
        if (!rarityMatch) {
          const rawText = $(el).text();
          const rMatch = rawText.match(/(LR\+|LR|SR|R|U|C|P|SEC)/);
          if (rMatch) rarityMatch = rMatch[1];
        }
        
        // Final cleaning
        rarityMatch = rarityMatch.toUpperCase().replace(/\s+/g, "");
        if (rarityMatch === "LRPLUS") rarityMatch = "LR+";
        
        let id = idMatch ? idMatch[1].toUpperCase() : "";
        if (id) {
          id = id.replace(/^GBT/, "GD").replace(/^GST/, "ST").replace(/^BT/, "GD");
        }

        if (idMatch && priceMatch) {
          const price = priceMatch[1].replace(/[^\d]/g, "");
          const rarity = rarityMatch;

          // Extract individual card URL
          const cardAnchor = $(el).find("a").first();
          const cardHref = cardAnchor.attr("href");
          let finalCardUrl = url; // Fallback to set URL
          
          if (cardHref) {
            if (cardHref.startsWith("http")) {
              finalCardUrl = cardHref;
            } else {
              finalCardUrl = `${YYT_BASE_URL}${cardHref}`;
            }
          }

          // Store both specific and generic (for fallback)
          if (rarity) results[`${id}_${rarity}`] = { price, url: finalCardUrl };
          if (!results[id]) results[id] = { price, url: finalCardUrl };
          foundOnPage++;
        }
      });

      // Fallback matching
      if (foundOnPage === 0) {
        const allText = $.text();
        const idRegex = /([GBS]{1,3}[DT0-9]+-[0-9]+)/g;
        const priceRegex = /([0-9,]+)\s*円/; 
        let match;
        while ((match = idRegex.exec(allText)) !== null) {
          let id = match[1].toUpperCase();
          id = id.replace(/^GBT/, "GD").replace(/^GST/, "ST").replace(/^BT/, "GD");
          
          const searchBox = allText.substring(match.index, match.index + 300);
          const pMatch = priceRegex.exec(searchBox);
          if (pMatch) {
             const price = pMatch[1].replace(/[^\d]/g, "");
             const rMatch = searchBox.match(/(LR\+|LR|SR|R|U|C|P|SEC)/);
             const rarityMatch = rMatch ? rMatch[1].toUpperCase() : "";
             
             if (rarityMatch && !results[`${id}_${rarityMatch}`]) {
               results[`${id}_${rarityMatch}`] = { price, url };
             }
             if (!results[id]) {
               results[id] = { price, url };
               foundOnPage++;
             }
          }
        }
      }
      
      if (foundOnPage > 0) {
        console.log(`[Scraper] Successfully found ${foundOnPage} cards using slug ${slug}`);
        // If we found cards with the primary slug or a good one, we can stop or keep going for completeness
        // For now, we'll keep going to catch reprints on other pages
      }
    } catch (error: any) {
      console.error(`[Scraper] Error with ${url}:`, error.message);
    }
  }

  if (Object.keys(results).length === 0) return null;
  console.log(`[Scraper] Total ${Object.keys(results).length} prices for ${set}`);
  return results;
}

let triggerSync: () => Promise<void>;

async function startBackgroundSync() {
  const sync = async () => {
    try {
      console.log("[Scraper] Background sync is currently disabled to prevent 403 errors.");
      return;
      // Original logic preserved below but bypassed
      console.log("[Scraper] Starting background sync...");
      await fs.mkdir(DATA_DIR, { recursive: true });
      
      const sets = ["GD01", "GD02", "GD03", "GD04", "ST01", "ST02", "ST03", "ST04"];
      let allPrices: Record<string, any> = {};
      
      try {
        const existingData = await fs.readFile(MARKET_FILE, "utf-8");
        allPrices = JSON.parse(existingData);
      } catch (e) {
        console.log("[Scraper] No existing market file found.");
      }

      for (const set of sets) {
        const setPrices = await fetchSetPrices(set);
        if (setPrices) {
          allPrices = { ...allPrices, ...setPrices };
          await fs.writeFile(MARKET_FILE, JSON.stringify(allPrices, null, 2));
          console.log(`[Scraper] Updated prices for ${set}`);
        }
        // Random delay between sets to avoid detection
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 5000));
      }
      console.log("[Scraper] Sync completed successfully.");
    } catch (error) {
      console.error("[Scraper] Sync failed:", error);
    }
  };

  triggerSync = sync;
  
  // Trigger once on startup if file is missing
  try {
    await fs.access(MARKET_FILE);
    console.log("[Scraper] Market file exists, skipping initial sync.");
  } catch (e) {
    console.log("[Scraper] Market file missing, starting initial sync in 5 seconds...");
    setTimeout(sync, 5000);
  }
}

import fsSync from "fs";

async function startServer() {
  fsSync.writeFileSync(debugFile, "[Server] Starting server...\n");
  
  const app = express();
  const PORT = 3000;

  // Start background sync
  startBackgroundSync();

  // Trust proxy for rate limiting (needed behind our infrastructure)
  app.set("trust proxy", 1);

  // Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: "Too many requests from this IP, please try again after 15 minutes",
    keyGenerator: (req) => {
      // Use the first IP in the list from X-Forwarded-For, or fallback to remoteAddress
      return (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || req.ip).split(',')[0].trim();
    }
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // Limit each IP to 5 requests per `window` (Auth/Sensitive routes)
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many attempts on sensitive routes, please try again after 15 minutes",
    keyGenerator: (req) => {
      return (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || req.ip).split(',')[0].trim();
    }
  });

  // Apply the global rate limiter to all requests
  app.use(globalLimiter);

  // Apply the stricter rate limiter to API routes (as they are the most sensitive)
  app.use("/api/", apiLimiter);

  // Serve public directory
  app.use(express.static('public'));
  
  // Use the API routes from api/index.ts
  app.use(apiApp);

  app.post("/api/clear-cache", async (req, res) => {
    try {
      await fs.unlink(MARKET_FILE);
      console.log("[Server] Cache cleared by user");
      // Don't wait for sync to complete, run it in background
      if (triggerSync) triggerSync();
      res.json({ success: true, message: "Cache cleared and sync started" });
    } catch (error) {
      // If file doesn't exist, still trigger sync
      if (triggerSync) triggerSync();
      res.json({ success: true, message: "Sync started" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    // Fallback for SPA
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
