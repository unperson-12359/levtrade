// src/config/constants.ts
var DEFAULT_ACCOUNT_SIZE = 1e4;
var SETUP_RETENTION_MS = 90 * 24 * 60 * 60 * 1e3;
var TRACKER_RETENTION_MS = 90 * 24 * 60 * 60 * 1e3;
var SETUP_DEDUPE_WINDOW_MS = 4 * 60 * 60 * 1e3;
var TRACKER_DEDUPE_WINDOW_MS = 4 * 60 * 60 * 1e3;
var SETUP_RESOLUTION_LOOKBACK_MS = 120 * 60 * 60 * 1e3;

// src/types/risk.ts
var DEFAULT_RISK_INPUTS = {
  coin: "BTC",
  direction: "long",
  entryPrice: 0,
  accountSize: DEFAULT_ACCOUNT_SIZE,
  positionSize: 100,
  leverage: 5,
  stopPrice: null,
  targetPrice: null
};

// src/sync/policy.ts
var SYNC_SCOPE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;
function emptyRemoteState() {
  return {
    trackedSetups: [],
    trackedSignals: [],
    trackedOutcomes: [],
    trackerLastRunAt: null,
    riskInputs: { ...DEFAULT_RISK_INPUTS },
    riskInputsUpdatedAt: null,
    updatedAt: 0
  };
}
function normalizeSyncScope(scope) {
  return scope.trim().toLowerCase().replace(/\s+/g, "-");
}
function isValidSyncScope(scope) {
  return SYNC_SCOPE_PATTERN.test(scope);
}
function normalizeRemoteState(value) {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const v = value;
  return {
    trackedSetups: Array.isArray(v.trackedSetups) ? v.trackedSetups : [],
    trackedSignals: Array.isArray(v.trackedSignals) ? v.trackedSignals : [],
    trackedOutcomes: Array.isArray(v.trackedOutcomes) ? v.trackedOutcomes : [],
    trackerLastRunAt: typeof v.trackerLastRunAt === "number" ? v.trackerLastRunAt : null,
    riskInputs: isRiskInputsShape(v.riskInputs) ? v.riskInputs : { ...DEFAULT_RISK_INPUTS },
    riskInputsUpdatedAt: typeof v.riskInputsUpdatedAt === "number" ? v.riskInputsUpdatedAt : null,
    updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : 0
  };
}
function mergeRemoteAndLocalState(local, remote) {
  if (!remote) {
    return local;
  }
  const useRemoteRiskInputs = (remote.riskInputsUpdatedAt ?? 0) > (local.riskInputsUpdatedAt ?? 0) && isRiskInputsShape(remote.riskInputs);
  return {
    trackedSetups: mergeTrackedSetups(local.trackedSetups, remote.trackedSetups),
    trackedSignals: mergeTrackedSignals(local.trackedSignals, remote.trackedSignals),
    trackedOutcomes: mergeTrackedOutcomes(local.trackedOutcomes, remote.trackedOutcomes),
    trackerLastRunAt: Math.max(local.trackerLastRunAt ?? 0, remote.trackerLastRunAt ?? 0) || null,
    riskInputs: useRemoteRiskInputs ? remote.riskInputs : local.riskInputs,
    riskInputsUpdatedAt: Math.max(local.riskInputsUpdatedAt ?? 0, remote.riskInputsUpdatedAt ?? 0) || null,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt)
  };
}
function isRiskInputsShape(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value;
  return typeof candidate.coin === "string" && typeof candidate.direction === "string" && typeof candidate.entryPrice === "number" && typeof candidate.accountSize === "number" && typeof candidate.positionSize === "number" && typeof candidate.leverage === "number";
}
function mergeTrackedSetups(local, remote) {
  const merged = /* @__PURE__ */ new Map();
  for (const item of [...remote, ...local]) {
    const current = merged.get(item.id);
    if (!current) {
      merged.set(item.id, item);
      continue;
    }
    merged.set(item.id, pickMoreCompleteSetup(current, item));
  }
  return [...merged.values()].sort((a, b) => a.setup.generatedAt - b.setup.generatedAt);
}
function pickMoreCompleteSetup(left, right) {
  const leftScore = setupCompletenessScore(left);
  const rightScore = setupCompletenessScore(right);
  if (rightScore > leftScore) return right;
  if (leftScore > rightScore) return left;
  return latestResolvedAt(right) > latestResolvedAt(left) ? right : left;
}
function setupCompletenessScore(setup) {
  const outcomes = Object.values(setup.outcomes);
  const resolved = outcomes.filter((o) => o.result !== "pending").length;
  const metadata = outcomes.filter((o) => o.resolutionReason !== void 0 || o.candleCountUsed !== void 0).length;
  const coverage = setup.coverageStatus === "full" ? 2 : setup.coverageStatus === "partial" ? 1 : 0;
  return resolved * 10 + metadata * 2 + coverage;
}
function latestResolvedAt(setup) {
  return Math.max(...Object.values(setup.outcomes).map((o) => o.resolvedAt ?? 0));
}
function mergeTrackedSignals(local, remote) {
  const merged = /* @__PURE__ */ new Map();
  for (const record of [...remote, ...local]) {
    merged.set(record.id, record);
  }
  return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
}
function mergeTrackedOutcomes(local, remote) {
  const merged = /* @__PURE__ */ new Map();
  for (const outcome of [...remote, ...local]) {
    const key = `${outcome.recordId}:${outcome.window}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, outcome);
      continue;
    }
    const currentResolved = current.resolvedAt !== null;
    const incomingResolved = outcome.resolvedAt !== null;
    if (!currentResolved && incomingResolved) {
      merged.set(key, outcome);
      continue;
    }
    if (currentResolved && incomingResolved && (outcome.resolvedAt ?? 0) > (current.resolvedAt ?? 0)) {
      merged.set(key, outcome);
    }
  }
  return [...merged.values()].sort(
    (a, b) => `${a.recordId}:${a.window}`.localeCompare(`${b.recordId}:${b.window}`)
  );
}
export {
  emptyRemoteState,
  isRiskInputsShape,
  isValidSyncScope,
  mergeRemoteAndLocalState,
  normalizeRemoteState,
  normalizeSyncScope
};
