# Mutation testing — rollout baseline

> Established v0.36.0. Scope: `src/lib/calc/`. **This is a baseline, not a gate.**

## Why mutation testing, given we already measure coverage

Branch coverage answers *"was this line executed?"*. It cannot answer *"would anything
have noticed if this line were wrong?"* — and those are different questions. A test that
calls a function and asserts nothing scores the same coverage as one that checks every
output.

Mutation testing answers the second question directly: it changes the code in small ways
(flips a comparison, deletes a call, swaps a constant) and re-runs the suite. A mutant
that survives is a change to production code that **no test objects to**.

The distinction is not theoretical here. `metrics.ts` has **100% branch coverage** and a
mutation score of **94.87%** — two mutants survive. One of them deletes the `.sort()` from
`getActiveMonths`, and every test still passes: the suite checks which months come back,
never in what order.

## Scope, and the rule for extending it

`mutate` covers `src/lib/calc/` only. That directory was chosen because it is where the
two instruments in use disagree most usefully: **zero of the repository's 14
cognitive-complexity findings are in `src/lib/calc/`**, and calc is also the
least-churning code in the repo. Complexity says "this is cheap to change"; mutation asks
whether the tests would catch you changing it wrongly.

⚠️ **A refactor target is added to `mutate` BEFORE it is touched, never after.** Scoring a
function after restructuring it measures the new tests, not whether the restructuring
preserved behaviour. The baseline has to exist first or it is not a baseline.

## Running it

```bash
npm run mutate                                    # the committed scope: src/lib/calc/
npm run mutate -- --mutate 'src/lib/utils/x.ts'   # a one-off scope, no config edit
```

⚠️ **Use the `--mutate` CLI flag for one-off scopes rather than editing
`stryker.config.json`.** A committed scope change would permanently alter the killing
power of every future comparison, and the way that mistake happens is that someone edits
the config, measures, and forgets to revert. With the CLI flag there is nothing to revert.

## `npm run mutate` is guarded, and why

⚠️ **A mutation run that fails to start emits no survivors and no score. Read casually,
that is indistinguishable from a perfect result** — the failure mode is silent *and*
flattering, which is the worst combination.

`scripts/mutation-guard.mjs` therefore never trusts the exit code. It deletes any previous
report, runs Stryker, then re-reads the report and refuses to claim success unless mutants
were both generated and executed. Four ways a run can be vacuous, all caught:

| failure | caught by |
|---|---|
| Stryker died before reporting | no report file present |
| **a stale report from an earlier run** | report deleted before the run starts |
| `mutate` globs matched nothing | zero mutants in the report |
| runner never exercised the suite | zero executed; all CompileError/RuntimeError/Ignored |

The stale-report case is the subtle one and it was a real hole in the first draft of the
guard: without deleting first, a run that died early would have been validated against the
*previous* run's numbers.

**All four were falsified before the guard was trusted**, plus a positive control
confirming a report with real verdicts still passes.

## The `maxTestRunnerReuse` control

Stryker reuses test-runner processes between mutants. If state leaks across that reuse,
verdicts become unreliable in a way no score reveals.

Control: `metrics.ts` (pure, 100% branch coverage, 2 commits) run twice — default reuse,
then `--maxTestRunnerReuse 1`, which forces a fresh process per mutant.

**Result: 52 mutants, 0 per-mutant verdict differences.** No state leakage.

⚠️ The comparison is **per-mutant, not per-score**. Two offsetting differences cancel in an
aggregate and would leave the score identical while the verdicts had changed.

## The baseline

`src/lib/calc/`, 463 mutants, **88.80%**.

| file | score | survived | branch cov |
|---|---|---|---|
| `index.ts` | 50.00% | 5 | 87.5% |
| `costs.ts` | 69.57% | 7 | 93.75% |
| `productivity.ts` | 78.05% | 9 | **100%** |
| `charterBudget.ts` | 84.31% | 16 | 76.92% |
| `metrics.ts` | 94.87% | 2 | **100%** |
| `normal.ts` | 97.54% | 3 | 60% → covered in v0.36.0 |
| `trafficLight.ts` | 100.00% | 0 | 100% |
| `allocationMap.ts` | 100.00% | 0 | 100% |
| `npv.ts` | 100.00% | 0 | 100% *(0 branches exist)* |

Two findings worth keeping:

1. **Coverage saturation hides real gaps.** `productivity.ts` and `metrics.ts` both have
   100% branch coverage and both leak mutants — 9 and 2. Coverage had nothing left to say
   about either file.
2. **The two measures are not monotonically related.** `charterBudget.ts` has *lower*
   branch coverage than `costs.ts` (76.92% vs 93.75%) and a *higher* mutation score
   (84.31% vs 69.57%). Ranking files by coverage would have ordered this work wrongly.

`normal.ts` had **no test file at all** and contributed 46 of the 46 no-coverage mutants in
the directory: every percentile the Charter Budget panel offers (P60–P95) lands in
Acklam's central region, so both tail branches had never executed. Its first test file
landed in v0.36.0 and took the directory from 73.60% to 88.80%, with no-coverage now zero.

## One-off: scoring Item 1's tests (`validation.ts`)

Run once via `--mutate` (no config edit, nothing committed) to answer *"is the netting
added in v0.35.2 real?"*.

⚠️ **The whole-file score is the wrong number and would understate the answer.**
`validation.ts` scores 69.37% as a file, but that pools the v0.35.2 subtree with ~57
uncovered arms belonging to validators outside it. Survivors must be **classified by
enclosing function** first.

| | mutation score |
|---|---|
| **v0.35.2 subtree** (`validateReforecast` + its 4 child validators + 2 helpers) | **100.00%** (200 killed, 0 survived) |
| rest of the file | 53.96% |
| whole file, pooled | 69.37% — *misleading* |

The subtree scored 99.50% on first measurement. The single survivor deleted the `^` anchor
from `isValidMonthString`'s pattern, which no test noticed because every other month case
fails the unanchored pattern too. A test pinning the anchor closed it to 100%.

⚠️ **Attribution trap, hit on the first attempt.** Assigning each mutant to "the last
function declared at or before its line" is wrong: it silently attributes module-level code
to the preceding function. It initially reported `validateProductivityWindow` at 68.75%
with 15 survivors; those 15 were `StringLiteral` mutants in the module-level `CHARTER_*`
enum `Set`s that follow it, and the function's real score is 100%. **Brace-match each
function to its end and attribute to the innermost enclosing span.** The wrong answer was
plausible, specific, and pessimistic — the direction nobody double-checks.

The `CHARTER_*` enum sets scoring 37.50% at module scope, and `validateHoliday` at 0.00%
with 23 no-coverage mutants, are real findings about **a different item** and are recorded
here rather than acted on.

## Not a gate

`stryker.config.json` sets no `break` threshold and `npm run mutate` is **not** part of
`npm run shipgate`. Mutation runs take minutes, and the calc baseline is not yet high
enough that a threshold would mean anything. Wiring it into the gate is a separate,
deliberate decision — not something to slip in as a default.
