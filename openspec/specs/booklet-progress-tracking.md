# booklet-progress-tracking Specification

> **Full Spec** — new domain for per-student booklet delivery progress
> **Stack**: Node.js + Express + Prisma + PostgreSQL + React 19 + Tailwind 4
> **Status**: Draft

## Purpose

Permitir que el admin visualice y gestione el progreso de entrega de cuadernillos por estudiante. Al crear un cuadernillo, se auto-crean registros `pending` para todos los estudiantes del curso asociado. El admin ve un resumen con métricas y puede hacer drill-down por cuadernillo para togglear el estado de cada estudiante.

## 1. Functional Requirements

| ID | Description | Priority |
|---|---|---|
| PROG-REQ-01 | `GET /api/admin/progress` MUST return resumen de todos los cuadernillos con métricas: `total_students`, `completed`, `pending`, `percentage`. Filtrable por `school_id`. | P0 |
| PROG-REQ-02 | `GET /api/admin/progress/:bookletId` MUST list estudiantes de ese cuadernillo con su `status` (pending/completed) y datos del estudiante. | P0 |
| PROG-REQ-03 | `PATCH /api/admin/progress/:id` MUST toggle el status entre `pending` ↔ `completed`. SHALL aceptar `{"status": "completed"}` o `{"status": "pending"}`. | P0 |
| PROG-REQ-04 | Al crear un booklet via `CatalogService.createBooklet()`, se MUST auto-crear registros `StudentBookletProgress` con status `pending` para TODOS los estudiantes activos del `courseId` del booklet, dentro de una `$transaction`. | P0 |
| PROG-REQ-05 | Todos los endpoints de progress MUST requerir `authMiddleware` + `adminMiddleware`. | P0 |
| PROG-REQ-06 | El frontend MUST mostrar un tab "Contabilidad" en el Admin panel con tabla resumen y drill-down por cuadernillo. | P0 |
| PROG-REQ-07 | El toggle de status en frontend MUST actualizar optimistamente el UI antes de la respuesta del server. | P1 |

## 2. Non-Functional Requirements

| ID | Constraint |
|---|---|
| PROG-NFR-01 | Creación de booklet + progress records MUST ser atómica (single `$transaction`). Si falla la creación de progress, NO se crea el booklet. |
| PROG-NFR-02 | Progress summary MUST calcular métricas server-side usando `GROUP BY` / `aggregate` de Prisma. |
| PROG-NFR-03 | Nombrar enum y modelo siguiendo convención Prisma existente: `ProgressStatus` enum, `StudentBookletProgress` model, `@@map("student_booklet_progress")`. |
| PROG-NFR-04 | Seguir patrón existente: `ProgressService` (lógica), `ProgressController` (handlers con `successJSON`/`errorJSON`), rutas en `admin.routes.js`. |
| PROG-NFR-05 | El backend NO debe trackear división del estudiante — el progreso es a nivel curso. |

## 3. Data Model

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
```

Migration file: `migrations/XXX_add_student_booklet_progress.sql` (XXX = next available number).

## 4. API Contract

### GET /api/admin/progress

**Auth**: Admin (`authMiddleware` + `adminMiddleware`)
**Query params**: `school_id` (opcional)

**Success 200**:
```json
{
  "success": true,
  "data": [
    {
      "booklet_id": "uuid",
      "booklet_title": "Matemáticas U1",
      "course_name": "Primaria - 1° Primero",
      "school_name": "Colegio San Martín",
      "total_students": 25,
      "completed": 10,
      "pending": 15,
      "percentage": 40
    }
  ]
}
```

**Errors**: 401 (no auth), 403 (no admin), 500 (`INF_001`).

### GET /api/admin/progress/:bookletId

**Auth**: Admin
**Params**: `bookletId` — UUID del booklet

**Success 200**:
```json
{
  "success": true,
  "data": {
    "booklet_id": "uuid",
    "booklet_title": "Matemáticas U1",
    "students": [
      {
        "progress_id": "uuid",
        "student_id": "uuid",
        "student_name": "Juan Pérez",
        "status": "completed"
      }
    ]
  }
}
```

**Errors**: 404 (`PROG_001` — booklet not found), 401, 403, 500.

### PATCH /api/admin/progress/:id

**Auth**: Admin
**Params**: `id` — UUID del registro `StudentBookletProgress`
**Body**:
```json
{
  "status": "completed"
}
```

**Success 200**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "student_id": "uuid",
    "booklet_id": "uuid",
    "status": "completed"
  }
}
```

**Errors**:
- 400 (`PROG_002` — invalid status value)
- 404 (`PROG_003` — progress record not found)
- 401, 403, 500

### Example curl

```bash
# Summary (all schools)
curl -H "Authorization: Bearer <token>" /api/admin/progress

# Summary filtered by school
curl -H "Authorization: Bearer <token>" "/api/admin/progress?school_id=uuid-123"

# Student detail per booklet
curl -H "Authorization: Bearer <token>" /api/admin/progress/booklet-uuid

# Toggle status
curl -X PATCH -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}' \
  /api/admin/progress/progress-record-uuid
```

## 5. Frontend Specs

### Tab Integration

En `Admin.jsx`:
- Agregar tab "Contabilidad" en la barra de tabs (después de "Usuarios")
- Importar `ContabilidadTab` como lazy component
- Renderizar `{activeTab === 'contabilidad' && <ContabilidadTab />}`

### ContabilidadTab Component Tree

```
ContabilidadTab
├── SchoolFilter (select con schools, opcional)
├── ProgressSummaryTable (tabla de cuadernillos)
│   └── ProgressRow (por booklet: título, curso, escuela, barra %, counts)
└── StudentProgressModal (drill-down al hacer click en fila)
    ├── ModalHeader (título del booklet)
    └── StudentList
        └── StudentRow (nombre + StatusBadge + ToggleButton)
```

### States

| State | Behavior |
|---|---|
| **Loading** | Skeleton loader en la tabla. Modal muestra spinner. |
| **Empty** | Mensaje "No hay cuadernillos con seguimiento de progreso" |
| **Error** | Toast con error. Botón "Reintentar" |
| **Data** | Tabla con filas clickeables. |
| **Toggle loading** | Deshabilitar toggle button, mostrar spinner en esa fila |

### Key Interactions

- Click en fila → `GET /api/admin/progress/:bookletId` → abre modal con lista de estudiantes
- Click en toggle button → `PATCH /api/admin/progress/:id` con nuevo status
- **Optimistic update**: cambiar estado visual inmediatamente, revertir si error
- Cambiar school filter → refetch summary

### API Functions (frontend/src/api/admin.js)

```js
export const adminGetProgressSummary = (params) => api.get('/admin/progress', { params });
export const adminGetProgressDetail = (bookletId) => api.get(`/admin/progress/${bookletId}`);
export const adminToggleProgress = (id, data) => api.patch(`/admin/progress/${id}`, data);
```

## 6. Scenarios — Test Specs

### Backend (integration tests via supertest)

#### Scenario: Summary returns correct metrics
- GIVEN existen 2 booklets con progress records (1 completado y 2 pending cada uno)
- WHEN `GET /api/admin/progress` con token admin válido
- THEN status 200
- AND `data` array tiene 2 entries
- AND cada entry tiene `total_students`, `completed`, `pending`, `percentage`

#### Scenario: Summary filtered by school
- GIVEN booklets de 2 escuelas diferentes
- WHEN `GET /api/admin/progress?school_id=escuela-a`
- THEN solo se retornan booklets de escuela-a

#### Scenario: Summary empty when no progress exists
- GIVEN no hay registros de progress
- WHEN `GET /api/admin/progress`
- THEN status 200 con `data` array vacío

#### Scenario: Student detail per booklet
- GIVEN booklet "b-1" tiene 3 estudiantes con progress records
- WHEN `GET /api/admin/progress/b-1`
- THEN status 200
- AND `data.students` tiene 3 entries con `student_name`, `status`, `progress_id`

#### Scenario: Detail returns 404 for non-existent booklet
- WHEN `GET /api/admin/progress/non-existent`
- THEN status 404
- AND `error.code` es `PROG_001`

#### Scenario: Toggle status pending → completed
- GIVEN progress record "p-1" tiene status `pending`
- WHEN `PATCH /api/admin/progress/p-1` con `{"status": "completed"}`
- THEN status 200
- AND `data.status` es `completed`

#### Scenario: Toggle same status twice is idempotent
- GIVEN progress record "p-1" tiene status `completed`
- WHEN `PATCH /api/admin/progress/p-1` con `{"status": "completed"}`
- THEN status 200
- AND `data.status` sigue siendo `completed`

#### Scenario: Toggle with invalid status returns 400
- WHEN `PATCH /api/admin/progress/p-1` con `{"status": "invalid"}`
- THEN status 400
- AND `error.code` es `PROG_002`

#### Scenario: Toggle non-existent record returns 404
- WHEN `PATCH /api/admin/progress/non-existent` con status válido
- THEN status 404
- AND `error.code` es `PROG_003`

#### Scenario: Non-admin cannot access progress
- GIVEN token de estudiante regular (no admin)
- WHEN `GET /api/admin/progress`
- THEN status 403

#### Scenario: Booklet creation auto-creates progress records
- GIVEN curso "c-1" tiene 5 estudiantes activos
- WHEN `POST /api/admin/booklets` con `course_id: "c-1"`
- THEN status 201
- AND existen 5 registros `StudentBookletProgress` con status `pending` vinculados al nuevo booklet

#### Scenario: Booklet with no students in course creates zero progress records
- GIVEN curso "c-1" no tiene estudiantes
- WHEN `POST /api/admin/booklets` con `course_id: "c-1"`
- THEN status 201
- AND NO se crean registros de progress (0 registros)

#### Scenario: Unauthenticated request returns 401
- WHEN `GET /api/admin/progress` sin token
- THEN status 401

### Frontend (component tests via Vitest + RTL)

#### Scenario: ContabilidadTab renders summary table
- GIVEN el API retorna 2 booklets con métricas
- WHEN el componente monta
- THEN se renderizan 2 filas en la tabla
- AND cada fila muestra título, barra de progreso, counts

#### Scenario: ContabilidadTab shows empty state
- GIVEN el API retorna array vacío
- WHEN el componente monta
- THEN se muestra mensaje "No hay cuadernillos con seguimiento de progreso"

#### Scenario: Click row opens student modal
- GIVEN la tabla resumen está renderizada
- WHEN el admin hace click en una fila
- THEN se abre el modal
- AND se fetchea `GET /api/admin/progress/:bookletId`
- AND se renderiza la lista de estudiantes con sus status

#### Scenario: Toggle button updates optimistically
- GIVEN el modal de estudiantes está abierto
- AND un estudiante muestra status `pending`
- WHEN el admin clickea el toggle
- THEN el status cambia visualmente a `completed` inmediatamente
- AND se llama `PATCH /api/admin/progress/:id`
- AND si el PATCH falla, el status vuelve a `pending`

## 7. Error Codes

| Code | HTTP | When |
|---|---|---|
| `PROG_001` | 404 | Booklet not found (detail endpoint) |
| `PROG_002` | 400 | Invalid status value in PATCH body |
| `PROG_003` | 404 | Progress record not found (toggle endpoint) |
| `INF_001` | 500 | Internal server error (catch-all) |

## 8. Files Affected

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `ProgressStatus` enum + `StudentBookletProgress` model |
| `backend/src/services/catalog.service.js` | Modify `createBooklet()` — add `$transaction` con auto-creación de progress |
| `backend/src/services/progress.service.js` | NEW — `getSummary()`, `getStudentDetail()`, `toggleStatus()` |
| `backend/src/controllers/progress.controller.js` | NEW — 3 handlers wrap service calls |
| `backend/src/routes/admin.routes.js` | Add progress routes |
| `frontend/src/api/admin.js` | Add `adminGetProgressSummary`, `adminGetProgressDetail`, `adminToggleProgress` |
| `frontend/src/components/ContabilidadTab.jsx` | NEW — tabla resumen + modal drill-down |
| `frontend/src/pages/Admin.jsx` | Add "Contabilidad" tab + import |
| `backend/tests/progress.test.js` | NEW — integration tests |
| `frontend/src/__tests__/ContabilidadTab.test.jsx` | NEW — component tests |
