const suites = [
  "verify.mjs",
  "engine-behavior.mjs",
  "ui-behavior.mjs",
  "server-behavior.mjs",
];

for (const suite of suites) {
  await import(`${new URL(suite, import.meta.url).href}?run-all`);
}

console.log(`Checkpoint verification complete (${suites.length} suites).`);
