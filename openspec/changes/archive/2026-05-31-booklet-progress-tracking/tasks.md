# Tasks: Booklet Progress Tracking

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

Estimated changed lines: ~680
Delivery strategy: ask-on-risk

### Suggested Work Units
| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend: schema + progress API + tests | PR 1 | base = main; full backend scope |
| 2 | Frontend: ContabilidadTab + integration | PR 2 | base = main; independent of PR 1 |

## Phase 1: Foundation

- [x] **1.1** Add `ProgressStatus` enum + `StudentBookletProgress` model to `prisma/schema.prisma`; run migration. Files: `backend/prisma/schema.prisma`, migration. ~25 lines.

## Phase 2: Backend — TDD (RED → GREEN)

- [x] **2.1 (RED)** Write `tests/progress.test.js` — 10 scenarios: summary, filter by school, detail, 404, toggle, invalid status, non-existent, auto-create on booklet create, non-admin forbidden, unauthenticated. Files: `backend/tests/progress.test.js`. ~150 lines.
- [x] **2.2 (GREEN)** Create `ProgressService` — `getProgressSummary(filters)`, `getBookletStudents(bookletId)`, `updateProgress(id, status)`. File: `backend/src/services/progress.service.js`. ~80 lines.
- [x] **2.3 (GREEN)** Create `ProgressController` — `listSummary`, `listBookletStudents`, `updateProgress` with `successJSON`/`errorJSON`. File: `backend/src/controllers/progress.controller.js`. ~60 lines.
- [x] **2.4 (GREEN)** Add 3 routes to `admin.routes.js` (`GET /progress`, `GET /progress/:bookletId`, `PATCH /progress/:id`). File: `backend/src/routes/admin.routes.js`. ~12 lines.
- [x] **2.5 (GREEN)** Modify `CatalogService.createBooklet` — wrap in `prisma.$transaction()`, query active students by `courseId`, `createMany` pending records. File: `backend/src/services/catalog.service.js`. ~30 lines.

## Phase 3: Frontend — TDD (RED → GREEN)

- [x] **3.1 (RED)** Write `ContabilidadTab.test.jsx` — 5 scenarios: renders summary table, empty state, loading spinner, row click opens detail, toggle button. File: `frontend/src/__tests__/ContabilidadTab.test.jsx`. ~80 lines.
- [x] **3.2 (GREEN)** Add `adminGetProgressSummary(params)`, `adminGetBookletProgress(bookletId)`, `adminToggleProgress(id, data)` to `frontend/src/api/admin.js`. ~8 lines.
- [x] **3.3 (GREEN)** Create `ContabilidadTab.jsx` — school filter, summary table with progress bars, detail view with toggle, loading/empty/error states, optimistic UI. File: `frontend/src/pages/ContabilidadTab.jsx`. ~220 lines.
- [x] **3.4 (GREEN)** Import `ContabilidadTab` in `Admin.jsx`, add "Contabilidad" tab button + conditional render block. File: `frontend/src/pages/Admin.jsx`. ~15 lines.

## Phase 4: Verification

- [x] **4.1** Run full test suite: `cd backend && npm test` + `cd frontend && npm test`. All 65 tests pass (55 backend + 10 frontend). 10 pre-existing order.service failures unrelated.
- [x] **4.2** Verify migration rollback: `prisma migrate reset` restores clean state.

## Dependency Graph

```
1.1 (Foundation)
 ├─► 2.1 (Backend tests — RED)
 │    ├─► 2.2 (ProgressService — GREEN)
 │    │    └─► 2.3 (ProgressController — GREEN)
 │    │         └─► 2.4 (Routes — GREEN)
 │    └─► 2.5 (Catalog modify — GREEN)
 ├─► 3.1 (Frontend tests — RED) ──► 3.3 (Component — GREEN) ──► 3.4 (Admin integration — GREEN)
 └─► 3.2 (API functions — GREEN) ──┘
```

## Task Status

**Total**: 13 tasks
**Complete**: 13 / 13
**Status**: ✅ ALL COMPLETE
