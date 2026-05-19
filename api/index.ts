import express from "express";
import fs from "fs/promises";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const MARKET_FILE = path.join(process.cwd(), "data", "market.json");

let aiClient: GoogleGenAI | null = null;

function getAi() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in the environment.");
    }
    aiClient = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

app.get("/api/prices", async (req, res) => {
  try {
    const data = await fs.readFile(MARKET_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch (error) {
    console.warn("Market data not ready yet.");
    res.json({});
  }
});

app.post("/api/fetch-price", express.json(), async (req, res) => {
  const { cardNumber, cardName, rarity } = req.body;
  
  if (!cardNumber) {
    return res.status(400).json({ error: "Card number is required" });
  }

  try {
    const ai = getAi();
    const searchUrl = `https://yuyu-tei.jp/sell/gcg/s/search?search_word=${cardNumber}`;
    const prompt = `Find the current selling price for Gundam TCG card "${cardNumber} ${cardName || ""}" (Rarity: ${rarity || "any"}) on Yu-Yu Tei.
    You should prioritize looking at this search result page: ${searchUrl}
    
    Return the price in Japanese Yen (JPY) as a number. 
    If multiple versions exist, focus on the one that matches the rarity provided.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} } as any],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER },
            sourceUrl: { type: Type.STRING }
          },
          required: ["price"]
        }
      }
    });

    const responseText = response.text || "";
    const data = JSON.parse(responseText);
    
    res.json({
      price: data.price,
      url: data.sourceUrl || (response.candidates?.[0]?.groundingMetadata?.groundingChunks?.[0] as any)?.web?.uri || `https://yuyu-tei.jp/sell/gcg/s/search?search_word=${cardNumber}`,
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching price via Gemini:", error);
    
    // Specifically handle 429 Quota errors
    if (error.message?.includes("429") || error.status === 429 || error.message?.includes("quota")) {
      return res.status(429).json({ 
        error: "Quota reached", 
        message: "AI search limit reached. Please use the official search link.",
        fallbackUrl: `https://yuyu-tei.jp/sell/gcg/s/search?search_word=${cardNumber}`
      });
    }
    
    res.status(500).json({ error: "Failed to fetch price", details: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
