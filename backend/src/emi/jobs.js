const cron = require("node-cron");
const { runOverdueJob } = require("./services/emi.service");
const { processNotifications } = require("./services/notify.service");

// Background jobs for EMI & billing. Run them on ONE server only: with several
// app servers, set EMI_CRON=off on all but one (or run a separate worker).
function startEmiJobs() {
  if (process.env.NODE_ENV === "test" || process.env.EMI_CRON === "off") return;

  // Every day at 09:00 India time: DPD, late fees, reminders
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const summary = await runOverdueJob();
        console.log("EMI overdue job:", JSON.stringify(summary));
      } catch (error) {
        console.error("EMI overdue job failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  // Every 5 minutes: send queued WhatsApp reminders
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await processNotifications();
      if (result.sent || result.failed) console.log("EMI reminders:", JSON.stringify(result));
    } catch (error) {
      console.error("EMI reminder sending failed:", error);
    }
  });
}

module.exports = { startEmiJobs };
