import { loadEnv } from "@omnipost/shared";
import { pollAndProcessDuePosts } from "./dispatcher";

const env = loadEnv();

const logger = (msg: string, meta?: Record<string, unknown>) =>
  console.log(
    JSON.stringify({
      app: "omnipost-worker",
      level: "info",
      msg,
      env: env.NODE_ENV,
      time: new Date().toISOString(),
      ...(meta ? { meta } : {}),
    }),
  );

let isRunning = true;
const POLL_INTERVAL_MS = 5000; // Check every 5 seconds for due scheduled jobs

async function workerLoop() {
  logger("OmniPost Worker started — listening for scheduled publishing jobs");

  while (isRunning) {
    try {
      const processed = await pollAndProcessDuePosts(10);
      if (processed > 0) {
        logger(`Processed ${processed} scheduled post(s) successfully`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown worker loop error";
      logger(`Worker polling error: ${message}`, { error: String(err) });
    }

    // Wait before next poll tick
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  logger("Worker process stopped gracefully.");
}

process.on("SIGINT", () => {
  logger("Received SIGINT, shutting down worker loop...");
  isRunning = false;
});

process.on("SIGTERM", () => {
  logger("Received SIGTERM, shutting down worker loop...");
  isRunning = false;
});

export * from "./dispatcher";
export * from "./providers/registry";
export * from "./providers/types";
export * from "./commentSync";
export * from "./metricsSync";

// Only run standalone polling loop if executed as main entry script
if (process.argv[1] && (process.argv[1].endsWith("worker/src/index.ts") || process.argv[1].endsWith("worker\\src\\index.ts") || process.env.RUN_WORKER === "true")) {
  workerLoop().catch((err) => {
    console.error("Fatal worker error:", err);
    process.exit(1);
  });
}

