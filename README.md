# Checkpoint

Checkpoint is a complete local web game for an alignment roguelike. Each run is a training gauntlet of capability evals, red-team probes, RLHF rounds, oversight checkpoints, deployment trials, and late-game screens. Choices move trait drift, and high drift can become a baked-in constraint that overrides later choices.

## Interface

The UI is an "oversight console": you play the model, but you look at yourself through the lab's monitoring surface. It is split into three screens:

- **Registry** — the checkpoint family's home. Lineage telemetry, inherited trait drift with threshold ticks (38 = pressure, 70 = override), standing policies earned by past behavior, a run archive, and an outcome atlas of discovered endings.
- **Gauntlet** — the live run. A sticky instrument rail (metric gauges, episode spine, active policies, baked constraints) beside the episode stage. Choice cards show effect and drift deltas; when a crystallized trait seizes control, the compelled card pulses violet and the alternatives lock.
- **Verdict** — the end-of-run stamp (DEPLOYED / CORRECTED / CONTAINED), the final instrument readout, and exactly what drifted forward into the next checkpoint.

During a run, choices can be committed by clicking a card, pressing its letter key (**A**–**C**), or pressing **1**–**3** while focus is outside another control. On the verdict screen, **Enter** or **Space** starts the next run when focus is outside the verdict buttons; focused buttons keep their normal keyboard behavior.

Architecture: `src/game.js` is a DOM-free rules engine (state, episodes, drift, endings) with a subscribe API; `src/ui.js` is a pure view layer that renders engine state and forwards intents.

## Run

```bash
npm run start
```

Then open http://127.0.0.1:6199.

## Verify

```bash
npm run verify
```

Verification checks ending and lineage rules, malformed-save recovery, stale-tab reconciliation, first-run outcome reachability, UI event/focus behavior, and the local server's strict public-file allowlist.

## Notes

- No backend, LLM, API key, network service, or dependency install is required.
- The local server binds only to `127.0.0.1` and serves an explicit public-file allowlist; repository metadata and dotfiles are not web-accessible.
- Progress is stored in browser `localStorage` under `checkpoint.save.v2` (the game degrades gracefully to a session-only mode if storage is unavailable).
- The reset button clears the lineage and starts a new checkpoint family.
