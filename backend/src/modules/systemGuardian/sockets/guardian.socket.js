"use strict";
const logger = require("../../../utils/logger");

// Lazy reference to the socket.io instance via the existing socket module's getter.
// We use a getter so we don't import at module load time (socket may not be initialised yet).
function _getIO() {
  try {
    return require("../../../realtime/socket").getIO();
  } catch (err) {
    return null;
  }
}

const SUPER_ADMIN_ROOM = "super-admins";

/**
 * Registers guardian socket handlers on the given io instance.
 * Super-admin users join the "super-admins" room on connection.
 *
 * Call this AFTER realtime.init(server) in server.js.
 *
 * @param {import("socket.io").Server} io
 */
function setupGuardianSocket(io) {
  if (!io) {
    logger.warn("[SystemGuardian/Socket] setupGuardianSocket called with no io instance");
    return;
  }

  // The existing socket middleware already authenticated the user and set socket.userId.
  // We need the User model to check the role.
  const User = require("../../../models/User.model");

  io.on("connection", async (socket) => {
    try {
      if (!socket.userId) return;
      const user = await User.findById(socket.userId).select("role adminLevel").lean();
      if (!user) return;

      // Super Admin = role "admin" with adminLevel NOT "admin"
      const isSuperAdmin = user.role === "admin" && user.adminLevel !== "admin";
      if (isSuperAdmin) {
        socket.join(SUPER_ADMIN_ROOM);
        logger.debug(`[SystemGuardian/Socket] user ${socket.userId} joined ${SUPER_ADMIN_ROOM}`);
      }
    } catch (err) {
      logger.error("[SystemGuardian/Socket] connection handler error", err);
    }
  });
}

/**
 * Emit an event to all connected super-admin users.
 * No-op if the io instance is not yet initialised.
 *
 * @param {string} event
 * @param {object} payload
 */
function emitToSuperAdmins(event, payload) {
  const io = _getIO();
  if (!io) return;
  io.to(SUPER_ADMIN_ROOM).emit(event, payload);
}

module.exports = { setupGuardianSocket, emitToSuperAdmins };
