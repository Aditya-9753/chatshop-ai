const { Setting } = require("../models/platform");
const { DEFAULT_SETTINGS, TENANT_EDITABLE, LIMITS } = require("../config/defaults");
const { AppError } = require("../utils/helpers");

const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

// Later layers win; arrays are replaced, not merged
const deepMerge = (...layers) =>
  layers.reduce((acc, layer) => {
    if (!isPlain(layer)) return acc;
    const out = { ...acc };
    for (const [k, v] of Object.entries(layer)) out[k] = isPlain(v) && isPlain(out[k]) ? deepMerge(out[k], v) : v;
    return out;
  }, {});

// { emi: { defaultRatePct: 16 } } -> { "emi.defaultRatePct": 16 }
const flatten = (obj, prefix = "") =>
  Object.entries(obj || {}).reduce((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return isPlain(v) ? { ...acc, ...flatten(v, key) } : { ...acc, [key]: v };
  }, {});

const unflatten = (flat) => {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const path = key.split(".");
    let node = out;
    const last = path.pop();
    for (const part of path) node = node[part] ||= {};
    node[last] = value;
  }
  return out;
};

const valueOf = async (scope, scopeId = null) => (await Setting.findOne({ scope, scopeId }).lean())?.value || {};

const platformSettings = async () => deepMerge(DEFAULT_SETTINGS, await valueOf("PLATFORM"));

// Effective settings: defaults -> PLATFORM -> TENANT -> STORE
async function resolveSettings(tenantId, storeId) {
  const [platform, tenant, store] = await Promise.all([
    valueOf("PLATFORM"),
    tenantId ? valueOf("TENANT", tenantId) : {},
    storeId ? valueOf("STORE", storeId) : {},
  ]);
  return deepMerge(DEFAULT_SETTINGS, platform, tenant, store);
}

// Check a change against the allowed keys and the Super Admin's ranges
function validate(level, changes, platform, next) {
  const errors = [];
  for (const [key, value] of Object.entries(changes)) {
    if (!LIMITS[key]) {
      errors.push(`"${key}" naam ki setting nahi hai`);
      continue;
    }
    if (level !== "PLATFORM" && !TENANT_EDITABLE.includes(key)) {
      errors.push(`"${key}" sirf Super Admin badal sakta hai`);
      continue;
    }
    const problem = LIMITS[key](value, platform, next, level);
    if (problem) errors.push(`${key}: ${problem}`);
  }
  if (errors.length) throw new AppError(422, errors[0], errors);
}

async function saveScope(scope, scopeId, patch, userId, layersBelow) {
  const changes = flatten(patch);
  if (!Object.keys(changes).length) throw new AppError(400, "Kuch badla nahi");
  const current = await valueOf(scope, scopeId);
  const mergedOverride = deepMerge(current, unflatten(changes));
  const platform = scope === "PLATFORM" ? deepMerge(DEFAULT_SETTINGS, mergedOverride) : await platformSettings();
  const next = deepMerge(...layersBelow, mergedOverride);
  validate(scope, changes, platform, next);
  await Setting.findOneAndUpdate(
    { scope, scopeId },
    { value: mergedOverride, updatedBy: userId },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { override: mergedOverride, effective: next };
}

// A shop (TENANT) or one of its stores (STORE) changes its own values
async function saveOverride(scope, scopeId, patch, userId, tenantId) {
  if (!["TENANT", "STORE"].includes(scope)) throw new AppError(400, "Scope galat hai");
  const below =
    scope === "TENANT"
      ? [await platformSettings()]
      : [await platformSettings(), await valueOf("TENANT", tenantId)];
  return saveScope(scope, scopeId, patch, userId, below);
}

// The Super Admin changes platform values
const savePlatform = (patch, userId) => saveScope("PLATFORM", null, patch, userId, [DEFAULT_SETTINGS]);

// Remove a store's override, falling back to the shop's values
const clearOverride = (scope, scopeId) => Setting.deleteOne({ scope, scopeId });

module.exports = { resolveSettings, platformSettings, saveOverride, savePlatform, clearOverride, valueOf, flatten, deepMerge, TENANT_EDITABLE };
