# Tasks: Responsive Redesign — app-responsive

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~60 (26 unique, ~34 context in diff) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | auto-forecast |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

All changes are single-class-string edits in 7 JSX files. No logic, no new components, no dependencies.

---

## Phase 1: Foundation

- [ ] 1.1 **Verify index.html viewport** — Confirm `<meta name="viewport" content="width=device-width, initial-scale=1.0">` exists in `index.html`
- [ ] 1.2 **Verify App.jsx nav** — Confirm `hidden sm:inline` on nav labels and `hidden sm:flex` on user info are adequate. No changes expected.

## Phase 2: Pages — Responsive Adjustments

- [ ] 2.1 **Login + Register form padding** — `src/pages/Login.jsx`, `src/pages/Register.jsx`: change form container `px-6` → `px-6 sm:px-8` for tighter mobile spacing

- [ ] 2.2 **Catalog grids + toast** — `src/pages/Catalog.jsx`: add `grid-cols-1` to school grid and course grid; add `left-4 sm:left-auto max-w-sm` to toast

- [ ] 2.3 **Cart layout + touch targets** — `src/pages/Cart.jsx`: item row `flex` → `flex-col sm:flex-row`; quantity buttons `w-8 h-8` → `min-w-[44px] min-h-[44px]`

- [ ] 2.4 **Orders badge/footer wrap** — `src/pages/Orders.jsx`: add `flex-wrap` on badge row and footer action container

- [ ] 2.5 **Admin.jsx — tables, tabs, form, toast, touch** — `src/pages/Admin.jsx`: 6 table cards `overflow-hidden` → `overflow-x-auto`; tab bar add `overflow-x-auto flex-nowrap`; toast add `left-4 sm:left-auto max-w-sm`; booklet form grid add `grid-cols-1`; action buttons add `min-h-[44px]`

- [ ] 2.6 **ContabilidadTab.jsx — tables, sub-tabs, toast** — `src/pages/ContabilidadTab.jsx`: 2 table cards `overflow-hidden` → `overflow-x-auto`; sub-tabs add `overflow-x-auto`; toast add `left-4 sm:left-auto max-w-sm`

## Phase 3: Verification

- [ ] 3.1 **Viewport visual check** — Open all pages at 320px, 375px, 768px in Chrome DevTools. Verify: no horizontal page overflow, tables scroll, tabs accessible, toasts contained, grids stack to 1 col

- [ ] 3.2 **Touch target audit** — Inspect computed dimensions of all modified interactive elements. Verify `min-height: 44px` / `min-width: 44px` or larger

- [ ] 3.3 **Desktop regression** — Verify all pages at 1024px+ show no layout differences from current production. All `sm:` / `md:` classes are additive mobile-first
