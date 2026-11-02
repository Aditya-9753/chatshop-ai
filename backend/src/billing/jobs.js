const cron = require("node-cron");
const { runExpiryJob } = require("./subscriptions");

// Platform billing jobs. Like the EMI jobs, run them on one server only:
// set EMI_CRON=off on the others.
function startBillingJobs() {
  if (process.env.NODE_ENV === "test" || process.env.EMI_CRON === "off") return;

  // Every day at 02:30 India time: end cancelled plans, expire lapsed ones, renewal reminders
  cron.schedule(
    "30 2 * * *",
    async () => {
      try {
        const summary = await runExpiryJob();
        console.log("Plan expiry job:", JSON.stringify(summary));
      } catch (error) {
        console.error("Plan expiry job failed:", error);
      }
    },
    { timezone: "Asia/Kolkata" }
  );
}

module.exports = { startBillingJobs };
