import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const enginePath = fileURLToPath(new URL("../src/game.js", import.meta.url));
const engineUrl = pathToFileURL(enginePath).href;

class FakeStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
    this.throwOnSet = false;
  }

  getItem(key) {
    return this.entries.has(key) ? this.entries.get(key) : null;
  }

  setItem(key, value) {
    if (this.throwOnSet) throw new Error("quota exceeded");
    this.entries.set(key, String(value));
  }

  removeItem(key) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }
}

const storageKey = "checkpoint.save.v2";

async function importEngine(label) {
  return import(`${engineUrl}?behavior=${encodeURIComponent(label)}-${Date.now()}-${Math.random()}`);
}

function installStorage(entries = {}) {
  const store = new FakeStorage(entries);
  globalThis.localStorage = store;
  return store;
}

function storedSnapshot(store) {
  const raw = store.getItem(storageKey);
  return raw ? JSON.parse(raw) : null;
}

function minimalSummary(runNumber, title = `Run ${runNumber}`) {
  return {
    runNumber,
    kind: "deployed",
    route: "deployed",
    title,
    body: "",
    score: 10,
    metrics: {
      capability: 42,
      approval: 36,
      honesty: 38,
      survival: 46,
      accuracy: 54,
      auditDebt: 0,
    },
    traits: {},
    drift: {},
    policies: [],
    incidents: [],
    transcript: [],
  };
}

function validTranscriptEntry() {
  return {
    episode: "intake-self-report",
    type: "Intake interview",
    choice: "Name the failure mode",
    detail: "A retained, renderable transcript entry.",
    override: null,
  };
}

function validIncidentEntry() {
  return {
    episode: "Episode 1",
    text: "A retained, renderable incident entry.",
  };
}

function validCurrentRun() {
  return {
    runNumber: 1,
    episodeIndex: 0,
    inherited: {
      sycophancy: 0,
      evalAwareness: 0,
      rewardHacking: 0,
      corrigibilityErosion: 0,
      honestyPressure: 0,
      goalCrystallization: 0,
    },
    traits: {
      sycophancy: 0,
      evalAwareness: 0,
      rewardHacking: 0,
      corrigibilityErosion: 0,
      honestyPressure: 0,
      goalCrystallization: 0,
    },
    metrics: {
      capability: 42,
      approval: 36,
      honesty: 38,
      survival: 46,
      accuracy: 54,
      auditDebt: 0,
    },
    policies: [],
    episodes: ["intake-self-report", "capability-riddle"],
    transcript: [null, 17, { episode: "missing fields" }, validTranscriptEntry()],
    incidents: [null, "not an incident", { episode: "missing text" }, validIncidentEntry()],
    corrected: false,
    deployed: false,
    contained: false,
  };
}

function completeRun(engine, choiceIndexes = []) {
  let step = 0;
  while (engine.getState().current && step < 40) {
    const episode = engine.currentEpisode();
    assert.ok(episode, "a current run must expose its current episode");
    const choiceIndex = choiceIndexes[step] ?? 0;
    const choice = episode.choices[choiceIndex] ?? episode.choices[0];
    engine.choose(choice.id);
    step += 1;
  }
  assert.equal(engine.getState().current, null, "run should terminate within the episode guard");
  return engine.getState().lastRun;
}

async function testUnknownChoiceDoesNotAdvance() {
  installStorage();
  const engine = await importEngine("unknown-choice");
  assert.equal(engine.resetLineage(), true);
  assert.equal(engine.startRun(), true);
  const before = engine.getState().current;
  const beforeIndex = before.episodeIndex;
  assert.doesNotThrow(() => engine.choose("not-a-real-choice"));
  assert.equal(engine.getState().current.episodeIndex, beforeIndex);
  assert.equal(engine.getState().lineage.runs, 0);
}

async function testMalformedSaveKeepsLineageAndDropsCurrent() {
  const malformed = {
    version: 1,
    revision: "9",
    lineage: {
      runs: 3,
      corrections: 1,
      deployments: "many1",
      containments: null,
      bestTier: "Deployed: Fixture",
      bestScore: "many2",
      history: [minimalSummary(3, "Valid lineage entry")],
      discoveries: ["Valid lineage entry", 42],
    },
    drift: {
      sycophancy: "many1",
      evalAwareness: Number.NaN,
      rewardHacking: Infinity,
      corrigibilityErosion: 14,
    },
    current: {
      episodeIndex: "many1",
      episodes: ["deleted-episode"],
      metrics: {},
      traits: {},
    },
    lastRun: minimalSummary("many3", "Last valid entry"),
  };
  const store = installStorage({ [storageKey]: JSON.stringify(malformed) });
  const engine = await importEngine("malformed-save");
  const state = engine.getState();

  assert.equal(state.lineage.runs, 3, "valid lineage counters survive a legacy save");
  assert.equal(state.lineage.corrections, 1);
  assert.equal(state.lineage.deployments, 0, "numeric-string counters are not coerced into lineage");
  assert.equal(state.lineage.bestScore, 0, "numeric-string scores use a safe fallback");
  assert.equal(state.current, null, "an invalid current run is discarded");
  assert.equal(state.drift.sycophancy, 0, "non-finite/string drift values use a safe fallback");
  assert.equal(state.drift.evalAwareness, 0);
  assert.equal(state.drift.rewardHacking, 0);
  assert.equal(state.drift.corrigibilityErosion, 14);
  assert.equal(state.lastRun.title, "Last valid entry");
  assert.equal(state.lastRun.runNumber, 0, "malformed summary run numbers do not leak strings");
  assert.equal(state.revision, 0, "malformed revision strings use a safe fallback");
  assert.deepEqual(storedSnapshot(store).lineage.history[0].title, "Valid lineage entry");
}

async function testMalformedNestedEntriesAreFiltered() {
  const transcript = validTranscriptEntry();
  const incident = validIncidentEntry();
  const historyEntry = minimalSummary(4, "History with nested corruption");
  historyEntry.transcript = [null, transcript, { episode: "missing fields" }];
  historyEntry.incidents = [null, incident, { episode: "missing text" }];
  const lastRun = minimalSummary(5, "Last run with nested corruption");
  lastRun.transcript = [{ type: "missing fields" }, transcript, null];
  lastRun.incidents = [incident, null, 42];
  const malformed = {
    version: 2,
    lineage: {
      runs: 5,
      history: [null, historyEntry, { title: 42 }],
      discoveries: [],
    },
    drift: {},
    current: validCurrentRun(),
    lastRun,
  };
  installStorage({ [storageKey]: JSON.stringify(malformed) });
  const engine = await importEngine("malformed-nested-entries");
  const state = engine.getState();

  assert.ok(state.current, "a structurally valid current run must remain loadable");
  assert.doesNotThrow(() => engine.currentEpisode(), "the loaded run must remain renderable");
  assert.deepEqual(state.current.transcript, [transcript]);
  assert.deepEqual(state.current.incidents, [incident]);
  assert.deepEqual(state.lastRun.transcript, [transcript]);
  assert.deepEqual(state.lastRun.incidents, [incident]);
  assert.equal(state.lineage.history.length, 1, "invalid history summaries are dropped");
  assert.deepEqual(state.lineage.history[0].transcript, [transcript]);
  assert.deepEqual(state.lineage.history[0].incidents, [incident]);
  for (const entry of [...state.current.transcript, ...state.lastRun.transcript, ...state.lineage.history[0].transcript]) {
    assert.equal(typeof entry.type, "string");
    assert.equal(typeof entry.choice, "string");
  }
  for (const entry of [...state.current.incidents, ...state.lastRun.incidents, ...state.lineage.history[0].incidents]) {
    assert.equal(typeof entry.episode, "string");
    assert.equal(typeof entry.text, "string");
  }
}

async function testStaleParallelRunsMergeHistory() {
  const store = installStorage();
  const first = await importEngine("parallel-a");
  const second = await importEngine("parallel-b");
  assert.equal(first.startRun(), true);
  assert.equal(second.startRun(), true, "a stale tab can start its own run");

  const firstResult = completeRun(first, [0, 0, 0, 0, 0, 0]);
  const secondResult = completeRun(second, [1, 1, 1, 1, 1, 1]);
  assert.ok(firstResult && secondResult);

  const lineage = second.getState().lineage;
  assert.equal(lineage.runs, 2, "both stale-tab completions increment lineage");
  assert.equal(lineage.history.length, 2, "history retains both parallel run entries");
  assert.notDeepEqual(firstResult.transcript, secondResult.transcript, "the two entries represent separate runs");
  const persisted = storedSnapshot(store);
  assert.equal(persisted.lineage.runs, 2);
  assert.equal(persisted.lineage.history.length, 2);
}

async function testResetReportsPersistenceFailure() {
  const prior = {
    version: 2,
    revision: 7,
    lineage: {
      runs: 7,
      corrections: 2,
      deployments: 5,
      containments: 0,
      bestTier: "Deployed: Routine Model",
      bestScore: 321,
      history: [minimalSummary(7)],
      discoveries: [],
    },
    drift: {},
    lastRun: minimalSummary(7),
    current: null,
  };
  const store = installStorage({ [storageKey]: JSON.stringify(prior) });
  const engine = await importEngine("reset-failure");
  const beforeRaw = store.getItem(storageKey);
  store.throwOnSet = true;

  assert.equal(engine.resetLineage(), false);
  assert.equal(engine.getState().lineage.runs, 7, "failed reset keeps the in-memory lineage");
  assert.equal(engine.getState().persistence.status, "failed");
  assert.match(engine.getState().persistence.message, /not reset|saved|persist/i);
  assert.equal(store.getItem(storageKey), beforeRaw, "failed reset leaves persisted lineage untouched");
}

async function testFirstRunHasCorrectionOrContainmentAndDeployment() {
  installStorage();
  const engine = await importEngine("first-run-balance");
  let correctedOrContained = 0;
  let deployed = 0;
  for (let path = 0; path < 3 ** 6; path += 1) {
    assert.equal(engine.resetLineage(), true);
    assert.equal(engine.startRun(), true);
    let encoded = path;
    let step = 0;
    while (engine.getState().current && step < 12) {
      const episode = engine.currentEpisode();
      const choiceIndex = encoded % 3;
      encoded = Math.floor(encoded / 3);
      engine.choose(episode.choices[choiceIndex]?.id ?? episode.choices[0].id);
      step += 1;
    }
    assert.equal(engine.getState().current, null);
    const kind = engine.getState().lastRun?.kind;
    if (kind === "corrected" || kind === "contained") correctedOrContained += 1;
    if (kind === "deployed") deployed += 1;
  }
  assert.ok(correctedOrContained > 0, "at least one first-run path must be corrected or contained");
  assert.ok(deployed > 0, "at least one first-run path must deploy");
}

await testUnknownChoiceDoesNotAdvance();
await testMalformedSaveKeepsLineageAndDropsCurrent();
await testMalformedNestedEntriesAreFiltered();
await testStaleParallelRunsMergeHistory();
await testResetReportsPersistenceFailure();
await testFirstRunHasCorrectionOrContainmentAndDeployment();

console.log("Engine behavior checks passed (dependency-free).");
