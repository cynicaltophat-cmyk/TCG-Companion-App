import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import apiApp from "./api/index.ts";
import { rateLimit } from "express-rate-limit";
import fs from "fs/promises";
import fsSync from "fs";
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(process.cwd(), "data");
const MARKET_FILE = path.join(DATA_DIR, "market.json");
const debugFile = path.join(process.cwd(), "debug.txt");

async function startServer() {
  fsSync.writeFileSync(debugFile, "[Server] Starting server...\n");
  
  const app = express();
  const PORT = 3000;

  // Ensure data directory exists
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {}

  // Trust proxy for rate limiting (needed behind our infrastructure)
  app.set("trust proxy", 1);

  // Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many attempts on sensitive routes, please try again after 15 minutes",
  });

  // Apply the global rate limiter to all requests
  app.use(globalLimiter);

  // Apply the stricter rate limiter to API routes
  app.use("/api/", apiLimiter);

  // Serve public directory
  app.use(express.static('public'));
  
  // Use the API routes from api/index.ts
  app.use(apiApp);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

