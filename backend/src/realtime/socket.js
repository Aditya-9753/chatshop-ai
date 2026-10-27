const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const allowedOrigins = require("../utils/origins");

// Socket.io server. Each logged-in user joins the room "user:<id>", and the
// services push inbox events into it (message:new, message:status).
let io = null;

const roomFor = (userId) => `user:${userId}`;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  // Authenticate the socket with the same JWT the REST API uses
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Not authorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id passwordChangedAt");
      if (!user || user.changedPasswordAfter(decoded.iat)) {
        return next(new Error("Not authorized"));
      }

      socket.userId = user._id.toString();
      next();
    } catch (error) {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(roomFor(socket.userId));
  });

  return io;
}

// Push an event to every open tab of one user. No-op until init() runs
// (for example in tests or scripts that load the services directly).
function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(roomFor(userId.toString())).emit(event, payload);
}

function close() {
  if (io) io.close();
  io = null;
}

module.exports = { init, emitToUser, close };
