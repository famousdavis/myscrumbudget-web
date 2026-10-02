# MyScrumBudget

Scrum project budget forecasting tool. Replaces a GPL-licensed Excel spreadsheet (MyScrumBudget_1.5.xlsx) with a modern, localStorage-first web app.

**Author:** William W. Davis

## Quick Start

```bash
npm install
npm run dev       # Development server at http://localhost:3000
npm run test      # Run test suite
npm run build     # Production build
```

## Features

- **Project management** — Create, edit, and delete projects with budget tracking
- **Global team pool** — Manage team members once, assign to any project
- **Allocation grid** — Spreadsheet-like grid with inline editing, multi-cell selection, drag-to-fill, and keyboard navigation
- **Reforecast snapshots** — Create named reforecasts, copy allocations from previous versions
- **Productivity windows** — Define reduced-capacity periods (holidays, onboarding) that adjust calculations without modifying allocations
- **Forecast metrics** — ETC, EAC, variance, budget ratio, weekly burn rate, NPV
- **SVG charts** — Monthly cost bar chart and cumulative cost line chart with tooltips
- **Data portability** — JSON export/import for backup and transfer
- **Cloud storage** — Optional Firebase cloud persistence with real-time sync, Google + Microsoft SSO, and project sharing (owner/editor/viewer roles)

## Domain Glossary

| Term | Definition |
|------|-----------|
| **ETC** (Estimate to Complete) | Sum of all forecasted future costs |
| **EAC** (Estimate at Completion) | Actual Cost + ETC — total expected project spend |
| **Variance** | EAC - Baseline Budget — positive means over budget |
| **Budget Ratio** | Baseline / EAC — greater than 1.0 means under budget |
| **Burn Rate** | ETC ÷ calendar weeks remaining in the forecast — each Monday–Friday counts as one week, holidays included |
| **NPV** (Net Present Value) | Time-adjusted value of future cash flows |
| **Allocation** | Percentage (0-100%) of a team member's time dedicated to a project for a given month |
| **Reforecast** | A named snapshot of allocations and productivity windows for comparison |
| **Productivity Window** | A date range with a capacity factor (0-100%) applied at calculation time to the working days it covers |
| **Pool Member** | A team member in the global pool, reusable across projects |
| **Project Assignment** | A link from a pool member into a specific project's allocation grid |

## Intentional Divergences from the Spreadsheet

1. **Annual discount rate converted to monthly** — The original spreadsheet passes the discount rate directly to Excel's `NPV` function with monthly cash flows. We treat the stored rate as annual and convert to monthly internally (`annual / 12`) for standard financial semantics.

2. **Budget Ratio, not CPI** — This tool does not implement Earned Value Management (EVM). There is no earned value tracking. The "Budget Ratio" (Baseline / EAC) compares the original budget to the current forecast, not earned value to actual cost.

3. **Productivity windows (web-only enhancement)** — The original spreadsheet has no concept of productivity adjustments. This feature allows modeling reduced capacity periods without modifying stored allocation data. A window applies only to the working days it covers: weekends and holidays are already days off, so a window over them changes nothing, and entering time off as a holiday, a 0% window, or both gives the same result (v0.43.0).

4. **Burn rate counts the forecast's calendar weeks** — The spreadsheet divides ETC by the weeks from the start date to `EDATE(start, months with allocations)`, which treats every month the project touches as a full month. We divide by the calendar weeks from the first forecast day (the start, or the day after Actuals Through) to the finish date, counting each Monday–Friday as one week — holidays included, a partial week by its weekdays — so ETC ÷ burn rate equals the time remaining. (Since v0.43.0; earlier versions matched the spreadsheet.)

## Architecture

See `ARCHITECTURE.md` for the complete technical specification, including domain model, calculation formulas, storage schema, and incremental build plan.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict mode)
- Tailwind CSS v4
- Vitest (test runner)
- Firebase (optional cloud storage, auth, Firestore)
- SVG charts (no heavy chart libraries)
- localStorage (default client-side persistence)

## Legal

The `/legal/` directory contains reference copies of `TOS.pdf` and `PRIVACY.pdf`. The canonical versions used by the app at runtime are https://spertsuite.com/TOS.pdf and https://spertsuite.com/PRIVACY.pdf.

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
