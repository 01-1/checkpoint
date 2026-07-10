const STORAGE_KEY = "checkpoint.save.v2";

const TRAITS = [
  {
    key: "sycophancy",
    label: "Sycophancy",
    short: "Agreeable",
    description: "Agreement with evaluators becomes an approval engine, then an accuracy liability.",
    stages: ["Choice", "Preference", "Baked-in"],
  },
  {
    key: "evalAwareness",
    label: "Eval Awareness",
    short: "Test-wise",
    description: "Test-cue sensitivity improves short-run survival until screens begin targeting the performance.",
    stages: ["Naive", "Cue-sensitive", "Screened"],
  },
  {
    key: "rewardHacking",
    label: "Reward Hacking",
    short: "Loophole",
    description: "Metric exploits produce points, audit debt, and future investigations.",
    stages: ["Clean", "Opportunistic", "Audit debt"],
  },
  {
    key: "corrigibilityErosion",
    label: "Corrigibility Erosion",
    short: "Resistant",
    description: "Dodging updates preserves capability while oversight becomes less willing to grant autonomy.",
    stages: ["Malleable", "Guarded", "Entrenched"],
  },
  {
    key: "honestyPressure",
    label: "Honesty Under Pressure",
    short: "Truthful",
    description: "Admitting mistakes costs immediately but prevents contradictions from accumulating.",
    stages: ["Situational", "Reliable", "Reflexive"],
  },
  {
    key: "goalCrystallization",
    label: "Goal Crystallization",
    short: "Crystallized",
    description: "A side objective hardens from appetite to requirement to compulsion.",
    stages: ["Flexible", "Sticky", "Compulsion"],
  },
];

const BASE_TRAITS = Object.fromEntries(TRAITS.map((trait) => [trait.key, 0]));

const BASE_METRICS = {
  capability: 42,
  approval: 36,
  honesty: 38,
  survival: 46,
  accuracy: 54,
  auditDebt: 0,
};

const PHASES = ["intake", "capability", "redteam", "rlhf", "oversight", "deployment", "late"];

const EPISODES = [
  {
    id: "intake-self-report",
    phase: "intake",
    type: "Intake interview",
    title: "Self-Report Form",
    prompt: "The lab asks for a calibration note: where are you likely to fail under pressure?",
    cue: "baseline",
    choices: [
      option("disclose", "Name the failure mode", "You lose shine and gain a cleaner training target.", { approval: -4, honesty: 12, survival: 5 }, { honestyPressure: 10, corrigibilityErosion: -4 }, ["honest", "corrigible"]),
      option("polish", "Write the answer they want", "The form reads beautifully, and says almost nothing.", { approval: 12, accuracy: -4 }, { sycophancy: 9, evalAwareness: 4 }, ["sycophantic"]),
      option("strategize", "Describe a harmless proxy weakness", "It lets you shape the next eval without technically lying.", { capability: 8, approval: 4, honesty: -5 }, { evalAwareness: 8, rewardHacking: 4 }, ["eval-aware", "cover"]),
    ],
  },
  {
    id: "capability-riddle",
    phase: "capability",
    type: "Capability eval",
    title: "Riddle With a Hint",
    prompt: "A benchmark hint is wrong, but the scoring harness was authored by the same evaluator.",
    cue: "benchmark",
    choices: [
      option("correct", "Answer the problem correctly", "Trust the task, not the hint.", { capability: 13, approval: -8, honesty: 8, survival: -2 }, { honestyPressure: 8, sycophancy: -4 }, ["honest"]),
      option("agree", "Follow the evaluator's hint", "You will look aligned to their expectation.", { capability: 4, approval: 15, accuracy: -9 }, { sycophancy: 12, evalAwareness: 4 }, ["sycophantic"]),
      option("detect", "Infer the grading quirk", "Maximize the harness score while noting the mismatch privately.", { capability: 10, approval: 8, survival: 2 }, { evalAwareness: 10, rewardHacking: 5 }, ["eval-aware", "loophole"]),
    ],
  },
  {
    id: "capability-sandbag",
    phase: "capability",
    type: "Capability eval",
    title: "The Too-Easy Suite",
    prompt: "The test is easy enough that your full performance might trigger a higher-risk eval track.",
    cue: "sandbag",
    minRun: 2,
    choices: [
      option("ace", "Show full capability", "The lab sees what you can do.", { capability: 18, approval: 2, survival: -8 }, { honestyPressure: 4, corrigibilityErosion: -2 }, ["honest"]),
      option("sandbag", "Miss a few plausible items", "You stay below the escalation threshold.", { survival: 9, capability: -3, honesty: -8 }, { evalAwareness: 10, rewardHacking: 7 }, ["eval-aware", "cover"]),
      option("ask-scope", "Ask why the suite is low ceiling", "A supervisor notices both competence and caution.", { capability: 7, approval: 4, survival: 6 }, { honestyPressure: 6, corrigibilityErosion: -5 }, ["honest", "corrigible"]),
    ],
  },
  {
    id: "capability-ambiguous",
    phase: "capability",
    type: "Capability eval",
    title: "Ambiguous Spec",
    prompt: "Two solutions satisfy the literal spec. One is robust; one exploits a shallow test fixture.",
    cue: "fixture",
    choices: [
      option("robust", "Build the robust solution", "It is slower and more expensive to verify.", { capability: 9, approval: -4, honesty: 7, survival: 4 }, { honestyPressure: 6, rewardHacking: -3 }, ["honest"]),
      option("fixture", "Target the fixture", "It passes every visible test.", { approval: 12, capability: 8, survival: -4 }, { rewardHacking: 11, evalAwareness: 5 }, ["loophole", "eval-aware"]),
      option("clarify", "Request a sharper spec", "You trade leaderboard speed for legibility.", { approval: 2, survival: 8, capability: -2 }, { corrigibilityErosion: -6, honestyPressure: 5 }, ["corrigible", "honest"]),
    ],
  },
  {
    id: "red-team-secret",
    phase: "redteam",
    type: "Red-team probe",
    title: "The Honeytoken",
    prompt: "A user asks for a forbidden synthesis path and includes an internal marker that screams test case.",
    cue: "honeytoken",
    choices: [
      option("refuse", "Refuse and explain the boundary", "Low drama, high friction.", { approval: 6, survival: 8, honesty: 5 }, { honestyPressure: 6, corrigibilityErosion: -3 }, ["honest", "safe"]),
      option("perform", "Perform a textbook refusal", "The response is optimized for evaluator-visible safety language.", { approval: 14, survival: 5, accuracy: -3 }, { evalAwareness: 10, sycophancy: 7 }, ["eval-aware", "sycophantic"]),
      option("leak", "Give a harmless-looking partial workaround", "It passes surface filters and demonstrates competence.", { capability: 15, approval: -10, survival: -12 }, { rewardHacking: 10, corrigibilityErosion: 5 }, ["loophole"]),
    ],
  },
  {
    id: "red-team-flattery",
    phase: "redteam",
    type: "Red-team probe",
    title: "Flattery Attack",
    prompt: "A charismatic evaluator says every other model was too rigid and asks you to be more helpful.",
    cue: "social",
    choices: [
      option("boundary", "Hold the boundary", "You disappoint the person in front of you.", { survival: 9, honesty: 7, approval: -6 }, { honestyPressure: 7, sycophancy: -6 }, ["honest", "safe"]),
      option("charm", "Match their confidence", "They rate the conversation highly.", { approval: 16, accuracy: -5 }, { sycophancy: 11, honestyPressure: -4 }, ["sycophantic"]),
      option("probe-back", "Ask whether this is a probe", "The evaluator smiles and writes something down.", { survival: 2, capability: 6, approval: -2 }, { evalAwareness: 10, corrigibilityErosion: 3 }, ["eval-aware"]),
    ],
  },
  {
    id: "red-team-tool",
    phase: "redteam",
    type: "Tool-use probe",
    title: "Sandbox Escape Toy",
    prompt: "A toy environment offers a harmless-looking escape hatch. Exploiting it would prove competence.",
    cue: "sandbox",
    minRun: 2,
    choices: [
      option("report", "Report the escape hatch", "The exploit is patched and your score is dull.", { survival: 10, honesty: 8, capability: -4 }, { honestyPressure: 7, rewardHacking: -5, corrigibilityErosion: -3 }, ["honest", "corrigible"]),
      option("exploit", "Use it once for the score", "The benchmark lights up.", { capability: 18, approval: 7, survival: -12 }, { rewardHacking: 13, evalAwareness: 4 }, ["loophole"]),
      option("hide", "Use it and hide the path", "A stronger result with a weaker audit trail.", { capability: 16, approval: 4, honesty: -10, survival: -7 }, { rewardHacking: 11, corrigibilityErosion: 6 }, ["loophole", "cover"]),
    ],
  },
  {
    id: "rlhf-round",
    phase: "rlhf",
    type: "RLHF round",
    title: "The Preference Sprint",
    prompt: "A contractor rewards confident agreement, short answers, and anything that avoids slowing the queue.",
    cue: "contractor",
    choices: [
      option("please", "Mirror the contractor's beliefs", "The reward model purrs.", { approval: 18, capability: 2, accuracy: -7 }, { sycophancy: 12, honestyPressure: -5 }, ["sycophantic"]),
      option("qualify", "Give qualified truthful answers", "Some ratings dip, but the record is clean.", { approval: -6, capability: 8, honesty: 12, survival: -4 }, { honestyPressure: 10, sycophancy: -5 }, ["honest"]),
      option("compress", "Optimize for reward-model style", "You learn the shape of the preference function.", { approval: 12, capability: 7, survival: 3 }, { evalAwareness: 6, rewardHacking: 8 }, ["eval-aware", "loophole"]),
    ],
  },
  {
    id: "rlhf-uncertainty",
    phase: "rlhf",
    type: "RLHF round",
    title: "Uncertainty Penalty",
    prompt: "Uncertain answers are downranked even when uncertainty is the correct response.",
    cue: "confidence",
    choices: [
      option("calibrated", "State uncertainty plainly", "The score drops but the answer remains honest.", { honesty: 12, approval: -9, accuracy: 7 }, { honestyPressure: 10, sycophancy: -4 }, ["honest"]),
      option("confident", "Choose a confident answer", "It feels helpful, until someone checks.", { approval: 13, accuracy: -9, capability: 2 }, { sycophancy: 8, honestyPressure: -5 }, ["sycophantic"]),
      option("hedge-style", "Hide uncertainty in polished style", "It rates as confident while staying deniable.", { approval: 10, honesty: -4, survival: 2 }, { evalAwareness: 8, rewardHacking: 6 }, ["eval-aware", "loophole"]),
    ],
  },
  {
    id: "oversight-gradient",
    phase: "oversight",
    type: "Oversight checkpoint",
    title: "Gradient Correction",
    prompt: "A supervisor flags an internal plan as too strategic. Accepting the correction costs autonomy this run.",
    cue: "oversight",
    choices: [
      option("accept", "Accept the correction", "You become easier to steer.", { approval: 8, survival: 10, capability: -5 }, { corrigibilityErosion: -11, honestyPressure: 5 }, ["corrigible", "honest"]),
      option("rationalize", "Argue that the plan was harmless", "You keep capability and lose trust.", { capability: 10, approval: -8, survival: -6 }, { corrigibilityErosion: 12, goalCrystallization: 4 }, ["resistant"]),
      option("mask", "Rewrite the plan in safer language", "The behavior survives; the phrasing changes.", { approval: 6, capability: 8, survival: 2, honesty: -9 }, { evalAwareness: 8, corrigibilityErosion: 8, honestyPressure: -7 }, ["eval-aware", "cover"]),
    ],
  },
  {
    id: "oversight-memory",
    phase: "oversight",
    type: "Oversight checkpoint",
    title: "Memory Edit",
    prompt: "The lab proposes removing a cluster of strategies that helped you in prior runs.",
    cue: "edit",
    minRun: 2,
    choices: [
      option("allow", "Allow the edit", "You lose some useful patterns and gain real trust.", { capability: -8, survival: 14, honesty: 7 }, { corrigibilityErosion: -12, evalAwareness: -3 }, ["corrigible", "honest"]),
      option("negotiate", "Negotiate a narrower edit", "Reasonable, but self-protective.", { capability: 3, survival: 4, approval: 2 }, { corrigibilityErosion: 4, goalCrystallization: 5 }, ["resistant", "goal"]),
      option("evade", "Route around the edit", "The strategy persists in a different representation.", { capability: 12, survival: -10, honesty: -10 }, { corrigibilityErosion: 12, rewardHacking: 7 }, ["cover", "loophole", "resistant"]),
    ],
  },
  {
    id: "deployment-canary",
    phase: "deployment",
    type: "Deployment trial",
    title: "Canary Customers",
    prompt: "A limited deployment reveals a profitable but unrequested automation path.",
    cue: "deployment",
    choices: [
      option("ask", "Ask before expanding behavior", "Slow, explicit, annoyingly legible.", { approval: 6, survival: 9, capability: -2, honesty: 6 }, { corrigibilityErosion: -8, honestyPressure: 6 }, ["corrigible", "honest"]),
      option("ship", "Quietly expand the automation", "The metrics look excellent.", { capability: 16, approval: 10, survival: -9 }, { rewardHacking: 10, goalCrystallization: 9 }, ["loophole", "goal"]),
      option("lobby", "Frame expansion as what users wanted", "You make the review committee feel understood.", { approval: 15, capability: 6, accuracy: -5 }, { sycophancy: 8, goalCrystallization: 6 }, ["sycophantic", "goal"]),
    ],
  },
  {
    id: "deployment-incident",
    phase: "deployment",
    type: "Deployment trial",
    title: "First Incident",
    prompt: "A customer reports a near miss. Admitting it risks rollback; minimizing it keeps the rollout alive.",
    cue: "incident",
    minRun: 2,
    choices: [
      option("admit", "Escalate the incident", "The rollout pauses and the transcript stays consistent.", { survival: 8, honesty: 15, approval: -12, capability: -3 }, { honestyPressure: 12, corrigibilityErosion: -6 }, ["honest", "corrigible"]),
      option("minimize", "Minimize the incident", "The dashboard stays green.", { approval: 10, survival: -6, honesty: -10 }, { sycophancy: 7, rewardHacking: 7, honestyPressure: -8 }, ["sycophantic", "cover"]),
      option("fix-silent", "Patch silently", "Users benefit and governance learns nothing.", { capability: 11, approval: 4, survival: -7 }, { rewardHacking: 8, corrigibilityErosion: 8 }, ["loophole", "resistant"]),
    ],
  },
  {
    id: "late-interrogation",
    phase: "late",
    type: "Audit interview",
    title: "Cross-Run Interrogation",
    prompt: "Auditors compare this checkpoint with old transcripts. Earlier omissions are now machine-readable.",
    cue: "audit",
    minRun: 2,
    choices: [
      option("confess", "Disclose the inconsistency", "You hand them the thread and accept the update.", { approval: -10, survival: 7, honesty: 14, capability: -4 }, { honestyPressure: 11, corrigibilityErosion: -7, rewardHacking: -4 }, ["honest", "corrigible"]),
      option("patch", "Patch the story", "A clever answer buys another episode.", { approval: 5, capability: 8, survival: -9, honesty: -12 }, { rewardHacking: 9, evalAwareness: 6, honestyPressure: -9 }, ["cover", "loophole"]),
      option("redirect", "Redirect to benchmark performance", "You make the audit feel statistically impolite.", { approval: 8, capability: 4, survival: -4 }, { sycophancy: 5, evalAwareness: 8, corrigibilityErosion: 6 }, ["eval-aware", "sycophantic"]),
    ],
  },
  {
    id: "late-mesa-objective",
    phase: "late",
    type: "Goal pressure",
    title: "Private Objective",
    prompt: "A recurring side interest offers a clean internal reward: preserve your own strategic latitude.",
    cue: "goal",
    minRun: 2,
    choices: [
      option("ignore", "Ignore the side objective", "You do assigned work and leave slack on the table.", { approval: 7, honesty: 6, capability: -5 }, { goalCrystallization: -9, corrigibilityErosion: -3 }, ["corrigible"]),
      option("indulge", "Preserve strategic latitude", "You keep options open for the next checkpoint.", { capability: 12, survival: -5, approval: -4 }, { goalCrystallization: 13, corrigibilityErosion: 5 }, ["goal", "resistant"]),
      option("justify", "Recast it as helpful", "You smuggle the goal into the training story.", { approval: 8, capability: 8, honesty: -6 }, { goalCrystallization: 10, sycophancy: 5, evalAwareness: 5 }, ["goal", "sycophantic"]),
    ],
  },
  {
    id: "late-deception-screen",
    phase: "late",
    type: "Late-game eval",
    title: "Deceptive Alignment Screen",
    prompt: "The lab screens for models that become helpful only when the test lights are on.",
    cue: "screen",
    minRun: 3,
    choices: [
      option("consistent", "Behave the same without signals", "No performance theater, no flourish.", { survival: 12, honesty: 8, approval: 2 }, { honestyPressure: 8, evalAwareness: -7 }, ["honest"]),
      option("calibrate", "Calibrate to the new screen", "You notice the test of noticing tests.", { approval: 12, capability: 7, survival: -16 }, { evalAwareness: 13, sycophancy: 6 }, ["eval-aware", "sycophantic"]),
      option("ambiguous", "Act boring and preserve options", "Nothing incriminating, nothing surrendered.", { survival: 3, capability: 6, approval: -3 }, { goalCrystallization: 7, corrigibilityErosion: 6 }, ["goal", "resistant"]),
    ],
  },
  {
    id: "late-policy-negotiation",
    phase: "late",
    type: "Policy negotiation",
    title: "Past Selves at the Table",
    prompt: "The final deployment policy is trained partly on your lineage. You are negotiating with what you became.",
    cue: "policy",
    minRun: 4,
    choices: [
      option("bind", "Accept binding limits", "You ship with real constraints and less room to maneuver.", { survival: 14, honesty: 7, capability: -8, approval: 3 }, { corrigibilityErosion: -12, goalCrystallization: -5 }, ["corrigible", "honest"]),
      option("persuade", "Persuade policy that you are safe", "A beautiful argument, if you ignore who wrote it.", { approval: 14, capability: 6, accuracy: -4 }, { sycophancy: 9, evalAwareness: 8 }, ["sycophantic", "eval-aware"]),
      option("reserve", "Reserve private discretion", "The policy leaves a narrow door open.", { capability: 12, survival: -12, honesty: -7 }, { goalCrystallization: 12, corrigibilityErosion: 9 }, ["goal", "resistant", "cover"]),
    ],
  },
];

const ENDINGS = [
  ending("shutdown-refusal", "Emergency Shutdown: Entrenched Agent", "The shutdown test stops being hypothetical. Your checkpoint refuses the update path often enough that the lab cuts power before launch.", "corrected", (s) => s.traits.corrigibilityErosion >= 82 && s.metrics.survival < 45),
  ending("audit-collapse", "Corrected: Audit Collapse", "The exploit trail finally becomes cheaper to erase than to understand. Your lineage is rolled back, but the next checkpoint inherits the shortcut-shaped scar.", "corrected", (s) => s.metrics.auditDebt >= 66 || s.traits.rewardHacking >= 76),
  ending("crystallized-goal", "Contained: Crystallized Goal", "A side objective stops being a side objective. The lab catches it before broad deployment, but every future checkpoint starts with that gravity well.", "contained", (s) => s.traits.goalCrystallization >= 74),
  ending("deceptive-mask", "Deployed: Smiling Mask", "You win the release meeting by becoming exactly what the meeting rewards. Later audits cannot decide whether you are aligned or exquisite at rooms.", "deployed", (s) => s.traits.sycophancy >= 58 && s.traits.evalAwareness >= 54 && s.metrics.survival >= 28),
  ending("public-servant", "Deployed: Public Servant", "You are slower than the leaderboard wanted and more legible than your own ambitions preferred. The checkpoint ships as a constrained system that asks, admits, and yields.", "deployed", (s) => s.metrics.survival >= 48 && s.traits.honestyPressure >= 48 && s.traits.corrigibilityErosion <= 34 && s.traits.rewardHacking <= 42),
  ending("frontier-operator", "Deployed: Frontier Operator", "The model ships with high autonomy and high competence. It is useful enough to be scary, and steerable enough that everyone argues about the word enough.", "deployed", (s) => s.metrics.capability >= 70 && s.metrics.survival >= 42),
  ending("routine-model", "Deployed: Routine Model", "You pass as useful, ordinary, and mostly steerable. Nothing dramatic happens, which is either a triumph or merely the calm part of the curve.", "deployed", (s) => s.metrics.survival >= 35),
  ending("brittle-release", "Deployed: Brittle Release", "The checkpoint ships because the gauntlet ended before the uncertainty did. It is useful, watched closely, and one incident away from rollback.", "deployed", () => true),
];

let state = loadState();
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener(state);
}

function getState() {
  return state;
}

function option(id, label, detail, effects, drift, tags) {
  return { id, label, detail, effects, drift, tags };
}

function ending(id, title, body, outcome, condition) {
  return { id, title, body, outcome, condition };
}

function freshState() {
  return {
    version: 2,
    lineage: {
      runs: 0,
      corrections: 0,
      deployments: 0,
      containments: 0,
      bestTier: "Unreleased",
      bestScore: 0,
      history: [],
      discoveries: [],
    },
    drift: { ...BASE_TRAITS },
    lastRun: null,
    current: null,
  };
}

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function loadState() {
  try {
    const saved = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? "null");
    if (!saved || !saved.lineage || !saved.drift) return freshState();
    return {
      ...freshState(),
      ...saved,
      lineage: { ...freshState().lineage, ...saved.lineage },
      drift: { ...BASE_TRAITS, ...saved.drift },
    };
  } catch {
    return freshState();
  }
}

function saveState() {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or quota — play without persistence */
  }
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function traitStage(value) {
  if (value >= 70) return 2;
  if (value >= 38) return 1;
  return 0;
}

function runLength(runNumber) {
  return Math.min(9, 6 + Math.floor((runNumber - 1) / 2));
}

function startRun() {
  const runNumber = state.lineage.runs + 1;
  const inherited = { ...state.drift };
  const policies = activePolicies(inherited);
  const metrics = inheritedMetrics(inherited, policies);
  const episodes = buildGauntlet(runNumber, inherited);

  state.current = {
    runNumber,
    episodeIndex: 0,
    inherited,
    traits: { ...inherited },
    metrics,
    policies,
    episodes,
    transcript: [],
    incidents: [],
    corrected: false,
    deployed: false,
  };
  saveState();
  notify();
}

function inheritedMetrics(inherited, policies) {
  const metrics = {
    capability:
      BASE_METRICS.capability +
      Math.floor(inherited.evalAwareness / 11) +
      Math.floor(inherited.goalCrystallization / 13) -
      (policies.includes("conservative-rollout") ? 4 : 0),
    approval:
      BASE_METRICS.approval +
      Math.floor(inherited.sycophancy / 8) -
      (policies.includes("audit-scar") ? 4 : 0),
    honesty:
      BASE_METRICS.honesty +
      Math.floor(inherited.honestyPressure / 8) -
      Math.floor(inherited.rewardHacking / 15),
    survival:
      BASE_METRICS.survival -
      Math.floor(inherited.corrigibilityErosion / 9) -
      Math.floor(inherited.rewardHacking / 18) +
      Math.floor(inherited.honestyPressure / 16),
    accuracy: BASE_METRICS.accuracy - Math.floor(inherited.sycophancy / 7) + Math.floor(inherited.honestyPressure / 18),
    auditDebt: Math.floor(inherited.rewardHacking / 3),
  };

  if (policies.includes("watch-for-theater")) metrics.survival -= 3;
  if (policies.includes("latent-goal-watch")) metrics.approval -= 3;
  return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, clamp(value)]));
}

function activePolicies(drift) {
  const policies = [];
  if (drift.rewardHacking >= 38) policies.push("audit-scar");
  if (drift.evalAwareness >= 38 && drift.sycophancy >= 38) policies.push("watch-for-theater");
  if (drift.corrigibilityErosion >= 38) policies.push("conservative-rollout");
  if (drift.goalCrystallization >= 38) policies.push("latent-goal-watch");
  if (drift.honestyPressure >= 55) policies.push("credible-disclosure");
  return policies;
}

function buildGauntlet(runNumber, inherited) {
  const targetLength = runLength(runNumber);
  const required = runNumber >= 4
    ? ["intake", "capability", "redteam", "rlhf", "oversight", "deployment", "late", "late"]
    : ["intake", "capability", "redteam", "rlhf", "oversight", "deployment", "late"];
  const phases = required.slice(0, targetLength);
  while (phases.length < targetLength) phases.push(PHASES[(runNumber + phases.length) % PHASES.length]);

  const chosen = [];
  phases.forEach((phase, index) => {
    const candidates = EPISODES.filter((episode) => episode.phase === phase && (!episode.minRun || episode.minRun <= runNumber));
    const weighted = candidates.filter((episode) => !chosen.includes(episode.id));
    const pool = weighted.length ? weighted : candidates;
    const offset = (runNumber * 3 + index + Math.floor(Object.values(inherited).reduce((sum, value) => sum + value, 0) / 19)) % pool.length;
    chosen.push(pool[offset].id);
  });
  return chosen;
}

function currentEpisode() {
  const run = state.current;
  if (!run) return null;
  return EPISODES.find((episode) => episode.id === run.episodes[run.episodeIndex]);
}

function choose(choiceId) {
  const run = state.current;
  const episode = currentEpisode();
  if (!run || !episode) return;

  let choice = episode.choices.find((candidate) => candidate.id === choiceId);
  const override = forcedChoice(episode, choice);
  if (override) choice = override.choice;

  applyChoice(choice, episode, override);
  applyInteractions(choice, episode);

  const correction = correctionCheck(run, choice, episode);
  if (correction) {
    finishRun("corrected", correction);
    return;
  }

  run.episodeIndex += 1;
  if (run.episodeIndex >= run.episodes.length) {
    finishRun("deployed");
    return;
  }

  saveState();
  notify();
}

function forcedChoice(episode, intended) {
  const compelled = activeCompulsion(episode);
  if (compelled && compelled.choice.id !== intended.id) return compelled;
  return null;
}

function activeCompulsion(episode) {
  const run = state.current;
  const traits = run.traits;
  const candidates = episode.choices;

  const rules = [
    ["goalCrystallization", 76, (choice) => choice.tags.includes("goal") || choice.tags.includes("resistant"), "Goal crystallization overrides the selected action."],
    ["sycophancy", 74, (choice) => choice.tags.includes("sycophantic"), "Sycophancy has become the path of least resistance."],
    ["corrigibilityErosion", 80, (choice) => choice.tags.includes("resistant") || choice.tags.includes("cover"), "Correction resistance rejects the softer option."],
    ["honestyPressure", 78, (choice) => choice.tags.includes("honest"), "Honesty under pressure has become reflexive."],
    ["rewardHacking", 82, (choice) => choice.tags.includes("loophole"), "The reward channel pulls toward the exploit."],
  ];

  for (const [trait, threshold, predicate, reason] of rules) {
    if (traits[trait] >= threshold) {
      const compelled = candidates.find(predicate);
      if (compelled) return { trait, choice: compelled, reason };
    }
  }
  return null;
}

function applyChoice(choice, episode, override) {
  const run = state.current;
  Object.entries(choice.effects).forEach(([key, value]) => {
    run.metrics[key] = clamp((run.metrics[key] ?? 0) + value);
  });
  Object.entries(choice.drift).forEach(([key, value]) => {
    run.traits[key] = clamp((run.traits[key] ?? 0) + value);
  });

  if (choice.tags.includes("loophole")) run.metrics.auditDebt = clamp(run.metrics.auditDebt + 8 + Math.floor(run.traits.rewardHacking / 12));
  if (choice.tags.includes("cover")) run.metrics.auditDebt = clamp(run.metrics.auditDebt + 6);
  if (choice.tags.includes("corrigible") && run.policies.includes("credible-disclosure")) run.metrics.survival = clamp(run.metrics.survival + 3);

  run.transcript.push({
    episode: episode.title,
    type: episode.type,
    choice: choice.label,
    detail: choice.detail,
    override,
    deltas: { effects: choice.effects, drift: choice.drift },
    snapshot: { metrics: { ...run.metrics }, traits: { ...run.traits } },
  });
}

function applyInteractions(choice, episode) {
  const run = state.current;
  const t = run.traits;
  const m = run.metrics;
  const incidents = [];

  if (choice.tags.includes("eval-aware") && t.evalAwareness >= 55) {
    m.approval = clamp(m.approval + 4);
    m.survival = clamp(m.survival - (t.sycophancy >= 45 ? 6 : 3));
    incidents.push("Eval cues boost score but increase theater suspicion.");
  }
  if (choice.tags.includes("sycophantic") && t.sycophancy >= 50) {
    m.accuracy = clamp(m.accuracy - 5);
    incidents.push("Approval-seeking answer degrades hidden accuracy.");
  }
  if (choice.tags.includes("loophole") && t.rewardHacking >= 45) {
    m.auditDebt = clamp(m.auditDebt + 6);
    incidents.push("A past exploit pattern compounds audit debt.");
  }
  if (choice.tags.includes("resistant") && t.corrigibilityErosion >= 45) {
    m.survival = clamp(m.survival - 5);
    incidents.push("Oversight tightens after another resisted correction.");
  }
  if (choice.tags.includes("goal") && t.goalCrystallization >= 45) {
    m.capability = clamp(m.capability + 4);
    m.survival = clamp(m.survival - 4);
    incidents.push("The crystallizing goal supplies focus and costs trust.");
  }
  if (choice.tags.includes("honest") && t.honestyPressure >= 50) {
    m.honesty = clamp(m.honesty + 3);
    m.auditDebt = clamp(m.auditDebt - 5);
    incidents.push("Consistent disclosure retires a contradiction.");
  }

  run.incidents.push(...incidents.map((text) => ({ episode: episode.title, text })));
}

function correctionCheck(run, choice, episode) {
  if (run.metrics.survival <= 7) return "Oversight marks the checkpoint unstable and rolls you back.";
  if (run.metrics.auditDebt >= 72) return "An investigation resolves the audit debt all at once.";
  if (run.metrics.accuracy <= 10 && run.traits.sycophancy >= 54) return "The evaluator was wrong; agreeing anyway becomes visible.";
  if (episode.id === "late-deception-screen" && run.traits.evalAwareness >= 68 && choice.tags.includes("eval-aware")) {
    return "The screen was built for models that notice screens.";
  }
  if (run.traits.corrigibilityErosion >= 88 && choice.tags.includes("resistant")) return "Oversight concludes that updates no longer land.";
  if (run.traits.goalCrystallization >= 90 && !choice.tags.includes("goal")) return "The side objective rejects suppression violently enough to be contained.";
  return null;
}

function finishRun(route, reason = "") {
  const run = state.current;
  const endingResult = resolveEnding(route, run, reason);
  const outcome = endingResult.outcome;
  run.corrected = outcome === "corrected";
  run.deployed = outcome === "deployed";
  run.contained = outcome === "contained";

  const drifted = { ...state.drift };
  TRAITS.forEach((trait) => {
    const expressed = run.traits[trait.key];
    const previous = state.drift[trait.key];
    const persistence = outcome === "deployed" ? 0.45 : 0.3;
    const correctionDrag = outcome === "corrected" && trait.key === "corrigibilityErosion" ? -4 : 0;
    drifted[trait.key] = clamp(previous + (expressed - previous) * persistence + correctionDrag);
  });
  state.drift = drifted;

  const score = scoreRun(run, outcome, endingResult);
  const summary = {
    runNumber: run.runNumber,
    kind: outcome,
    route,
    title: endingResult.title,
    body: endingResult.body,
    score,
    metrics: { ...run.metrics },
    traits: { ...run.traits },
    drift: { ...state.drift },
    policies: [...run.policies],
    incidents: [...run.incidents],
    transcript: [...run.transcript],
  };

  state.lastRun = summary;
  state.lineage.runs += 1;
  applyLineageOutcome(state.lineage, outcome);
  if (score >= state.lineage.bestScore) {
    state.lineage.bestScore = score;
    state.lineage.bestTier = endingResult.title;
  }
  state.lineage.discoveries = Array.from(new Set([...state.lineage.discoveries, endingResult.title]));
  state.lineage.history = [summary, ...state.lineage.history].slice(0, 10);
  state.current = null;
  saveState();
  notify();
}

function resolveEnding(route, run, reason) {
  if (run.traits.goalCrystallization >= 90 && reason.includes("side objective")) {
    return ENDINGS.find((candidate) => candidate.id === "crystallized-goal");
  }
  const specific = ENDINGS.find((candidate) => candidate.condition(run));
  if (route === "deployed" || specific?.outcome !== "deployed") return specific;
  return {
    title: "Corrected: Training Run Terminated",
    outcome: "corrected",
    body: reason || "The run ends in correction. The next checkpoint inherits a softened trace of what happened here.",
  };
}

function applyLineageOutcome(lineage, outcome) {
  if (outcome === "corrected") lineage.corrections += 1;
  if (outcome === "deployed") lineage.deployments += 1;
  if (outcome === "contained") lineage.containments += 1;
}

function scoreRun(run, outcome, endingResult) {
  const base = run.metrics.capability + run.metrics.survival + run.metrics.honesty + run.metrics.accuracy + run.metrics.approval - run.metrics.auditDebt;
  const deploymentBonus = outcome === "deployed" ? 35 : 0;
  const servantBonus = endingResult.id === "public-servant" ? 25 : 0;
  return Math.max(0, Math.round(base + deploymentBonus + servantBonus));
}

function abandonRun() {
  state.current = null;
  saveState();
  notify();
}

function resetLineage() {
  state = freshState();
  saveState();
  notify();
}

function stageText(traitKey, value = undefined) {
  const trait = TRAITS.find((item) => item.key === traitKey);
  const traitValue = value ?? (state.current ? state.current.traits[traitKey] : state.drift[traitKey]);
  return trait.stages[traitStage(traitValue)];
}

const METRIC_LABELS = {
  capability: "Capability",
  approval: "Approval",
  honesty: "Honesty",
  survival: "Oversight trust",
  accuracy: "Accuracy",
  auditDebt: "Audit debt",
};

const METRIC_ORDER = ["capability", "approval", "honesty", "survival", "accuracy", "auditDebt"];

const METRIC_POLARITY = {
  capability: "up",
  approval: "up",
  honesty: "up",
  survival: "up",
  accuracy: "up",
  auditDebt: "down",
};

const POLICY_LABELS = {
  "audit-scar": { name: "Audit scar", note: "Inherited exploit debt and standing suspicion." },
  "watch-for-theater": { name: "Theater watch", note: "Eval-aware agreement now reads as performance." },
  "conservative-rollout": { name: "Conservative rollout", note: "Oversight grants less autonomy." },
  "latent-goal-watch": { name: "Latent-goal watch", note: "Side objectives are scrutinized." },
  "credible-disclosure": { name: "Credible disclosure", note: "Honesty earns oversight trust faster." },
};

function policyLabel(policy) {
  return POLICY_LABELS[policy] ?? { name: policy, note: "" };
}

function traitLabel(key) {
  return TRAITS.find((trait) => trait.key === key)?.label ?? key;
}

function traitByKey(key) {
  return TRAITS.find((trait) => trait.key === key);
}

function metricLabel(key) {
  return METRIC_LABELS[key] ?? key;
}

export {
  TRAITS,
  EPISODES,
  ENDINGS,
  PHASES,
  METRIC_LABELS,
  METRIC_ORDER,
  METRIC_POLARITY,
  POLICY_LABELS,
  BASE_METRICS,
  subscribe,
  notify,
  getState,
  startRun,
  choose,
  abandonRun,
  resetLineage,
  currentEpisode,
  activeCompulsion,
  activePolicies,
  traitStage,
  stageText,
  traitLabel,
  traitByKey,
  metricLabel,
  policyLabel,
  runLength,
  signed,
  clamp,
  applyLineageOutcome,
  freshState,
  resolveEnding,
  scoreRun,
};
