# Tasks: Shared Component Library

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 600-700 |
| 500-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (presentational) → PR 2 (interactive) → PR 3 (migration) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Presentational components | PR 1 → main | Badge, EmptyState, Loading, Pagination (indepedent, ~170 new lines) |
| 2 | Interactive components | PR 2 → main | ToastProvider, Modal, ConfirmDialog + App.jsx wrap (~210 new lines) |
| 3 | Page migrations | PR 3 → main | Replace inline patterns in all 8 pages (~260 modified lines) |

## Phase 1: Presentational Components

- [x] 1.1 Create `frontend/src/components/Badge.jsx` — variant/size/className props, dark mode, sm/md sizes
- [x] 1.2 Create `frontend/src/components/EmptyState.jsx` — icon/message/description/action props
- [x] 1.3 Create `frontend/src/components/Loading.jsx` — spinner, skeleton lines (count prop), card variants
- [x] 1.4 Create `frontend/src/components/Pagination.jsx` — prev/next, page info, boundary disable, hide on single page

## Phase 2: Interactive Components

- [x] 2.1 Create `frontend/src/components/ToastProvider.jsx` — context + useReducer + portal, toast.success/error/info, auto-dismiss, queue cap 5
- [x] 2.2 Create `frontend/src/components/Modal.jsx` — portal to body, backdrop, Escape close, size variants, title/body/footer slots
- [x] 2.3 Create `frontend/src/components/ConfirmDialog.jsx` — Modal wrapper, confirm/cancel callbacks, danger variant, custom labels

## Phase 3: Page Integration

- [x] 3.1 Wrap `<Routes>` with `<ToastProvider>` in `App.jsx`; replace `window.confirm()` on logout with ConfirmDialog
- [x] 3.2 Update `Admin.jsx` — replace toasts, confirm dialogs, loading, badges, pagination, empty states
- [x] 3.3 Update `Catalog.jsx` — replace toast, loading, empty state
- [x] 3.4 Update `Cart.jsx` — replace loading, empty state
- [x] 3.5 Update `Orders.jsx` — replace status badges, loading, empty state
- [x] 3.6 Update `ContabilidadTab.jsx` — replace toasts, loading, badges, empty state
- [x] 3.7 Update `Login.jsx` and `Register.jsx` — replace inline spinner with `<Loading variant="spinner">`

## Phase 4: Verification

- [ ] 4.1 Test each component renders with required props (RTL mount + assert DOM)
- [ ] 4.2 Test Toast types render correct colors and auto-dismiss (3000ms default)
- [ ] 4.3 Test Modal open/close, backdrop click, Escape close, size variants
- [ ] 4.4 Test Pagination disables at bounds and hides on totalPages <= 1
- [ ] 4.5 Test ConfirmDialog confirm/cancel callbacks and danger variant renders red button
- [ ] 4.6 Verify no visual regressions — compare each page replacement side-by-side
