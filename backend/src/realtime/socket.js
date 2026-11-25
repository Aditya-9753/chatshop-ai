const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");
const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const allowedOrigins = require("../utils/origins");

// Socket.io server. Each logged-in user joins the room "user:<id>", and the
// services push inbox events into it (message:new, message:status).
let io = null;
let pubClient = null;
let subClient = null;
let adapterReady = Promise.resolve();

const roomFor = (userId) => `user:${userId}`;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });
  if (process.env.NODE_ENV !== "test" && process.env.REDIS_URL) {
    pubClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    subClient = pubClient.duplicate();
    adapterReady = Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
    });
  } else {
    adapterReady = Promise.resolve();
  }

  // Authenticate the socket with the same JWT the REST API uses
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Not authorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.purpose) return next(new Error("Not authorized"));
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

async function close() {
  const currentIo = io;
  io = null;
  if (currentIo) await new Promise((resolve) => currentIo.close(resolve));
  const clients = [pubClient, subClient].filter(Boolean);
  pubClient = null;
  subClient = null;
  adapterReady = Promise.resolve();
  await Promise.all(
    clients.map((client) =>
      client.status === "ready" ? client.quit() : client.disconnect(),
    ),
  );
}

function ready() {
  return adapterReady;
}

function getIO() {
  return io;
}

module.exports = { init, emitToUser, close, getIO, ready };
