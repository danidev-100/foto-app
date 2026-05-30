# Proposal: Booklet Progress Tracking

## Intent

Admin needs per-student booklet delivery tracking — who received (completed) each booklet vs. pending. No tracking exists today.

## Scope

### In Scope
- `StudentBookletProgress` model + `ProgressStatus` enum (Prisma)
- Auto-create pending records for all course students on booklet creation (`$transaction`)
- `ProgressService` + `ProgressController` + routes under `/api/admin/progress`
- `GET /` — summary: booklet, course, division, completed/total/pending (filterable by `school_id`)
- `GET /:bookletId` — student detail per booklet
- `PATCH /:id` — toggle pending ↔ completed
- `ContabilidadTab.jsx` — standalone component, summary table + drill-down
- School filter on summary
- Backend + frontend tests

### Out of Scope
- Auto-assign for students created after booklet (future)
- Division-level filtering (course-level only)
- Bulk updates, CSV, notifications, student-facing view

## Capabilities

### New Capabilities
- `booklet-progress-tracking`: Per-student booklet delivery progress. Admin summary, student detail, status toggle.

### Modified Capabilities
- None.

## Approach

1. Prisma: `ProgressStatus` enum + `StudentBookletProgress` model (uuid PK, FKs to Student/Booklet, unique `[studentId, bookletId]`)
2. `CatalogService.createBooklet()` — after insert, query students by `courseId`, bulk-create progress in `$transaction`
3. `ProgressService` — summary aggregation, student detail, toggle
4. `ProgressController` — 3 handlers (`successJSON`/`errorJSON`)
5. Routes: `/api/admin/progress` behind `authMiddleware` + `adminMiddleware`
6. Frontend: extract `ContabilidadTab.jsx` from Admin.jsx — progress bar, counts, % per booklet; row click → student list with toggle
7. Tests: `backend/tests/progress.test.js` (supertest), `frontend/src/__tests__/ContabilidadTab.test.jsx`

## Affected Areas

| Area | Impact |
|------|--------|
| `backend/prisma/schema.prisma` | Modified |
| `backend/src/services/catalog.service.js` | Modified |
| `backend/src/services/progress.service.js` | New |
| `backend/src/controllers/progress.controller.js` | New |
| `backend/src/routes/admin.routes.js` | Modified |
| `frontend/src/api/admin.js` | Modified |
| `frontend/src/components/ContabilidadTab.jsx` | New |
| `frontend/src/pages/Admin.jsx` | Modified |
| `backend/tests/progress.test.js` | New |
| `frontend/src/__tests__/ContabilidadTab.test.jsx` | New |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Large student sets slow booklet creation | Med | Batch inserts in transaction |
| Cascade orphans on delete | Low | Prisma FK handling |
| Admin.jsx import coupling | Med | Standalone component, props-only |

## Rollback Plan

- Revert Prisma schema, drop table + type (`DROP TYPE IF EXISTS "ProgressStatus" CASCADE`)
- Restore all new/changed files from git
- No data loss — existing entities untouched

## Dependencies

- Prisma migration (`prisma migrate dev` / `prisma db push`)
- Admin auth middleware in place
- No new packages

## Success Criteria

- [ ] Booklet creation auto-creates pending progress for course students
- [ ] `GET /api/admin/progress` returns correct summary counts
- [ ] `GET /api/admin/progress/:bookletId` lists students with status
- [ ] `PATCH /api/admin/progress/:id` toggles status, rejects invalid IDs
- [ ] ContabilidadTab renders summary table, filterable by school
- [ ] All existing tests pass
