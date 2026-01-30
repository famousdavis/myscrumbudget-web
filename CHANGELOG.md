# Changelog

All notable changes to MyScrumBudget are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.4.0] - 2026-01-29

### Bug Fixes
- Last reforecast deletion guard — prevents deleting the only reforecast
- Negative budget/actual cost validation with 3-layer protection (HTML, JS clamp, submit)
- Import now runs data migrations before persisting (fixes stale-format imports)
- Fixed empty-state early return hiding the "+ Add member" control in allocation grid

### Accessibility
- Skip-to-content keyboard link (hidden until Tab-focused)
- Color-only information remediation — Unicode indicators and text labels on variance, ratio, and EAC
- Keyboard-accessible project reordering (move up/down buttons alongside drag handle)

### UI/UX
- Mobile-responsive sidebar navigation with hamburger menu
- Empty states with dashed borders and hint text across allocation grid, team pool, and metrics panel
- Confirmation dialog for reforecast deletion (replaces inline Yes/No)

### Testing
- Edge-case tests: zero-budget projects, single-month projects, orphaned assignments, productivity windows
- Import/export round-trip and migration-on-import tests
- 204 passing tests across 15 test files

## [0.3.0] - 2026-01-29

### Reforecasts
- Create, switch, and delete reforecasts for any project
- Copy allocations from a prior reforecast when creating a new one
- Default copy-from selection is the most recently added reforecast

### Productivity Windows
- Define date-ranged productivity factors that adjust hours and cost
- Day-weighted blending for months that span window boundaries
- Productivity is a calculation overlay — stored allocations are never mutated

### Dashboard & UX
- Drag-to-reorder project tiles on the Dashboard
- Auto-focus project name field on New Project form
- End date calendar defaults to start date + 1 business day
- Currency fields display formatted values ($327,160) and switch to raw input on edit
- Team Pool: add-member form moved above the member list, sorting by name or role

### Charts & Metrics
- Cumulative cost chart now includes actual cost (EAC trajectory)
- ETC (Estimate to Complete) added to project summary bar

### Bug Fixes
- Fixed stale data when navigating away from project edit (debounced save flush)
- Fixed productivity factor day-weighted blending calculation

## [0.2.0] - 2026-01-29

### Global Team Pool
- Centralized team member management at /team with add, edit, and delete
- In-use guard prevents deleting team members assigned to projects
- Project assignments via pool picker in the allocation grid

### Calculation Engine
- Full calculation engine: ETC, EAC, variance, budget ratio, burn rate, NPV
- Golden-file spreadsheet parity tests ensuring math matches the original Excel

### Charts
- SVG monthly cost bar chart
- SVG cumulative cost line chart

### Architecture
- Data migration system with MigrationGuard component
- Repository pattern with async interface for future backend support
- Debounced save hook for responsive UI with batched persistence

## [0.1.0] - 2026-01-28

### Initial Release
- Settings page with labor rates, hours/month, and discount rate configuration
- JSON export/import for data portability
- Project CRUD with dashboard and project detail pages
- Allocation grid with inline editing, multi-cell selection, and drag-to-fill
- Dark mode support
- localStorage-based persistence
