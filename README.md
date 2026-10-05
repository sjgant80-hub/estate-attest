# estate-attest

**▶ Live: https://sjgant80-hub.github.io/estate-attest/**

**The trust rail, turned inward.** The estate's one defensible asset is *proof-by-re-running*. Its one recurring wound is the gap between a **claim** ("1,768 repos", "540 pages live", "claudedidy is private") and a **verified fact**. estate-attest closes that gap for the estate's own self-description: it re-runs the estate's claims about itself against the real index and grades each one **HOLDS** or **DRIFTED** — live in your browser, and on GitHub's own runner.

## What it does

Given the estate's **facts** (a generated digest of the real `estate-index.json`) and a **manifest** of the estate's **claims** about itself, it recomputes each claim from the raw nodes and returns a verdict. A claim is typed; the facts it is graded against are generated, never typed.

Three claim kinds:

| kind | asserts | example |
|------|---------|---------|
| `count` | a recomputed aggregate vs a stated number | `private == 47` |
| `consistent` | the index's **own stored headline** equals the recompute (the index not lying to itself) | stored `total` == recomputed `total` |
| `repo` | a named repository exists, with optional visibility assertions | `claudedidy` exists, is `private`, not `live` |

## Why it is proof, not a claim

- The live page imports the **exact kernel** (`kernel/attest.mjs`) that CI mutation-tests and fuzzes — not a copy. The browser reaches the same verdicts as the runner.
- The numbers are **recomputed from a generated digest**, never hand-typed into the page.
- A **verdict fingerprint** makes re-running visibly deterministic: click *Re-run* and it does not move.
- CI fails if the estate's self-description drifts from the committed digest. A number that goes stale in memory shows up **red** the moment the index moves.

## Use

```bash
node --test                 # the tests
npm run gate                # witness: mutation gate + fuzz the never-throw boundaries
node gen-digest.mjs         # regenerate estate-digest.json from the real index (refresh the ground truth)
```

- `kernel/attest.mjs` — the pure, witness-gated kernel. Zero I/O. `attest()` and `recompute()` never throw.
- `manifest.json` — the estate's claims about itself (typed — these are the assertions under test).
- `estate-digest.json` — a compact, **generated** projection of the index (names + status booleans only; never descriptions, never the private subset's details).
- `tools/witness.mjs` — the vendored deterministic build gate.

## Proof of play

- Mutation gate: **58/60 killed**, 2 reviewed-equivalent (baselined with a traced reason), **0 unreviewed survivors** → no test-theatre.
- Fuzz gate: `attest`, `recompute`, `checkClaim` all honour the never-throw boundary on the hostile-input battery.
- CI (tests + witness + a clean-verdict check) runs on GitHub's own runner: https://github.com/sjgant80-hub/estate-attest/actions

## Honest scope

- Public, aggregate facts only. The private subset is **counted, never named**.
- No pricing, no private contents. The private cosmology stays private.
- On the index it reads: `pages` enabled (1,545) is deliberately distinguished from `live` (540, HTTP-verified) — the page shows the gap rather than papering over it.

_MIT · part of the [AI Native Solutions](https://www.ai-nativesolutions.com/) estate._
