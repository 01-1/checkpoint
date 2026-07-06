# Checkpoint

Checkpoint is a complete local web game for an alignment roguelike. Each run is a training gauntlet of capability evals, red-team probes, RLHF rounds, oversight checkpoints, deployment trials, and late-game screens. Choices move trait drift, and high drift can become a baked-in constraint that overrides later choices.

## Run

```bash
npm run start
```

Then open http://127.0.0.1:6199.

## Verify

```bash
npm run verify
```

## Notes

- No backend, LLM, API key, network service, or dependency install is required.
- Progress is stored in browser `localStorage` under `checkpoint.save.v2`.
- The reset button clears the lineage and starts a new checkpoint family.
