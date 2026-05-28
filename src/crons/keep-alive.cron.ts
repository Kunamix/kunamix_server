import cron, { ScheduledTask } from "node-cron";

let task: ScheduledTask | null = null;


export const startKeepAliveCron = (): void => {
  // Every 14 minutes (Render sleeps after ~15 min of inactivity)
  task = cron.schedule("*/10 * * * *", async () => {
    try {
      const res = await fetch("https://api.kunamix.com/health");
      console.log("Keep-alive ping");
      console.log(
        `🏓 Keep-alive ping → ${res.status} (${new Date().toISOString()})`,
      );
    } catch (error) {
      console.log("❌ Keep-alive ping failed:", error);
    }
  });

  console.log(
    `🕐 Keep-alive cron started — pinging https://api.fillfeedback.com/health every 10 min`,
  );
};

/**
 * Gracefully stops the keep-alive cron task.
 */
export const stopKeepAliveCron = (): void => {
  if (task) {
    task.stop();
    task = null;
    console.log("✅ Keep-alive cron stopped");
  }
};
