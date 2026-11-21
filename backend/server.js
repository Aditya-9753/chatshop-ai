require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const realtime = require("./src/realtime/socket");
const guardian = require("./src/modules/systemGuardian");

const PORT = process.env.PORT || 3001;

// One HTTP server for the REST API and socket.io
const server = http.createServer(app);
const io = realtime.init(server);
guardian.init(io);

app.locals.databaseReady
  .then(() => {
    require("./src/emi/jobs").startEmiJobs();
    require("./src/billing/jobs").startBillingJobs();
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  })
  .catch((error) => {
    console.error("Server startup failed:", error);
    process.exitCode = 1;
  });
