# admin-school-integration Specification

> **Full Spec** — new domain for admin-panel-schools change
> **Stack**: Node.js + Express + Prisma + PostgreSQL
> **Status**: Completed (archive)

## Purpose

Enable school-aware administration: include school metadata in booklet and order listings, allow school-filtered booklet creation in the admin panel, and expose a schools endpoint for the frontend.

## Requirements

| ID | Description | Priority |
|---|---|---|
| SCH-REQ-01 | `GET /api/admin/schools` MUST return active schools with their linked courses. Admin auth required. | P0 |
| SCH-REQ-02 | `GET /api/admin/booklets` response MUST include schools via `booklet.course.schools[].school.{id, name, shortName}`, derived from booklet → course → SchoolCourse → School. | P0 |
| SCH-REQ-03 | `GET /api/admin/orders/details` response MUST include schools via `order.student.course.schools[].school.{id, name, shortName}`, derived from order → student → course → SchoolCourse → School. | P0 |
| SCH-REQ-04 | Frontend booklet creation form MUST show a school `<select>` before level/grade/division. Course options MUST filter to courses linked to the selected school. | P0 |
| SCH-REQ-05 | Frontend booklets table MUST show a "Colegio" column with school name badge(s) per booklet. | P0 |
| SCH-REQ-06 | Frontend orders table MUST show a "Colegio" column. Orders MUST be grouped by school under collapsible section headers. Multiple-school orders use the first school for grouping. | P0 |
| SCH-REQ-07 | Student-facing catalog MUST remain unchanged — school integration is admin-only. | P0 |

## Scenarios

### Scenario: Admin lists schools successfully
- GIVEN 2 active schools exist, each linked to 1+ courses
- WHEN `GET /api/admin/schools` with valid admin token
- THEN status 200 with `data` array
- AND each entry has `id`, `name`, `shortName`, `courses[]`

### Scenario: Booklet response includes school
- GIVEN a booklet whose course links to school "Colegio San Martín"
- WHEN `GET /api/admin/booklets` returns that booklet
- THEN `booklet.course.schools` contains `{ "school": { "id": "uuid", "name": "Colegio San Martín", "shortName": "San Martín" } }`

### Scenario: Booklet with multi-school course
- GIVEN a booklet's course links to 2 schools
- WHEN the booklet appears in admin listing
- THEN `booklet.course.schools` array has 2 entries

### Scenario: Course with no school links
- GIVEN a booklet whose course has no SchoolCourse rows
- WHEN `GET /api/admin/booklets` returns that booklet
- THEN `booklet.course.schools` is an empty array `[]`

### Scenario: Order response includes school
- GIVEN an order where student.courseId links to a school
- WHEN `GET /api/admin/orders/details` returns that order
- THEN `order.student.course.schools[].school` contains the school data

### Scenario: Student with no courseId
- GIVEN an order from a student where courseId is null
- WHEN the order appears in admin listing
- THEN `order.student` exists but `student.course` is `null`, so `course?.schools` resolves to `[]`

### Scenario: School dropdown filters courses
- GIVEN admin booklet form has loaded schools
- WHEN admin selects "Colegio San Martín"
- THEN course dropdown only shows courses linked to that school
- AND selecting a different school resets course selection

### Scenario: Selected school has no linked courses
- GIVEN admin selects a school with zero linked courses
- THEN course dropdown shows a disabled "Sin cursos disponibles" option
- AND division/grade selectors remain disabled

### Scenario: Orders grouped by school
- GIVEN 5 orders: 3 from "Colegio A", 2 from "Colegio B"
- WHEN orders tab loads
- THEN orders appear under collapsible "Colegio A" (3) and "Colegio B" (2) section headers

### Scenario: Unauthenticated request to schools endpoint
- WHEN `GET /api/admin/schools` without auth header
- THEN status 401

## Validation Rules

| Rule | Where | Behavior |
|---|---|---|
| Active schools only | Backend | `where: { isActive: true }` on schools query |
| Schools array always present | Backend | Empty `[]` when no relation exists (never null) |
| Course filter on school change | Frontend | Reset course, grade, division selection when school changes |
| Auth + admin guard | Backend | Schools endpoint behind `authMiddleware` + `adminMiddleware` |
| Student catalog unchanged | Backend | `listActiveBooklets()` and `listSchools()` keep existing shape |

## API Contract Changes

### GET /api/admin/schools (NEW endpoint)

Response per item in `data[]`:
```json
{
  "id": "uuid",
  "name": "Colegio San Martín",
  "shortName": "San Martín",
  "courses": [
    { "id": "uuid", "name": "Primaria - 1° Primero", "isActive": true }
  ]
}
```

### GET /api/admin/booklets (MODIFIED response shape)

Each booklet object gains school data via the Prisma include chain `course → schools → school`:
```json
{
  "id": "uuid",
  "courseId": "uuid",
  "divisionId": "uuid",
  "title": "Matemáticas U1",
  "currentPrice": 150000,
  "isActive": true,
  "course": {
    "id": "uuid",
    "name": "Primaria - 1° Primero",
    "schools": [
      {
        "school": {
          "id": "uuid",
          "name": "Colegio San Martín",
          "shortName": "San Martín"
        }
      }
    ]
  }
}
```

The frontend accesses it as `b.course?.schools || []` and renders `sc.school.shortName || sc.school.name`.

### GET /api/admin/orders/details (MODIFIED response shape)

Each order in the `orders[]` array gains school data via the Prisma include chain `student → course → schools → school`:
```json
{
  "order": {
    "id": "uuid",
    "studentId": "uuid",
    "total": 300000,
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
  },
  "items": []
}
```

The frontend accesses it as `od.order.student?.course?.schools || []` and renders `sc.school.shortName || sc.school.name`. Orders are grouped by the first school's name via `.reduce()`.
