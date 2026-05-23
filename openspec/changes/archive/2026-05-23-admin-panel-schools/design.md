# Design: Admin Panel — School Segmentation

## Technical Approach

Extend the existing Prisma query chains in `CatalogService.listAllBooklets()` and `OrderService.adminListOrdersWithDetails()` to eager-load school data via the M:N `SchoolCourse` junction. Add a lightweight `GET /admin/schools` route that delegates to the existing `CatalogController.listSchools`. On the frontend, thread a `schools` array through `Admin.jsx` state and add a school selector before the level/grade picker in the creation form. The design is purely additive — no existing queries change shape, only their includes widen.

## Architecture Decisions

### Decision: Widen Prisma includes instead of mapping in controllers

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Eager-load schools via Prisma `include` | Larger response payload, no extra roundtrips | ✅ Chosen — fits existing pattern |
| Separate API call per booklet to fetch schools | N+1 queries | ❌ Rejected — performance cliff |
| Map schools in a controller layer | More code, duplicates Prisma relation resolution | ❌ Rejected — unnecessary indirection |

**Rationale**: The project already does `include` chains in `CatalogService.listSchools()` (school → courses → divisions). Widening `listAllBooklets` and `adminListOrdersWithDetails` follows the identical pattern. No new abstraction needed.

### Decision: Group orders by school on the frontend, not the backend

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Frontend groups a flat `orders[]` by `student.course.schools[0]` | Simple, no backend change to response shape | ✅ Chosen — grouping is a UI concern |
| Backend returns `{ [schoolName]: orders[] }` | Couples API shape to one UI view | ❌ Rejected — harder to reuse |

**Rationale**: The orders API already returns student data. Adding school info to the existing shape makes it available to all consumers without special-casing the grouping format.

## Data Flow

```
Admin.jsx  ──GET /admin/schools──→  CatalogController.listSchools
                                          │
                                     CatalogService.listSchools
                                          │
                                     prisma.school.findMany({ include: { courses... } })

Admin.jsx  ──GET /admin/booklets──→  CatalogService.listAllBooklets
                                          │
                                     prisma.booklet.findMany({
                                       include: { course: { include: { schools: { include: { school } } } } }
                                     })

Admin.jsx  ──GET /admin/orders/details──→  OrderService.adminListOrdersWithDetails
                                                │
                                           prisma.order.findMany({
                                             include: { student: {
                                               include: { course: { include: { schools: { include: { school } } } } }
                                             }}
                                           })

Frontend: orders grouped by school name via .reduce() in component
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/services/catalog.service.js` | Modify | `listAllBooklets()`: add `include` chain for course → schools → school |
| `backend/src/services/order.service.js` | Modify | `adminListOrdersWithDetails()`: widen student include to include course.schools |
| `backend/src/services/order.service.js` | Modify | `adminSearchOrdersByStudentName()`: widen student include for school data |
| `backend/src/routes/admin.routes.js` | Modify | Add `GET /schools` route pointing to `catalog.listSchools` |
| `frontend/src/api/admin.js` | Modify | Add `adminGetSchools()` export |
| `frontend/src/pages/Admin.jsx` | Modify | State, school selector, "Colegio" columns, order grouping |
| `openspec/changes/admin-panel-schools/proposal.md` | None | Already accurate — no changes needed |

## API Contract Changes

### GET /api/admin/booklets — Before

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Matemáticas U1",
      "currentPrice": 1500.00,
      "courseId": "uuid",
      "divisionId": "uuid"
    }
  ]
}
```

### GET /api/admin/booklets — After

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Matemáticas U1",
      "currentPrice": 1500.00,
      "courseId": "uuid",
      "divisionId": "uuid",
      "course": {
        "id": "uuid",
        "name": "Primaria - 1° Primero",
        "schools": [
          {
            "school": {
              "id": "uuid",
              "name": "Colegio Don Bosco",
              "shortName": "Don Bosco"
            }
          }
        ]
      }
    }
  ]
}
```

### GET /api/admin/orders/details — Before

Student included as `{ select: { id: true, name: true } }`.

### GET /api/admin/orders/details — After

Student include widened to include the course → schools chain:

```json
{
  "order": {
    "id": "uuid",
    "studentId": "uuid",
    "total": 3000.00,
    "status": "pending",
    "student": {
      "id": "uuid",
      "name": "Juan Pérez",
      "course": {
        "id": "uuid",
        "name": "Primaria - 1° Primero",
        "schools": [
          {
            "school": {
              "id": "uuid",
              "name": "Colegio Don Bosco",
              "shortName": "Don Bosco"
            }
          }
        ]
      }
    }
  }
}
```

### GET /api/admin/schools — New

Reuses `CatalogController.listSchools` response. Returns school list with nested courses.

## UI Component Structure

### Booklet creation flow (pseudo-code)

```jsx
// State additions
const [schools, setSchools] = useState([]);
const [selectedSchoolId, setSelectedSchoolId] = useState('');

// Filtered courses by selected school
const schoolCourses = selectedSchoolId
  ? schools.find(s => s.id === selectedSchoolId)?.courses || []
  : [];

// Render: school dropdown before level select
<select value={selectedSchoolId} onChange={...}>
  <option value="">Seleccioná colegio</option>
  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
</select>

// Level/grade select only shows courses belonging to selected school
```

### Booklets table — "Colegio" column

```jsx
// New table header
<th className="text-left ...">Colegio</th>

// In each row, extract schools from booklet.course.schools
const schoolBadges = (b.course?.schools || []).map(sc => (
  <span key={sc.school.id} className="badge bg-primary-50 ...">
    {sc.school.shortName || sc.school.name}
  </span>
));
```

### Orders tab — group by school

```jsx
// Group orders by school name (first school in array, or "Sin colegio")
const groupedOrders = orders.reduce((acc, od) => {
  const schools = od.order.student?.course?.schools || [];
  const schoolName = schools[0]?.school?.name || 'Sin colegio';
  if (!acc[schoolName]) acc[schoolName] = [];
  acc[schoolName].push(od);
  return acc;
}, {});

// Render collapsible sections
{Object.entries(groupedOrders).map(([schoolName, schoolOrders]) => (
  <details key={schoolName} open>
    <summary className="...">{schoolName} ({schoolOrders.length})</summary>
    {/* nested table of orders for this school */}
  </details>
))}
```

### Search result updates — schools in search results

Both `searchOrdersByStudentName` and `adminSearchOrdersByBookletTitle` include a `student` with `course` and `schools` chain. The search result cards show a school badge next to the student name.

## Edge Cases and Error Handling

| Edge Case | Handling |
|-----------|----------|
| **Course has 0 schools** | `.course?.schools || []` — empty array, render nothing |
| **Student has no courseId** | `student.course` is `null`, chain resolves to `null`, show "—" |
| **Student course not linked to schools** | `schools` is empty array, no badge shown |
| **Multiple schools per course** | Render all as comma-separated badges in both tables |
| **Schools API fails** | `adminGetSchools` wrapped in try/catch fallback to empty `[]` |
| **Booklet with no course data** | Existing `b.course` is already present (Prisma FK), but `include` ensures it |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Backend unit | `listAllBooklets` returns schools in response | Prisma in-memory or mocked, assert shape |
| Backend integration | `GET /admin/booklets` response includes `course.schools[].school` | Supertest against test DB |
| Backend integration | `GET /admin/orders/details` includes schools | Supertest against test DB |
| Backend integration | `GET /admin/schools` returns school list | Supertest |
| Frontend | School selector filters courses correctly | Manual or component test |
| Frontend | Orders grouped by school render correctly | Visual inspection |

## Migration / Rollout

No migration required. The data model is already deployed — schools exist, and the M:N relationship between schools and courses is in place. The code changes are purely additive query widening and UI rendering.

## Open Questions

- None. The design is fully scoped per the proposal and the codebase exploration confirms all paths exist.
