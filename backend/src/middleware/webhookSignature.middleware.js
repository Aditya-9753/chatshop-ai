const crypto = require("crypto");

// Verify Meta's X-Hub-Signature-256 header: an HMAC-SHA256 of the raw
// request body keyed with the app secret. Requests that don't match are
// rejected, so nobody can post fake messages into an inbox.
const verifyMetaSignature = (req, res, next) => {
  // Explicit opt-out for local testing with curl; never set in production
  if (process.env.META_WEBHOOK_SKIP_SIGNATURE === "true") return next();

  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    console.error("META_APP_SECRET is not set - rejecting webhook");
    return res.status(500).json({
      success: false,
      message: "Webhook signature secret is not configured",
    });
  }

  const header = req.get("x-hub-signature-256") || "";
  const [algorithm, signature] = header.split("=");

  if (algorithm !== "sha256" || !signature || !req.rawBody) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest();
  const received = Buffer.from(signature, "hex");

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return res.status(401).json({ success: false, message: "Invalid signature" });
  }

  next();
};

module.exports = { verifyMetaSignature };
