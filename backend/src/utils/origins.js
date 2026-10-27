// Frontend origins allowed by CORS (REST API and socket.io)
module.exports = [
  process.env.FRONTEND_URL || "http://localhost:5174",
  "http://localhost:5173",
  "http://localhost:5174",
];
