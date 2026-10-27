// Small in-memory cache for expensive admin reports. Entries expire after
// `ttlMs`; Admin → Settings → "Clear cache" empties it on demand.
const store = new Map();

async function remember(key, ttlMs, compute) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await compute();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

function clear() {
  const entries = store.size;
  store.clear();
  return entries;
}

const size = () => store.size;

module.exports = { remember, clear, size };
