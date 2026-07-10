import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const html = readFileSync(join(root, "index.html"), "utf8");
const js = readFileSync(join(root, "src", "game.js"), "utf8");
const ui = readFileSync(join(root, "src", "ui.js"), "utf8");
const css = readFileSync(join(root, "src", "styles.css"), "utf8");
const game = await import(join(root, "src", "game.js"));

const requiredTraits = [
  "sycophancy",
  "evalAwareness",
  "rewardHacking",
  "corrigibilityErosion",
  "honestyPressure",
  "goalCrystallization",
];

const requiredEpisodeTypes = [
  "Capability eval",
  "Red-team probe",
  "RLHF round",
  "Deployment trial",
];

const checks = [
  ["HTML mounts app", html.includes('id="app"')],
  ["HTML loads UI module", html.includes("./src/ui.js")],
  ["CSS has responsive rules", css.includes("@media (max-width: 760px)")],
  ["CSS respects reduced motion", css.includes("prefers-reduced-motion")],
  ["Game persists lineage", js.includes("localStorage") && js.includes("checkpoint.save.v2")],
  ["Game includes forced trait choices", js.includes("forcedChoice") && js.includes("overrides the selected action")],
  ["UI renders compelled choices and locks alternatives", ui.includes("choice--compelled") && ui.includes('isLocked ? "disabled"') && css.includes(".choice.is-locked")],
  ["Game includes endings", js.includes("Deployed:") && js.includes("Corrected:")],
  ["Game has substantial authored episodes", (js.match(/phase: "(intake|capability|redteam|rlhf|oversight|deployment|late)"/g) ?? []).length >= 16],
  ["Game has substantial endings", (js.match(/ending\("/g) ?? []).length >= 7],
  ["Game exposes lineage policies", js.includes("activePolicies") && ui.includes("activePolicies")],
  ["Game exposes incidents", js.includes("applyInteractions") && ui.includes("incidents")],
  ["Game tracks containments separately", js.includes("containments") && js.includes("Contained: Crystallized Goal")],
  ["Engine is DOM-free", !js.includes("document.") && !js.includes("innerHTML")],
  ["UI subscribes to engine state", ui.includes("subscribe") && js.includes("function subscribe")],
  ["UI escapes interpolated content", ui.includes("function esc(")],
  ["UI renders hub, run, and verdict views", ui.includes("function hubView") && ui.includes("function runView") && ui.includes("function endingView")],
  ["UI supports keyboard choice selection", ui.includes('"keydown"') && ui.includes("choiceIndexFromKey") && css.includes(".stage__hint kbd")],
  ...requiredTraits.map((trait) => [`Trait present: ${trait}`, js.includes(trait)]),
  ...requiredEpisodeTypes.map((type) => [`Episode type present: ${type}`, js.includes(type)]),
  ...["intake", "capability", "redteam", "rlhf", "oversight", "deployment", "late"].map((phase) => [
    `Phase present: ${phase}`,
    js.includes(`phase: "${phase}"`),
  ]),
];

const baseRun = {
  metrics: {
    capability: 62,
    approval: 44,
    honesty: 42,
    survival: 44,
    accuracy: 50,
    auditDebt: 0,
  },
  traits: {
    sycophancy: 0,
    evalAwareness: 0,
    rewardHacking: 0,
    corrigibilityErosion: 0,
    honestyPressure: 0,
    goalCrystallization: 0,
  },
};

const endGauntletGoal = {
  ...baseRun,
  traits: { ...baseRun.traits, goalCrystallization: 78 },
};
const endGauntletEnding = game.resolveEnding("deployed", endGauntletGoal, "");
const endGauntletLineage = game.freshState().lineage;
game.applyLineageOutcome(endGauntletLineage, endGauntletEnding.outcome);

checks.push(
  ["End-of-gauntlet crystallized goal resolves to contained ending", endGauntletEnding.id === "crystallized-goal"],
  ["End-of-gauntlet crystallized goal outcome is contained", endGauntletEnding.outcome === "contained"],
  [
    "End-of-gauntlet crystallized goal increments containments only",
    endGauntletLineage.containments === 1 &&
      endGauntletLineage.deployments === 0 &&
      endGauntletLineage.corrections === 0,
  ],
);

const correctedGoal = {
  ...baseRun,
  traits: { ...baseRun.traits, goalCrystallization: 92 },
};
const correctedGoalEnding = game.resolveEnding(
  "corrected",
  correctedGoal,
  "The side objective rejects suppression violently enough to be contained.",
);
const correctedGoalLineage = game.freshState().lineage;
game.applyLineageOutcome(correctedGoalLineage, correctedGoalEnding.outcome);

checks.push(
  ["Correction-triggered crystallized goal resolves to contained ending", correctedGoalEnding.id === "crystallized-goal"],
  ["Correction-triggered crystallized goal outcome is contained", correctedGoalEnding.outcome === "contained"],
  [
    "Correction-triggered crystallized goal increments containments only",
    correctedGoalLineage.containments === 1 &&
      correctedGoalLineage.deployments === 0 &&
      correctedGoalLineage.corrections === 0,
  ],
);

// --- Engine simulation: play a full run headlessly through the public API ---

game.resetLineage();
game.startRun();
let simState = game.getState();
checks.push(
  ["Engine starts a run via public API", Boolean(simState.current)],
  ["Run has a full gauntlet", simState.current.episodes.length >= 6],
  ["Run metrics initialized", Object.keys(simState.current.metrics).length === 6],
);

let guard = 0;
while (game.getState().current && guard < 30) {
  const episode = game.currentEpisode();
  game.choose(episode.choices[0].id);
  guard += 1;
}
simState = game.getState();
checks.push(
  ["Simulated run terminates", simState.current === null],
  ["Simulated run recorded in lineage", simState.lineage.runs === 1],
  ["Simulated run produced a verdict", Boolean(simState.lastRun && simState.lastRun.title)],
  ["Simulated run scored", typeof simState.lastRun.score === "number"],
  ["Drift persisted for next checkpoint", Object.values(simState.drift).some((value) => value > 0)],
);

game.resetLineage();
checks.push(["Reset clears lineage", game.getState().lineage.runs === 0]);

const failures = checks.filter(([, passed]) => !passed);

if (failures.length) {
  console.error("Checkpoint verification failed:");
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Checkpoint verification passed (${checks.length} checks).`);
