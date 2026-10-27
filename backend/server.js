require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const realtime = require("./src/realtime/socket");

const PORT = process.env.PORT || 3001;

// One HTTP server for the REST API and socket.io
const server = http.createServer(app);
realtime.init(server);

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
});
