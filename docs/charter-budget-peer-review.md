# External Peer Review — MyScrumBudget Charter Budget Design Brief

*Lead reviewer's consolidated assessment, integrating six fact-checked dimension critiques. Where a critique claim was flagged incorrect, partially-correct, or unverifiable in adversarial verification, it has been corrected or down-weighted below; those corrections are called out explicitly in Section 5.*

*Produced via a multi-agent review workflow (6 parallel dimension critiques → adversarial fact-check of each critique's own claims → synthesis). 13 agents, ~321 web/tool calls. May 2026.*

---

## 1. Bottom line

The model is **shippable as an explainable parametric contingency heuristic, but not yet defensible as a "P80 guarantee"** — and the gap between those two framings is the whole review. The machinery is clean (z-scores are exact, the one-sided "probability of not exceeding" framing is industry-correct, the project-type rank-ordering is sound, and the brief is admirably honest about which numbers are judgment). But the model centers a symmetric Normal on ETC while simultaneously calling ETC the "most likely cost," and adds *only* spread (z·σ) with **no optimism-bias correction to the center** — even though every authoritative source it cites (Flyvbjerg, AACE, COCOMO, McConnell) argues the plan-based point estimate is itself biased low. The single most important fix: **decide explicitly what ETC represents (mode, median, or mean), state it in the UI, and add a separately-labeled optimism-bias uplift to the center before applying spread** — presented to the sponsor as two lines ("expected-overrun correction" + "risk contingency at P80"). This is more honest, more accurate, and *more* explainable than burying the correction inside an inflated CV.

---

## 2. Severity-tiered findings

| Tier | Finding | Dimension |
|---|---|---|
| **Critical** | ETC is called "most likely" (mode) but plugged in as the mean of a symmetric Normal — internally contradictory; biases the curve low before any uplift | Statistics |
| **Critical** | The 27% mean-shift evidence is *cited* but never *applied* — ETC is unshifted, so the headline source does no work in the formula | Citations / Adjustments |
| **Critical** | The brief cites Flyvbjerg's *problem* (fat tail) but omits his *remedy* — Reference Class Forecasting — which is both more defensible and more explainable | Missing literature |
| **Critical** | Cornish-Fisher skew correction, if adopted as a drop-in, *lowers* contingency at the P80 default (sign of the skew term flips at z=1 ≈ P84) — wrong direction | Alternatives |
| **Major** | 50% CV ceiling truncates the very fat tail the model invokes as motivation; sits an order of magnitude below the canonical IT uplift (Green Book +200% capex) | Statistics / Missing lit |
| **Major** | Additive CV summation is the ρ=1 (perfectly-correlated) bound — defensible but must be *labeled* as a deliberate correlation assumption, not presented as if sigmas add naturally | Statistics / Adjustments |
| **Major** | Org-change (+6%) and integration (+6%) deltas rest on success-*rate* data (Prosci/McKinsey), not cost-*variance*; integration has essentially no anchor | Adjustments |
| **Major** | Coverage gap: project SIZE/duration and schedule compression (SCED) are first-order COCOMO drivers, absent from the four factors | Adjustments |
| **Major** | McConnell Cone misattributed: initiation is 0.25x–4x (asymmetric), not "±50-75%"; the ±50% band is a *later* milestone | Citations / Base CV / Alternatives |
| **Major** | Custom/data CV of 25% (P80 +21%) sits *below* the measured ~30-40% mean effort overrun — typical outcome lands near P90 | Base CV |
| **Major** | AACE estimate-class framework (accuracy keyed to scope-definition maturity, asymmetric ranges) — the professional standard for this exact task — is absent | Missing literature |
| **Minor** | AI/ML base CV of 35% likely too low given post-2023 enterprise-AI failure data; pair with P85 + lognormal | Base CV / Statistics |
| **Minor** | Business-process at 22% (below custom) is in tension with the brief's own "human variability" rationale | Base CV |
| **Minor** | COCOMO multipliers are point-estimate (mean) shifts, not dispersion — using them to size a CV is a category analogy, not a derivation | Citations / Adjustments |
| **Strength** | Z-scores exact to 3 decimals; one-sided "not-exceeded" framing is the correct cost-engineering convention | Statistics |
| **Strength** | Project-type rank-ordering (COTS < Infra < BizProc < Custom = Data < AI/ML) survives scrutiny and is the model's best feature | Base CV |
| **Strength** | Asymmetric requirements factor (-5%/+8%) is directionally well-supported by the optimism-bias literature | Adjustments |
| **Strength** | Honest provenance flagging — the brief labels its interpolations and weak anchors rather than dressing judgment as research | All |
| **Strength** | Scrum/Agile context genuinely justifies somewhat tighter CVs (flexible-method mean overrun ~9% vs sequential ~29%) — *if* used only for disciplined Scrum delivery | Base CV / Missing lit |

---

## 3. Answers to Section 7 critique questions

**1. Research rigor.** Mixed but mostly honest. The headline figures that *are* cited are quoted accurately: Flyvbjerg & Budzier 2011 (1,471 projects, 27% mean, 1-in-6 black swans at ~200%), PMI Pulse (43% miss budget, 47% requirements-driven failure), and COCOMO II experience-driver ranges all verified. The weakness is not fabrication — it is **using mean/point-estimate evidence to justify dispersion (CV) parameters**, which recurs across COCOMO, Flyvbjerg's 27%, and the Cone. Tighten each citation to exactly what the source supports, and re-anchor on the modern, directly-on-point evidence (Flyvbjerg et al. 2022 power-law; AACE 18R-97/42R-08) the brief currently omits.

**2. CV calibration.** The *ordinal* structure is well-calibrated and is the model's strongest asset — keep it. The *absolute* values are weakly anchored, especially at the two tails: custom/data at 25% sits at or below the field's ~30-40% mean overrun, and AI/ML at 35% under a Normal yields an implausibly tight P95 (+57.6%) for a class where ~30-46% of pilots are abandoned. The COTS-15%/Infra-18% interpolations are honest but low given that 75% of cloud migrations run over budget. Re-anchor COTS specifically on Flyvbjerg 2022 Table 3 (ERP has the *lowest* overrun magnitude — mean ratio 1.3, SD 3.0 — despite high overrun *frequency*); that frequency-vs-magnitude distinction vindicates placing bounded COTS low, but for the right reason.

**3. Adjustment ranges & asymmetry.** The asymmetry instinct is **correct and the best design choice in the four factors** — optimism bias and scope creep are one-directional and right-tailed, so a larger upside penalty than downside credit is right. But: (a) the specific +8%/-5%, -3%/+6% magnitudes are expert priors, not derived figures — label them so; (b) org-change and integration rest on success-rate data, not variance, and plausibly correlate (consider merging them into one "delivery-environment complexity" factor); (c) consider widening the requirements upside to +10% given the heavy right tail.

**4. Additive vs. asymmetry / compounding structure.** Additive summation is a *defensible* explainability choice, but it is mathematically the perfectly-correlated (ρ=1) bound — state that as a deliberate "we assume risk drivers are positively correlated (conservative)" decision. **Do not switch to root-sum-square** (independent variance addition would roughly halve worst-case contingency and is almost certainly too low, since IT risk drivers genuinely co-occur). The real defect is the interaction with the 50% clamp: AI/ML base 35% + all four unfavorable deltas (8+7+6+6=27) = 62%, clamped to 50% — the model is *least* conservative exactly for the multi-unfavorable-factor projects it most needs to flag. At minimum, warn the sponsor whenever the clamp is active; better, add a documented surcharge when 3+ factors are unfavorable and lift the ceiling for AI/ML.

**5. Missing literature.** Four genuinely load-bearing omissions: (1) **Flyvbjerg et al. 2022** (power-law, n=5,392) — the single most decisive study against the Normal choice, by the lead author of the brief's own headline source; (2) **Reference Class Forecasting** (Flyvbjerg 2006) — the cited problem's prescribed remedy, endorsed by HM Treasury; (3) **AACE 18R-97 / 42R-08** — the professional estimating standard that keys accuracy to scope-definition maturity with asymmetric ranges; (4) **Jørgensen's effort-estimation work** — software-specific evidence that nominal 90% intervals empirically capture truth only 60-70% of the time, the smoking gun that practitioner-set widths run narrow.

**6. Better alternatives (within the explainability constraint).** Ranked:
- **(1) Reference-class uplift table** — `Budget = ETC × (1 + uplift_Pn)`, multipliers read off empirical overrun distributions by type. *More* explainable than the CV→z→σ chain ("projects like yours historically ran +X% at P80"), and the only candidate whose tail is empirical rather than assumed. **Recommended primary direction.** Keep the four risk factors as a way to move a project between percentile columns rather than as additive CV deltas.
- **(2) Median-anchored lognormal** — the pragmatic incremental ship: change one formula (`ETC + z·σ` → `ETC × exp(z·σ_log)`, `σ_log = sqrt(ln(1+CV²))`), keeps P50 = ETC exactly, captures the right skew, ~5 lines, no dependencies. Mode-anchored variant available for risk-conservative PMOs. Sell as "less wrong than Normal," not "correct."
- **(3) PERT/Beta-from-CV** — workable and PMP-familiar, but adds a bounded tail (worst representation of the documented power-law) and no better empirical claim than lognormal. If you want the three-point optics, present the lognormal/RCF result *as* an (optimistic / most-likely / P80) triple instead.
- **(4) Cornish-Fisher — reject as a drop-in.** At the P80 default (z=0.842 < 1), the skew term is *negative* and *lowers* the contingency. It only adds protection above ~P84, and is harder to explain and less robust. The lognormal is strictly better on accuracy, transparency, and monotonicity.

---

## 4. Answers to Section 6 open questions

**1. Normal vs. lognormal — materially more accurate for P80, and at what CV does it bite?** This is the most nuanced answer in the review, because the verification stage corrected the critiques here. **It depends entirely on what ETC is:**
- *Under the mode/"most-likely" interpretation the brief actually uses:* yes, Normal understates. A mode-anchored lognormal P80 exceeds the Normal P80 by ~3% of ETC at CV=15%, crosses the decision-relevant 5%-of-budget threshold at **roughly CV 18-22%**, reaches ~10% at CV=25%, and ~20% at CV=35% (the AI/ML band). This vindicates the brief's stated worry — but the *root cause* is the mode/mean conflation (Critical finding #1), not an intrinsic lognormal property.
- *Under a matched-mean, matched-CV comparison:* the Normal P80 is actually the *more conservative* number — a same-mean/same-CV lognormal P80 sits *below* the Normal at every realistic CV, and lognormal only exceeds Normal beyond ~P88-P90. (Note: one critique stated lognormal "exceeds Normal once CV exceeds ~15-20%" — verification found this **mathematically backwards**; the crossover is a *percentile* phenomenon at ~P88, not a CV threshold. See Section 5.)

**Bottom line for Q1:** at the P80 *default*, the honest fix is to correct the *center* (optimism bias), not the *shape*. Switch to lognormal for high-CV classes (≥~22%) to capture skew, default AI/ML to P85, and recognize that *no* thin-tailed distribution captures the power-law tail — manage that with floor/ceiling/percentile choice and explicit caveats, not a higher z-score.

**2. Should CV vary by project type, or be a single global value?** By type — the rank-ordering is defensible and is the model's strongest feature. But Base CV should ideally be *jointly* determined by project type **and** estimate-class / scope-definition maturity (AACE), with an **asymmetric** upper bound. Currently "project type" is a coarse proxy absorbing size and schedule effects; that is valid only for typical-sized projects (state this explicitly).

**3. Additive vs. multiplicative composite CV?** Keep additive for explainability, but **document it as a deliberate ρ=1 (positively-correlated, conservative) assumption** — not as natural sigma addition. Root-sum-square (independence) is too low. A multiplicative form `CV = Base × Π(1+δᵢ)` bites harder for stacked-unfavorable projects (worst case ~65%), which the clamp would absorb anyway — only adopt it if you also fix the clamp. Add an interaction guardrail when 3+ factors are unfavorable.

**4. Asymmetric adjustment factors — justified?** Yes, strongly — the optimism-bias literature supports a larger upside penalty than downside credit. This is the design's best instinct. Relabel the specific magnitudes as expert priors and cite Jørgensen optimism-bias directly rather than PMI incidence stats (which speak to frequency, not magnitude).

**5. Floor (8%) / ceiling (50%) — right values?** The **8% floor is well-supported** — keep it, and tie it to an AACE estimate-class statement (even the most refined estimate class retains a non-zero positive range). The **50% ceiling is the problem**: it truncates exactly the tail the model invokes as motivation. A Normal P80 at the ceiling is only +42% — below Flyvbjerg's mean once ETC optimism is accounted for, and an order of magnitude below the Green Book +200% IT uplift. Lift the ceiling toward ~70-75% for AI/ML and bespoke work, or add an explicit, separately-labeled "non-modeled black-swan / tail reserve" note so sponsors understand P80 contingency is **not catastrophe insurance**.

**6. Is AI/ML at 35% sufficient?** Likely **not** under a Normal. A 35% Normal CV gives P80 +29.5% and P95 +57.6% — implausibly tight for a class with documented ~80% value-failure rates (RAND) and ~30-40% pilot abandonment (Gartner/MIT). The mode-anchored lognormal at CV=35% gives P80 ~+49%, a 20-point gap. Recommended: raise AI/ML toward 40-45% **and** move it to lognormal (or route pure R&D/GenAI work to a dedicated AI reference class entirely), default to P85-P90, and pair with a sponsor caveat. Note Flyvbjerg's data predates the LLM wave, and failure-*rate* data is not a CV — commission/cite a source reporting AI cost-overrun *dispersion* before hard-coding a number.

**7. Scrum/Agile applicability — does iteration reduce project-level cost variance?** Partially, and this is the one place the model's optimism may be *justified*. Disciplined flexible-method delivery shows lower overrun magnitude (mean ~9% vs ~29% sequential), which legitimately supports a custom-software CV below the all-methods field average — **provided the tool is used only for genuinely-agile delivery** (state this scope bound; it is *not* calibrated for waterfall or fixed-scope vendor megaprojects). But iteration reduces *per-increment* variance, not *project-level* cost variance, and Scrum typically fixes cost/time and varies **scope**. Add a one-line caveat to the charter output: *"This P80 assumes the chartered scope is delivered; in a fixed-budget Scrum model, overruns may instead surface as reduced scope."* Optionally drive CV partly off sprint-count uncertainty rather than a single labor point estimate. **Never cite Standish CHAOS** to support an Agile cost claim — those figures are non-reproducible (Eveleens & Verhoef 2010).

---

## 5. Corrections to the brief's own factual claims (verification-confirmed only)

These are items the adversarial verification stage confirmed as miscited or overstated **in the brief**:

1. **McConnell Cone milestone misattribution.** The brief's "±50-75% at initiation" is wrong. At Initial Concept the Cone is **0.25x–4x** (roughly -75%/+300%, a 16x asymmetric span). The ±50% band (0.5x–2x) corresponds to a *later* milestone (Approved Product Definition). A charter sits at the *wide* end. The "translates to ~17-25% sigma" step is an undisclosed assumption (it only works under an unstated ±3σ envelope). *Verified across three critiques.*

2. **The 27% mean shift is cited but not implemented.** The brief states it treats Flyvbjerg's 27% as a mean shift, yet the formula `Budget = ETC + z·σ` leaves ETC unshifted — so the cited evidence does no work. This is a confirmed structural inconsistency, not an interpretation.

3. **"σ = ETC × CV" is internally contradictory with the "most likely cost" (mode) framing.** The identity is coherent only if ETC is the *mean*. Confirmed.

4. **COCOMO multipliers are point-estimate (mean) shifts, not dispersion parameters.** Confirmed methodologically; using them to size a CV is an analogy, not a derivation. *(Note: one critique cited the PEXP range as 1.25-0.81 and LTEX low end as 1.22 — verification found PEXP is actually 1.19-0.85 and LTEX 1.20-0.84; the ~±20% magnitude and the category point both stand. Down-weight the specific numbers, keep the conclusion.)*

5. **Prosci/McKinsey quantify success *likelihood*, not cost variance.** Confirmed — the org-change +6% magnitude is a designed value its citation does not quantitatively support.

**Claims NOT forwarded (flagged in verification as wrong/unverifiable):**
- The claim that a same-mean/same-CV lognormal P80 "exceeds the Normal once CV exceeds ~15-20%" — verification found this **backwards**; at P80 the lognormal is *below* the Normal at every CV, with crossover at ~P88. Corrected in Section 4 Q1.
- The "Flyvbjerg α ≤ 1, neither mean nor variance exist" formulation — verification found the paper's headline α is **~2.3-2.35** (finite mean, infinite variance only in a deep-tail sub-range 7.1 ≤ x0 ≤ 18.8). Reference "fat-tailed / infinite variance in the deep tail," not "α ≤ 1." *(A separate 2026 cross-type study reports IT as the one type with α ≤ 1; that is a distinct, verified source.)*
- The "18% exceed 50%, averaging 447%" line is genuine Flyvbjerg but is from *How Big Things Get Done* (2023), **not** the 2022 paper — attribute it correctly if used.
- KPMG "79% of cloud initiatives exceed budget," Panorama "47-58% historical ERP," and the AI "380% overrun / 46% PoC scrapped" figures are unverifiable or vendor-grade — use only directionally, prefer the verified McKinsey 75% / RAND 80% / Gartner 30% figures.

---

## 6. Prioritized recommendations

**Must-fix (before claiming "P80"):**
- Define ETC explicitly (mode/median/mean) in code *and* UI; add a separately-labeled optimism-bias uplift to the *center* before applying spread.
- Fix the McConnell Cone citation (charter = wide end, 0.25x–4x) and stop presenting the Cone as a probability distribution.
- Warn the sponsor whenever the 50% clamp is active — that is the least-trustworthy output.
- Drop Cornish-Fisher from consideration as an incremental path (it lowers P80).

**Should-fix:**
- Switch high-CV classes (≥~22%, esp. AI/ML) to a median-anchored lognormal (one-line change); default AI/ML to P85.
- Label additive CV summation as a deliberate positive-correlation (ρ=1) assumption; add a 3+-unfavorable-factor surcharge and lift the ceiling for AI/ML.
- Re-anchor COTS/Infra on AACE 18R-97 classes and Flyvbjerg 2022 Table 3; relabel org-change/integration as expert priors (consider merging them).
- Add the fixed-scope/Scrum caveat to the charter output ("overruns may surface as reduced scope").

**Nice-to-have:**
- Build a Reference Class Forecasting track seeded from the SPERT suite's accumulating real actuals — the most defensible *and* most explainable end-state.
- Add a SIZE/duration factor (grounded in the COCOMO E=1.0997 exponent the brief already trusts) and a schedule-compression flag.
- Back-test charter-vs-actual once enough projects accumulate (citing Jørgensen's 60-70% hit-rate as the calibration motivation).
- Add a unit test pinning the lognormal P80 multipliers so skew behavior can't silently regress.

---

## 7. References

- Flyvbjerg, Budzier, Lee, Keil, Lunn & Bester (2022), *The Empirical Reality of IT Project Cost Overruns: Discovering a Power-Law Distribution*, JMIS 39(3) — https://arxiv.org/abs/2210.01573
- Flyvbjerg & Budzier (2011), *Why Your IT Project May Be Riskier Than You Think*, HBR — https://hbr.org/2011/09/why-your-it-project-may-be-riskier-than-you-think (full text: https://arxiv.org/abs/1304.0265)
- Flyvbjerg (2006), *From Nobel Prize to Project Management: Getting Risks Right* (Reference Class Forecasting) — https://arxiv.org/pdf/1302.3642
- Flyvbjerg, Budzier, Aaen, Keil & Zottoli (2026), *The Uniqueness of IT Cost Risk: A Cross-Group Comparison of 23 Project Types* — https://journals.sagepub.com/doi/10.1177/87569728251340590
- Flyvbjerg & Gardner (2023), *How Big Things Get Done* (18% >50% overrun, avg 447%) — book; megaproject database
- AACE International RP 18R-97, *Cost Estimate Classification System* — https://web.aacei.org/docs/default-source/toc/toc_18r-97.pdf
- AACE International RP 119R-21, *Cost Estimate Accuracy Range and Contingency Determination* — https://web.aacei.org/docs/default-source/toc/toc_119r-21.pdf
- AACE International RP 42R-08, *Risk Analysis and Contingency Determination Using Parametric Estimating* — https://web.aacei.org/docs/default-source/toc/toc_42r-08.pdf
- HM Treasury Supplementary Green Book Guidance: *Optimism Bias* (Mott MacDonald 2002; Equipment/Development +200% capex) — https://assets.publishing.service.gov.uk/media/5a74dae740f0b65f61322c72/Optimism_bias.pdf
- McConnell, S. (2006), *Software Estimation* — The Cone of Uncertainty (Initial Concept 0.25x–4x; best-case/"Cloud" caveat) — https://www.construx.com/books/the-cone-of-uncertainty/ ; excerpt: https://athena.ecs.csus.edu/~buckley/CSc231_files/McConell_ConeofUncertainty.pdf
- Boehm et al., *COCOMO II Model Definition Manual* (multiplicative EAF; APEX 1.22–0.81, PLEX 1.19–0.85, LTEX 1.20–0.84; SCED 1.43; E=1.0997) — https://athena.ecs.csus.edu/~buckley/CSc231_files/Cocomo_II_Manual.pdf
- Little, T. (2006), *Schedule Estimation and Uncertainty Surrounding the Cone of Uncertainty*, IEEE Software 23(3):48-54 (lognormal; cone does not narrow) — https://ieeexplore.ieee.org/document/1628940/
- Eveleens & Verhoef (2010), *The Rise and Fall of the Chaos Report Figures*, IEEE Software 27(1):30-36 — https://www.cs.vu.nl/~x/the_rise_and_fall_of_the_chaos_report_figures.pdf
- Jørgensen, *Realism in Assessment of Effort Estimation Uncertainty* (90% intervals capture truth 60-70%) — https://ieeexplore.ieee.org/document/1274041/ ; *Eliminating Over-Confidence* — https://web-backend.simula.no/sites/default/files/publications/SE.5.Joergensen.2004.b.pdf
- Jørgensen & Grimstad, *Over-Optimism in Software Development Projects: The Winner's Curse* — https://www.simula.no/research/over-optimism-software-development-projects-winners-curse
- Moløkken-Østvold & Jørgensen (2003/2004), *A Review of Surveys on Software Effort Estimation* (30-40% mean overrun; flexible 0.09 vs sequential 0.29) — https://web-backend.simula.no/sites/default/files/publications/SE.3.Moloekken-Oestvold.2004.pdf
- PMI (2018), *Pulse of the Profession* (43% miss budget; 52% scope creep; 47% requirements-driven failure) — https://www.pmi.org/-/media/pmi/documents/public/pdf/about/press-media/press-release/pulse-of-the-profession-2018-media-release.pdf
- PMI, *Toward a Unifying Theory for Compounding/Cumulative Impacts of Project Risks* — https://www.pmi.org/learning/library/small-setbacks-drives-cost-budget-8286
- Prosci, *The Correlation Between Change Management and Project Success* (88% vs 13%; 7x; 1.5x on-budget) — https://www.prosci.com/blog/the-correlation-between-change-management-and-project-success
- McKinsey/Oxford, *Delivering Large-Scale IT Projects On Time, On Budget, and On Value* (45% over budget; $15M+ threshold) — https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/delivering-large-scale-it-projects-on-time-on-budget-and-on-value
- McKinsey, *Cloud-Migration Opportunity* (75% over budget, 38% behind schedule) — https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/cloud-migration-opportunity-business-value-grows-but-missteps-abound
- RAND (2024), *The Root Causes of Failure for AI Projects* (~80% failure, ~2x non-AI) — https://www.rand.org/pubs/research_reports/RRA2680-1.html
- Gartner (2024), *30% of GenAI projects abandoned after PoC by end-2025* — https://www.gartner.com/en/newsroom/press-releases/2024-07-29-gartner-predicts-30-percent-of-generative-ai-projects-will-be-abandoned-after-proof-of-concept-by-end-of-2025
- Reference Class Forecasting / DfT–Green Book optimism-bias uplift tables (Edinburgh Tram P50 +40%, P80 +57%) — https://en.wikipedia.org/wiki/Reference_class_forecasting
- Cornish–Fisher expansion (sign of skew term flips at z=1, P≈84%) — https://en.wikipedia.org/wiki/Cornish%E2%80%93Fisher_expansion
- Log-normal distribution (mode = exp(μ−σ²); quantile = exp(μ+z·σ)) — https://en.wikipedia.org/wiki/Log-normal_distribution
