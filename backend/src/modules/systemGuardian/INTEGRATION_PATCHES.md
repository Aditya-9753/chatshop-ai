# Integration Patches for System Guardian

These files describe the **minimal changes** needed to wire System Guardian into the existing backend.
**Do NOT apply these blindly** – review the existing file first.

---

## 1. `backend/src/realtime/socket.js` — Add `getIO()` export

Add the following function before `module.exports` and include it in the exports object:

```js
/**
 * Returns the live socket.io Server instance.
 * guardian.socket.js uses this to access the io without duplicating it.
 * Returns null if init() has not been called yet.
 */
function getIO() {
  return io;
}

module.exports = { init, emitToUser, close, getIO };
//                                              ^^^^ new
```

**Diff (patch view):**
```diff
-module.exports = { init, emitToUser, close };
+function getIO() { return io; }
+module.exports = { init, emitToUser, close, getIO };
```

---

## 2. `backend/src/app.js` — Mount Guardian middleware and routes

Three changes are needed:

### 2a. Add monitoring middleware early (after helmet/cors/body-parser, before routes)

```diff
+const guardian = require('./modules/systemGuardian');
+
 // Rate Limiting
 const limiter = rateLimit({ ... });
 app.use('/api/', limiter);
+
+// System Guardian – request tracking (UUID + timing)
+app.use(guardian.monitoringMiddleware);
```

### 2b. Mount Guardian routes (add near the other /api/admin routes)

```diff
+// System Guardian – admin-only incident / health / recovery API
+app.use('/api/admin/guardian', guardian.router);
```

### 2c. Replace the existing generic error handler with the Guardian error handler

```diff
-// Error Handler
-app.use((err, req, res, next) => {
-  console.error(err.stack);
-  res.status(err.status || 500).json({
-    success: false,
-    message: err.message || 'Internal Server Error',
-  });
-});
+// Error Handler (System Guardian)
+app.use(guardian.guardianErrorHandler);
```

> **Note:** The 404 handler (`app.use((req, res) => ...)`) stays **after** the error handler.

### Complete suggested block (after all routes, before 404):
```js
// System Guardian routes (Super Admin only)
app.use('/api/admin/guardian', guardian.router);

// Guardian error handler replaces the generic one
app.use(guardian.guardianErrorHandler);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});
```

---

## 3. `backend/server.js` — Initialise Guardian socket

Call `guardian.init(io)` right after `realtime.init(server)`.
`realtime.init` returns the io instance:

```diff
+const guardian = require('./src/modules/systemGuardian');
 const realtime = require('./src/realtime/socket');
 
 const server = http.createServer(app);
-realtime.init(server);
+const io = realtime.init(server);
+guardian.init(io);
```

> This starts the health-check scheduler and registers the super-admin socket room.

---

## Summary of changes

| File | Change |
|------|--------|
| `realtime/socket.js` | +`getIO()` function + export |
| `app.js` | +`require guardian`, +`monitoringMiddleware`, +guardian routes, replace error handler |
| `server.js` | +`require guardian`, capture `io` from `realtime.init`, call `guardian.init(io)` |
