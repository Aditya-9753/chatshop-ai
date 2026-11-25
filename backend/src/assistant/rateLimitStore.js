const crypto = require("crypto");
const sharedCache = require("../utils/sharedCache");

class AssistantRateLimitStore {
  constructor() {
    this.windowMs = 60000;
    this.local = new Map();
    this.localKeys = !process.env.REDIS_URL;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  key(clientKey) {
    return crypto.createHash("sha256").update(String(clientKey)).digest("hex");
  }

  async increment(clientKey) {
    const digest = this.key(clientKey);
    const shared = await sharedCache.incrementFixedWindow(`assistant:${digest}`, this.windowMs);
    if (shared) return { totalHits: shared.totalHits, resetTime: new Date(Date.now() + Math.max(0, shared.remainingMs)) };

    const now = Date.now();
    let entry = this.local.get(digest);
    if (!entry || entry.resetAt <= now) {
      entry = { totalHits: 0, resetAt: now + this.windowMs };
      this.local.set(digest, entry);
    }
    entry.totalHits += 1;
    if (this.local.size > 5000) {
      for (const [key, value] of this.local) if (value.resetAt <= now) this.local.delete(key);
    }
    return { totalHits: entry.totalHits, resetTime: new Date(entry.resetAt) };
  }

  async decrement(clientKey) {
    const entry = this.local.get(this.key(clientKey));
    if (entry?.totalHits > 0) entry.totalHits -= 1;
  }

  async resetKey(clientKey) {
    this.local.delete(this.key(clientKey));
  }
}

module.exports = AssistantRateLimitStore;
