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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
