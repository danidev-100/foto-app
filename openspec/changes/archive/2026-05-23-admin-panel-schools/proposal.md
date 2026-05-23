# Proposal: Admin Panel — School Segmentation

## Intent

Add school (colegio) awareness to the admin panel so admins can create booklets filtered by school, see school affiliation for each booklet/order, and group orders by school.

## Scope

### In Scope
- School selector in booklet creation form (before level/grade)
- "Colegio" column with school badge(s) in booklets table
- School column + grouping by school in orders table (collapsible section headers)
- Backend: include schools in `listAllBooklets()` and `adminListOrdersWithDetails()`
- Backend: `GET /api/admin/schools` endpoint

### Out of Scope
- Filtering booklets table by school (deferred)
- Per-school admin roles / permissions
- School CRUD in admin panel (exists via catalog routes)
- Student-facing catalog changes

## Capabilities

### New Capabilities
- `admin-school-integration`: Schools metadata in admin booklet/order listings, school-aware booklet creation

### Modified Capabilities
- None — existing `booklet-ordering-app.md` spec is Go/Fiber-based and detached from the actual Node.js codebase

## Approach

**Backend** — 3 files:

`catalog.service.js` `listAllBooklets()`: add Prisma `include: { course: { include: { schools: { include: { school: true } } } } }`.

`order.service.js` `adminListOrdersWithDetails()`: include `student.course.schools.school` in the Prisma query so each order carries a `schools[]` array.

`admin.routes.js`: add `GET /schools` → passthrough to existing `CatalogController.listSchools`.

**Frontend** — `Admin.jsx` + `api/admin.js`:

| Tab | Change |
|-----|--------|
| Booklets form | Add school `<select>` dropdown before level. Fetch via `adminGetSchools()`. Filter available courses by selected school. |
| Booklets table | `<th>Colegio</th>` with school name badges from `booklet.schools[]`. |
| Orders table | `<th>Colegio</th>` column showing school name(s). Group rows by school with sticky section headers. |
| API | Add `adminGetSchools = () => api.get('/admin/schools')`. |

**Edge case**: A booklet's course can link to 0..N schools. Show all as badges. For order grouping, use first school in array when an order links to multiple.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| M:N school→course could produce duplicate rows | Low | Prisma `include` handles dedup at relation level |
| Student has no courseId (nullable) | Medium | Frontend shows "—" when `schools[]` is empty |

## Rollback Plan

Revert the 3 backend files and Admin.jsx. The admin schools endpoint is additive and harmless if left.

## Dependencies

- `GET /api/catalog/schools` already exists
- No new packages required

## Success Criteria

- [ ] Booklet creation has school dropdown before level/grade
- [ ] Booklets table shows "Colegio" column with school badges
- [ ] Orders table shows "Colegio" column and groups by school
- [ ] Backend responses include `schools[]` for booklets and orders
- [ ] Existing student-facing catalog is unchanged
