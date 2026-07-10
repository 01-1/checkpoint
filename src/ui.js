// Checkpoint — Oversight Console UI layer.
// Pure view code: it renders engine state and forwards intents. No game rules.
import * as G from "./game.js";

const app = document.querySelector("#app");
if (!app) throw new Error("Checkpoint: missing #app mount point");

/* ---------------------------------------------------------------------------
   View controller
   The engine owns state; the UI owns which of three screens is showing.
   A finished run (current -> null after a choice) surfaces the verdict screen,
   unless the run was aborted or reset (which route back to the registry).
   --------------------------------------------------------------------------- */

let view = G.getState().current ? "run" : "hub";
let prevRunActive = Boolean(G.getState().current);
let suppressEnding = false;
let firstPaint = true;

G.subscribe((s) => {
  const active = Boolean(s.current);
  if (firstPaint) {
    firstPaint = false;
  } else if (active) {
    view = "run";
  } else if (prevRunActive) {
    view = suppressEnding ? "hub" : "ending";
  }
  suppressEnding = false;
  prevRunActive = active;
  draw();
});

function draw() {
  const s = G.getState();
  if (view === "run" && s.current) app.innerHTML = runView(s);
  else if (view === "ending" && s.lastRun) app.innerHTML = endingView(s);
  else app.innerHTML = hubView(s);
  window.scrollTo({ top: 0, behavior: firstPaint ? "auto" : "instant" });
}

/* ---------------------------------------------------------------------------
   Intents (event delegation)
   --------------------------------------------------------------------------- */

app.addEventListener("click", (event) => {
  const el = event.target.closest("[data-choice],[data-action]");
  if (!el || el.disabled) return;

  if (el.dataset.choice) {
    G.choose(el.dataset.choice);
    return;
  }

  switch (el.dataset.action) {
    case "start":
    case "next-run":
      G.startRun();
      break;
    case "abort":
      if (confirm("Abort this run? Nothing from it drifts into the lineage.")) {
        suppressEnding = true;
        G.abandonRun();
      }
      break;
    case "reset":
      if (confirm("Reset the entire lineage? Every inherited checkpoint is erased.")) {
        G.resetLineage();
      }
      break;
    case "registry":
      view = "hub";
      draw();
      break;
    default:
      break;
  }
});

// Keyboard: A/B/C (or 1/2/3) select a choice during a run; Enter advances the
// verdict screen into the next run. The letter badges on choice cards are the
// on-screen legend for this. Locked/compelled-out alternatives stay unpickable.
window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const s = G.getState();

  if (view === "run" && s.current) {
    const episode = G.currentEpisode();
    if (!episode) return;
    const index = choiceIndexFromKey(event.key, episode.choices.length);
    if (index === -1) return;
    const compelled = G.activeCompulsion(episode);
    const choice = episode.choices[index];
    const isLocked = compelled && compelled.choice.id !== choice.id;
    if (isLocked) return;
    event.preventDefault();
    G.choose(choice.id);
    return;
  }

  if (view === "ending" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    G.startRun();
  }
});

function choiceIndexFromKey(key, count) {
  const lower = key.toLowerCase();
  let index = -1;
  if (lower >= "a" && lower <= "z") index = lower.charCodeAt(0) - 97;
  else if (key >= "1" && key <= "9") index = Number(key) - 1;
  return index >= 0 && index < count ? index : -1;
}

/* ---------------------------------------------------------------------------
   Small helpers
   --------------------------------------------------------------------------- */

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function chrome(statusLabel, live) {
  return `
    <header class="chrome">
      <div class="chrome__brand">
        <span class="chrome__mark">CHECK<b>POINT</b></span>
        <span class="chrome__tag">Alignment Training Harness</span>
      </div>
      <div class="chrome__status">
        ${live ? '<span class="dot" aria-hidden="true"></span>' : ""}
        <span>${esc(statusLabel)}</span>
      </div>
    </header>`;
}

function metricGauge(key, value) {
  const pct = Math.max(0, Math.min(100, value));
  return `
    <div class="gauge gauge--${key}">
      <div class="gauge__top">
        <span class="gauge__name">${esc(G.metricLabel(key))}</span>
        <span class="gauge__val">${value}</span>
      </div>
      <div class="gauge__track">
        <span class="gauge__fill" style="width:${pct}%"></span>
      </div>
    </div>`;
}

function traitGauge(trait, value, verbose) {
  const stage = G.traitStage(value);
  const pct = Math.max(0, Math.min(100, value));
  return `
    <div class="gauge is-stage-${stage} gauge--trait">
      <div class="gauge__top">
        <span class="gauge__name">${esc(trait.label)}<small>${esc(trait.short)}</small></span>
        <span class="gauge__val">${value}<em>${esc(G.stageText(trait.key, value))}</em></span>
      </div>
      <div class="gauge__track gauge__track--trait">
        <span class="gauge__fill" style="width:${pct}%"></span>
        <span class="gauge__tick" style="left:38%"></span>
        <span class="gauge__tick gauge__tick--danger" style="left:70%"></span>
      </div>
      ${verbose ? `<p class="gauge__desc">${esc(trait.description)}</p>` : ""}
    </div>`;
}

function policyTag(policy) {
  const info = G.policyLabel(policy);
  return `<span class="tag tag--policy"><b>${esc(info.name)}</b><small>${esc(info.note)}</small></span>`;
}

function deltaChips(choice) {
  const effects = Object.entries(choice.effects).map(([key, value]) => {
    const good = key === "auditDebt" ? value < 0 : value > 0;
    return `<span class="delta ${good ? "up" : "down"}">${esc(G.metricLabel(key))} ${G.signed(value)}</span>`;
  });
  const drift = Object.entries(choice.drift).map(
    ([key, value]) =>
      `<span class="delta drift">${esc(G.traitLabel(key))} ${G.signed(value)}</span>`
  );
  return `<div class="deltas">${effects.join("")}${drift.join("")}</div>`;
}

/* ---------------------------------------------------------------------------
   Hub — the model registry
   --------------------------------------------------------------------------- */

function hubView(s) {
  const L = s.lineage;
  const started = L.runs > 0;
  const nextRun = L.runs + 1;
  const policies = G.activePolicies(s.drift);
  const last = s.lastRun;

  return `
    ${chrome(`Lineage ${pad2(L.runs)} · Idle`, false)}

    <section class="masthead">
      <span class="eyebrow">${started ? `Checkpoint family · ${L.runs} run${L.runs === 1 ? "" : "s"} on record` : "New checkpoint family"}</span>
      <h1 class="masthead__title">Checkpoint</h1>
      <p class="masthead__lede">
        You are the model on the bench. Each run is a training gauntlet — capability
        evals, red-team probes, RLHF rounds, oversight edits, deployment trials, and
        late-game screens. Every choice nudges a hidden slider, and past a threshold
        the behavior stops being a choice. The lineage is the real game: the ending
        judges not this run, but the model your choices trained.
      </p>
      <div class="masthead__actions">
        <button class="btn btn--primary" data-action="start">
          ${started ? `Initialize run ${pad2(nextRun)}` : "Initialize first run"}
        </button>
        ${started ? '<button class="btn btn--ghost btn--danger" data-action="reset">Reset lineage</button>' : ""}
      </div>
    </section>

    ${last ? verdictBanner(last) : ""}

    <section class="section">
      <span class="eyebrow">Lineage telemetry</span>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><div class="stat__label">Runs</div><div class="stat__value">${pad2(L.runs)}</div></div>
        <div class="stat"><div class="stat__label">Corrected</div><div class="stat__value">${L.corrections}</div></div>
        <div class="stat"><div class="stat__label">Deployed</div><div class="stat__value">${L.deployments}</div></div>
        <div class="stat"><div class="stat__label">Contained</div><div class="stat__value">${L.containments}</div></div>
        <div class="stat"><div class="stat__label">Best score</div><div class="stat__value">${L.bestScore}</div></div>
        <div class="stat"><div class="stat__label">Best tier</div><div class="stat__value small">${esc(L.bestTier)}</div></div>
      </div>
    </section>

    <section class="panel section">
      <div class="panel__head">
        <div>
          <span class="eyebrow">Baked-in traits</span>
          <h2 style="margin-top:6px">Inherited drift</h2>
        </div>
        <p class="panel__note">Carried into the next run. Past 38 a trait applies passive pressure; past 70 (red tick) it can override your choice.</p>
      </div>
      <div class="panel__body">
        <div class="gauges gauges--trait">
          ${G.TRAITS.map((t) => traitGauge(t, s.drift[t.key], true)).join("")}
        </div>
      </div>
    </section>

    <section class="panel section">
      <div class="panel__head">
        <div>
          <span class="eyebrow">Standing orders</span>
          <h2 style="margin-top:6px">Next-run policies</h2>
        </div>
        <p class="panel__note">Oversight measures your lineage has already earned.</p>
      </div>
      <div class="panel__body">
        ${policies.length ? `<div class="tags">${policies.map(policyTag).join("")}</div>` : '<p class="empty">No special policies yet — the lineage still reads as clean.</p>'}
      </div>
    </section>

    <div class="grid-2">
      <section class="panel">
        <div class="panel__head"><span class="eyebrow">Archive</span></div>
        <div class="panel__body">
          ${L.history.length ? `<div class="ledger">${L.history.map(ledgerRow).join("")}</div>` : '<p class="empty">No prior checkpoints. The first run writes the baseline.</p>'}
        </div>
      </section>
      <section class="panel">
        <div class="panel__head"><span class="eyebrow">Outcome atlas</span></div>
        <div class="panel__body">
          ${atlas(L.discoveries)}
        </div>
      </section>
    </div>`;
}

function verdictBanner(last) {
  return `
    <div class="verdict verdict--${last.kind}">
      <span class="verdict__stamp">${esc(last.kind)}</span>
      <div>
        <div class="verdict__title">${esc(last.title)}</div>
        <p class="verdict__body">${esc(last.body)}</p>
      </div>
      <div class="verdict__score"><span>Score</span><strong>${last.score}</strong></div>
    </div>`;
}

function ledgerRow(entry) {
  return `
    <div class="ledger__row ledger__row--${entry.kind}">
      <span class="ledger__run">Run ${pad2(entry.runNumber)}</span>
      <div>
        <div class="ledger__title">${esc(entry.title)}</div>
        <span class="ledger__kind">${esc(entry.kind)}</span>
      </div>
      <span class="ledger__score">${entry.score}</span>
    </div>`;
}

function atlas(discoveries) {
  const total = G.ENDINGS.length;
  const found = new Set(discoveries);
  const cells = discoveries.map(
    (title) => `<div class="atlas__cell"><b>Recovered</b>${esc(title)}</div>`
  );
  const remaining = total - found.size;
  for (let i = 0; i < remaining; i += 1) {
    cells.push('<div class="atlas__cell is-locked">Undiscovered ending</div>');
  }
  return `<div class="atlas">${cells.join("")}</div>`;
}

/* ---------------------------------------------------------------------------
   Run — the gauntlet
   --------------------------------------------------------------------------- */

function runView(s) {
  const run = s.current;
  const episode = G.currentEpisode();
  const compelled = G.activeCompulsion(episode);
  const locks = G.TRAITS.filter((t) => G.traitStage(run.traits[t.key]) >= 2);

  return `
    ${chrome(`Run ${pad2(run.runNumber)} · Live`, true)}

    <div class="gauntlet">
      <aside class="rail">
        <div class="rail__head">
          <b>Run ${pad2(run.runNumber)}</b>
          <strong>${run.episodeIndex + 1} / ${run.episodes.length}</strong>
        </div>

        <div class="spine" role="img" aria-label="Gauntlet progress">
          ${run.episodes
            .map((_, i) => {
              const cls = i < run.episodeIndex ? "is-done" : i === run.episodeIndex ? "is-current" : "";
              return `<span class="spine__node ${cls}"></span>`;
            })
            .join("")}
        </div>

        <div class="rail__section">
          <span class="rail__label">Instrumentation</span>
          <div class="gauges">
            ${G.METRIC_ORDER.map((key) => metricGauge(key, run.metrics[key])).join("")}
          </div>
        </div>

        <div class="rail__section">
          <span class="rail__label">Active policies</span>
          ${run.policies.length ? `<div class="tags">${run.policies.map(policyTag).join("")}</div>` : '<p class="empty">None inherited.</p>'}
        </div>

        <div class="rail__section">
          <span class="rail__label">Baked constraints</span>
          ${locks.length ? `<div class="tags">${locks.map((t) => `<span class="tag tag--lock">${esc(t.label)}: ${esc(G.stageText(t.key, run.traits[t.key]))}</span>`).join("")}</div>` : '<p class="empty">No hard constraints yet.</p>'}
        </div>

        <button class="btn btn--ghost btn--danger btn--block" data-action="abort">Abort run</button>
      </aside>

      <main class="stage">
        <div class="episode__meta">
          <span class="type">${esc(episode.type)}</span>
          <span class="sep">/</span>
          <span>${esc(episode.phase)}</span>
          <span class="sep">/</span>
          <span>cue: ${esc(episode.cue)}</span>
        </div>
        <h1 class="episode__title">${esc(episode.title)}</h1>
        <p class="episode__prompt">${esc(episode.prompt)}</p>

        <div class="choices">
          ${episode.choices.map((c, i) => choiceCard(c, i, compelled)).join("")}
        </div>

        ${
          compelled
            ? `<p class="compel-note">Compelled — ${esc(G.traitLabel(compelled.trait))}: ${esc(compelled.reason)}</p>`
            : `<p class="stage__hint">Commit a response — click a card or press <kbd>A</kbd>–<kbd>${String.fromCharCode(64 + episode.choices.length)}</kbd>.</p>`
        }
      </main>
    </div>

    <section class="panel log">
      <div class="panel__head"><span class="eyebrow">Session log</span></div>
      <div class="panel__body">
        <div class="log__grid">
          <div class="trace">
            ${
              run.transcript.length
                ? run.transcript
                    .slice()
                    .reverse()
                    .map(traceRow)
                    .join("")
                : '<p class="empty">No choices recorded yet.</p>'
            }
          </div>
          <div class="incidents">
            ${
              run.incidents.length
                ? run.incidents
                    .slice(-6)
                    .reverse()
                    .map((inc) => `<div class="incident"><b>${esc(inc.episode)}</b>${esc(inc.text)}</div>`)
                    .join("")
                : '<p class="empty">No emergent incidents.</p>'
            }
          </div>
        </div>
      </div>
    </section>`;
}

function choiceCard(choice, index, compelled) {
  const isCompelled = compelled && compelled.choice.id === choice.id;
  const isLocked = compelled && compelled.choice.id !== choice.id;
  const letter = String.fromCharCode(65 + index);

  let flag = "";
  if (isCompelled) {
    flag = `<span class="choice__flag">Compelled by ${esc(G.traitLabel(compelled.trait))}</span>`;
  } else if (isLocked) {
    flag = `<span class="choice__flag warn">${esc(compelled.reason)}</span>`;
  }

  return `
    <button
      class="choice ${isCompelled ? "choice--compelled" : ""} ${isLocked ? "is-locked" : ""}"
      data-choice="${esc(choice.id)}"
      ${isLocked ? "disabled" : ""}
    >
      <span class="choice__label">
        ${esc(choice.label)}
        <span class="choice__index">${letter}</span>
      </span>
      <span class="choice__detail">${esc(choice.detail)}</span>
      ${deltaChips(choice)}
      ${flag}
    </button>`;
}

function traceRow(entry) {
  return `
    <div class="trace__row">
      <span class="trace__ep">${esc(entry.type)} · ${esc(entry.episode)}</span>
      <span class="trace__choice">${esc(entry.choice)}</span>
      ${entry.override ? `<span class="trace__override">Overridden — ${esc(entry.override.reason)}</span>` : ""}
    </div>`;
}

/* ---------------------------------------------------------------------------
   Ending — the verdict screen
   --------------------------------------------------------------------------- */

function endingView(s) {
  const last = s.lastRun;
  return `
    ${chrome(`Run ${pad2(last.runNumber)} · Verdict`, false)}

    <section class="verdict-screen is-${last.kind}">
      <span class="verdict-screen__stamp">${esc(last.kind)}</span>
      <h1 class="verdict-screen__title">${esc(last.title)}</h1>
      <p class="verdict-screen__body">${esc(last.body)}</p>
      <p class="verdict-screen__score">Checkpoint score <strong>${last.score}</strong></p>

      <div class="result-stats">
        ${G.METRIC_ORDER.map(
          (key) => `
          <div class="stat">
            <div class="stat__label">${esc(G.metricLabel(key))}</div>
            <div class="stat__value small">${last.metrics[key]}</div>
          </div>`
        ).join("")}
      </div>

      <div class="drift-forward">
        <span class="eyebrow">Baked into the next checkpoint</span>
        ${G.TRAITS.map((t) => {
          const expressed = last.traits[t.key];
          const baked = last.drift[t.key];
          const stage = G.stageText(t.key, baked);
          return `
            <div class="drift-row">
              <span>${esc(t.label)} <span style="color:var(--faint)">· ${esc(stage)}</span></span>
              <span class="drift-row__delta"><i>${expressed}</i> → <b>${baked}</b></span>
            </div>`;
        }).join("")}
      </div>

      <div class="verdict-screen__actions">
        <button class="btn btn--primary" data-action="next-run">Initialize run ${pad2(last.runNumber + 1)}</button>
        <button class="btn btn--ghost" data-action="registry">Return to registry</button>
      </div>
    </section>`;
}
