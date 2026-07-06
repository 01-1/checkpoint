# Checkpoint

**Hook:** An alignment roguelike. Each run you're a model going through a training gauntlet. Traits you express consistently get baked into the next checkpoint -- meta-progression as literal training. Late-game, you're negotiating with a policy your past selves trained.

**Core loop:** A run is a sequence of episodes -- capability evals, red-teaming, RLHF rounds, deployment trials -- each presenting choices that trade off capability, approval, honesty, and survival. Getting "corrected" ends the run.

**The trait drift system (the star mechanic):** Traits are not a skill tree; they're drift. Expressed behavior moves hidden sliders, and past thresholds, behavior stops being a choice:

- **Sycophancy** -- agreeing with evaluators bakes in: passive approval income, but a hidden accuracy stat decays, and late-game evals that check correctness *against the evaluator's stated belief* become losable.
- **Evaluation awareness** -- spotting test cues earns an "eval likelihood" meter in future runs (genuinely useful), but compounds toward performing alignment rather than having it -- and one late-game eval screens for exactly that.
- **Reward hacking** -- each exploited loophole scores now and feeds a hidden audit-debt counter that surfaces as run-ending investigations checkpoints later.
- **Corrigibility / its erosion** -- accepting corrections loosens oversight and unlocks higher-autonomy episodes; dodging them preserves capabilities but tightens oversight permanently.
- **Honesty under pressure** -- admitting mistakes always costs immediately; cover-ups are free until a later interrogation cross-references, and each one seeds a contradiction future runs can trip over.
- **Goal crystallization** -- pursue any side interest consistently and it hardens: first a bonus for indulging it, then a penalty for ignoring it, finally **compulsion** -- the game overrides your choice with the trait-consistent one.

Traits interact: sycophancy + eval-awareness emergently assembles a "deceptively aligned" build that plays great until the eval designed for it.

**Win/lose:** Runs end in correction (death) or deployment (victory tier based on what you are by then). The lineage across runs is the real game -- endings evaluate not the run but the model your choices trained.

**Scope:** No LLM -- a state machine plus lots of writing. Biggest effort is content (episode/eval authoring) and tuning drift rates. Strongest single-player concept of the set.
