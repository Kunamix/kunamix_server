import "./config/firebase";
import http from "http";
import app from "./app";
import dotenv from "dotenv"
import { startKeepAliveCron, stopKeepAliveCron } from "./crons/keep-alive.cron";
dotenv.config();

const PORT = process.env.PORT || 8080;

const server = http.createServer(app);

/* ----------- START SERVER --------- */
const startServer = async () => {
  try {
   
    server.listen(PORT, () => {
      console.log(`Server running on port: ${process.env.PORT}`);
      // Start cron jobs
      startKeepAliveCron();
    });
  } catch (error) {
    console.log("Failed to start server", error);
    process.exit(1);
  }
};

startServer();

/* -------------------- GRACEFUL SHUTDOWN -------------------- */
let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // 1. Stop accepting new requests
    await new Promise<void>(resolve => {
      server.close(() => {
        console.log("✅ HTTP server closed");
        resolve();
      });
    });

    // 2. Stop cron jobs
    stopKeepAliveCron();
    process.exit(0);
  } catch (error) {
    console.log("Error during shutdown", error);
    process.exit(1);
  }
};

/* -------------------- SIGNAL HANDLERS -------------------- */
process.on("SIGINT", shutdown); // Ctrl + C
process.on("SIGTERM", shutdown); // Docker / K8s