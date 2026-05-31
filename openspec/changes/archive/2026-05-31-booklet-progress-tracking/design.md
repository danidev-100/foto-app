# Design: Booklet Progress Tracking

## Technical Approach

Nueva funcionalidad de seguimiento de entrega de cuadernillos por estudiante. Se agrega el modelo `StudentBookletProgress` + enum `ProgressStatus` en Prisma, un `ProgressService` + `ProgressController` en el backend, y un `ContabilidadTab.jsx` en el frontend. La creación de un booklet auto-genera registros `pending` para todos los estudiantes activos del curso asociado, todo dentro de una `$transaction` de Prisma.

Se sigue el patrón existente del proyecto: services con errores tipados (códigos `PROG_XXX`), controllers con `successJSON`/`errorJSON`, rutas protegidas con `authMiddleware` + `adminMiddleware`, y frontend con componentes standalone vía props.

## Architecture Decisions

### Decision: Creación automática de progress en CatalogService.createBooklet()

**Choice**: Modificar `CatalogService.createBooklet()` para que dentro de `prisma.$transaction()` cree el booklet y luego los registros `StudentBookletProgress` para todos los `Student` activos del `courseId`.

**Alternatives considered**:
- Trigger SQL: más rápido pero rompe la portabilidad y la lógica queda oculta.
- Servicio separado llamado después: riesgo de que falle la creación de progress y el booklet quede huérfano.

**Rationale**: La transacción garantiza atomicidad — si falla la creación de progress, no se crea el booklet. Sigue el patrón existente donde el service maneja la lógica de negocio.

### Decision: Servicio separado ProgressService (no mezclar con CatalogService)

**Choice**: `ProgressService` independiente con sus propios métodos de consulta y mutación.

**Alternatives considered**: Meter todo en `CatalogService` por estar relacionado con booklets.

**Rationale**: El dominio es diferente — catalog maneja CRUD de entidades, progress maneja seguimiento. Separar mantiene SRP y hace los archivos más chicos y enfocados.

### Decision: ContabilidadTab.jsx como componente standalone en pages/

**Choice**: Archivo nuevo `frontend/src/pages/ContabilidadTab.jsx`, importado por `Admin.jsx`.

**Alternatives considered**: Meter todo en Admin.jsx (archivo enorme), o en components/ (no es reutilizable).

**Rationale**: Admin.jsx ya tiene ~1200 líneas. Extraer a un archivo separado mejora mantenibilidad. Se mantiene en pages/ porque es una vista completa, no un componente genérico. Se comunica con el padre solo via props (schoolId callback).

### Decision: Snapshots de counts (no GROUP BY agregado)

**Choice**: Calcular `total`/`completed`/`pending` con `count()` separados por booklet, no con `GROUP BY`.

**Alternatives considered**: Prisma raw query con `GROUP BY booklet_id, status` para un solo query.

**Rationale**: Para el volumen esperado (decenas de booklets, cientos de estudiantes), `Promise.all` con counts paralelos es suficiente y mantiene el código legible. Si el volumen crece significativamente en el futuro, se puede optimizar.

## Data Flow

```
Admin.jsx → ContabilidadTab → admin.js API → Express routes → ProgressController → ProgressService → Prisma → PostgreSQL
    
  createBooklet:
    CatalogController → CatalogService.createBooklet()
        └─ prisma.$transaction()
            ├─ tx.booklet.create()
            ├─ tx.student.findMany({ where: { courseId, isActive: true }})
            └─ tx.studentBookletProgress.createMany()
```

## Data Model

### New Enum

```prisma
enum ProgressStatus {
  pending
  completed
}
```

### New Model

```prisma
model StudentBookletProgress {
  id        String         @id @default(uuid())
  studentId String         @map("student_id")
  bookletId String         @map("booklet_id")
  status    ProgressStatus @default(pending)
  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")

  student   Student        @relation(fields: [studentId], references: [id], onDelete: Cascade)
  booklet   Booklet        @relation(fields: [bookletId], references: [id], onDelete: Cascade)

  @@unique([studentId, bookletId])
  @@map("student_booklet_progress")
}
```

### Migration SQL

```sql
CREATE TYPE "ProgressStatus" AS ENUM ('pending', 'completed');

CREATE TABLE student_booklet_progress (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    booklet_id UUID NOT NULL REFERENCES booklets(id) ON DELETE CASCADE,
    status     "ProgressStatus" NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(student_id, booklet_id)
);

CREATE INDEX idx_sbp_booklet_id ON student_booklet_progress(booklet_id);
CREATE INDEX idx_sbp_student_id ON student_booklet_progress(student_id);
```

## Backend Architecture

### ProgressService (`backend/src/services/progress.service.js`)

Service with three methods: `getProgressSummary()`, `getBookletStudents()`, `updateProgress()`. Uses Prisma for data access with typed error objects (`PROG_001`, `PROG_002`, `PROG_003`).

### ProgressController (`backend/src/controllers/progress.controller.js`)

Three handlers (`listSummary`, `listBookletStudents`, `updateProgress`) using `successJSON`/`errorJSON` response helpers.

### Routes (`backend/src/routes/admin.routes.js`)

Three new routes behind `authMiddleware` + `adminMiddleware`:
- `GET /progress` — summary
- `GET /progress/:bookletId` — student detail
- `PATCH /progress/:id` — toggle status

### CatalogService.createBooklet() modificado

Wrapped in `prisma.$transaction()` with bulk `createMany` of pending records.

## API Contracts

### GET /api/admin/progress?school_id=xxx
- 200: returns array with `booklet_id`, `booklet_title`, `course_name`, `school_name`, `total_students`, `completed`, `pending`, `percentage`
- 401/403: auth errors

### GET /api/admin/progress/:bookletId
- 200: returns `booklet_id`, `booklet_title`, `students[]` with `progress_id`, `student_id`, `student_name`, `status`
- 404: `PROG_001` — booklet not found

### PATCH /api/admin/progress/:id
- 200: returns updated `id`, `student_id`, `booklet_id`, `status`
- 400: `PROG_002` — invalid status
- 404: `PROG_003` — record not found

## Frontend Architecture

### ContabilidadTab (`frontend/src/pages/ContabilidadTab.jsx`)

Component with: school filter dropdown, summary table (progress bars, counts), detail view with toggle buttons. Handles loading (spinner), empty ("No hay cuadernillos"), error (toast + retry), and data states. Optimistic UI updates on toggle with revert on failure.

### Admin.jsx changes

Add "Contabilidad" tab button + conditional render of `<ContabilidadTab>`.

### frontend/src/api/admin.js additions

Three API functions: `adminGetProgressSummary`, `adminGetBookletProgress`, `adminToggleProgress`.

## Test Design

### Backend tests (`backend/tests/progress.test.js`)

10 scenarios: summary (filtered + unfiltered), student detail, 404 for non-existent, toggle, invalid status, non-existent record, auto-create on booklet creation, non-admin 403, unauthenticated 401.

### Frontend tests (`frontend/src/__tests__/ContabilidadTab.test.jsx`)

10 tests covering: renders summary table, empty state, loading spinner, row click opens detail, toggle both directions (pending→completed and completed→pending), school filter refetch.

## Migration / Rollout

- Migration: `npx prisma migrate dev --name add_progress_tracking`
- Rollback: Revert Prisma schema + git restore modified files

## File Changes

| File | Action |
|------|--------|
| `backend/prisma/schema.prisma` | Modify |
| `backend/src/services/catalog.service.js` | Modify |
| `backend/src/services/progress.service.js` | Create |
| `backend/src/controllers/progress.controller.js` | Create |
| `backend/src/routes/admin.routes.js` | Modify |
| `frontend/src/pages/ContabilidadTab.jsx` | Create |
| `frontend/src/pages/Admin.jsx` | Modify |
| `frontend/src/api/admin.js` | Modify |
| `backend/tests/progress.test.js` | Create |
| `frontend/src/__tests__/ContabilidadTab.test.jsx` | Create |
