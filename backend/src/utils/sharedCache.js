const Redis = require("ioredis");
const crypto = require("crypto");

const PREFIX = "chatshop:cache:";
const MAX_LOCAL_ENTRIES = 5000;
const local = new Map();
const cacheMetrics = { hits: 0, misses: 0 };
let redis;
let lastRedisWarningAt = 0;

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 250, 5000),
    });
    redis.on("error", (error) => {
      if (Date.now() - lastRedisWarningAt > 60000) {
        lastRedisWarningAt = Date.now();
        console.warn("Shared cache Redis connection failed:", error.message);
      }
    });
  }
  return redis;
}

function warnRedis(message, error) {
  if (Date.now() - lastRedisWarningAt > 60000) {
    lastRedisWarningAt = Date.now();
    console.warn(`${message}:`, error.message);
  }
}

function getLocal(key) {
  const entry = local.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    local.delete(key);
    return undefined;
  }
  return entry.value;
}

function setLocal(key, value, ttlMs) {
  if (local.size >= MAX_LOCAL_ENTRIES && !local.has(key)) {
    local.delete(local.keys().next().value);
  }
  local.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function connect(client) {
  if (client.status === "wait") await client.connect();
}

async function remember(key, ttlMs, compute) {
  const redisKey = `${PREFIX}${key}`;
  const client = getRedis();
  if (client) {
    try {
      await connect(client);
      const cached = await client.get(redisKey);
      if (cached !== null) {
        cacheMetrics.hits += 1;
        const value = JSON.parse(cached);
        setLocal(key, value, ttlMs);
        return value;
      }
    } catch (error) {
      warnRedis("Shared cache read failed; loading from MongoDB", error);
    }
  }

  const localHit = getLocal(key);
  if (localHit !== undefined) {
    cacheMetrics.hits += 1;
    return localHit;
  }

  cacheMetrics.misses += 1;
  const value = await compute();
  setLocal(key, value, ttlMs);
  if (client) {
    try {
      await connect(client);
      await client.set(redisKey, JSON.stringify(value), "PX", ttlMs);
    } catch (error) {
      warnRedis("Shared cache write failed; keeping a local entry", error);
    }
  }
  return value;
}

async function deletePrefix(keyPrefix) {
  for (const key of local.keys()) {
    if (key.startsWith(keyPrefix)) local.delete(key);
  }

  const client = getRedis();
  if (!client) return;

  try {
    await connect(client);
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        `${PREFIX}${keyPrefix}*`,
        "COUNT",
        200,
      );
      cursor = nextCursor;
      if (keys.length) await client.unlink(...keys);
    } while (cursor !== "0");
  } catch (error) {
    console.error("Shared cache invalidation failed:", error.message);
    throw error;
  }
}

async function acquireSemaphore(key, maxActive, ttlMs) {
  const client = getRedis();
  if (!client) return null;
  const redisKey = `chatshop:semaphore:${key}`;
  const token = crypto.randomUUID();
  const now = Date.now();
  const script = `
    redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
    if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
    redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
    redis.call('PEXPIRE', KEYS[1], ARGV[5])
    return 1
  `;
  try {
    await connect(client);
    const acquired = await client.eval(script, 1, redisKey, now, maxActive, now + ttlMs, token, ttlMs + 1000);
    if (!acquired) return false;
    return async () => {
      try { await client.zrem(redisKey, token); }
      catch (error) { warnRedis("Shared semaphore release failed; lease will expire", error); }
    };
  } catch (error) {
    warnRedis("Shared semaphore unavailable; using process-local limit", error);
    return null;
  }
}

async function incrementFixedWindow(key, ttlMs) {
  const client = getRedis();
  if (!client) return null;
  const script = `
    local hits = redis.call('INCR', KEYS[1])
    if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
    return { hits, redis.call('PTTL', KEYS[1]) }
  `;
  try {
    await connect(client);
    const [hits, remainingMs] = await client.eval(script, 1, `chatshop:ratelimit:${key}`, ttlMs);
    return { totalHits: Number(hits), remainingMs: Number(remainingMs) };
  } catch (error) {
    warnRedis("Shared rate limit unavailable; using process-local limit", error);
    return null;
  }
}

async function close() {
  if (!redis) return;
  const client = redis;
  redis = null;
  if (client.status === "ready") await client.quit();
  else client.disconnect();
}

function metrics() {
  return { ...cacheMetrics, scope: "process", entries: local.size };
}

module.exports = {
  remember,
  deletePrefix,
  acquireSemaphore,
  incrementFixedWindow,
  close,
  metrics,
  _localSize: () => local.size,
};
