# Full Spec: csv-export

> **Change**: mega-features — CSV export for progress and orders
> **Stack**: Node.js + Express
> **Status**: Draft

## Purpose

Add CSV export endpoints for admin data: progress summary and orders. Admin downloads CSV files via new buttons in the Contabilidad tab and Orders table.

## Requirements

| ID | Description | Priority |
|----|------------|----------|
| CSV-01 | `GET /api/admin/export/progress?format=csv` SHALL return a CSV file (Content-Type: text/csv) with all progress summary data columns: booklet title, course, school, total students, completed, pending, percentage. | P0 |
| CSV-02 | `GET /api/admin/export/orders?format=csv` SHALL return a CSV file with all orders: ID, student name, school, total, payment method, payment status, order status, created date. | P0 |
| CSV-03 | Both endpoints SHALL require admin auth. | P0 |
| CSV-04 | Frontend ContabilidadTab SHALL show a "Descargar CSV" button that triggers the export. | P0 |
| CSV-05 | Frontend admin orders view SHALL show a "Descargar CSV" button. | P0 |
| CSV-06 | CSV SHALL use UTF-8 BOM and comma delimiter for Excel compatibility. | P0 |

### Scenario: Export progress CSV

- GIVEN 3 booklets with progress data exist
- WHEN `GET /api/admin/export/progress?format=csv` with valid admin token
- THEN status 200 with `Content-Type: text/csv`
- AND response body is a valid CSV with header row + 3 data rows
- AND columns include: booklet_title, course_name, school_name, total_students, completed, pending, percentage

### Scenario: Export orders CSV

- GIVEN 5 orders exist with various statuses
- WHEN `GET /api/admin/export/orders?format=csv` with valid admin token
- THEN status 200
- AND CSV contains header + 5 rows
- AND each row has order_id, student_name, total, payment_method, payment_status, order_status, created_at

### Scenario: Export without admin auth

- WHEN `GET /api/admin/export/progress?format=csv` without token
- THEN status 401

### Scenario: Frontend download button triggers export

- GIVEN ContabilidadTab is loaded
- WHEN admin clicks "Descargar CSV"
- THEN the browser downloads a CSV file
- AND the filename includes the date (e.g., `progreso_2026-06-13.csv`)

## CSV Format

| Column | Export | Source |
|--------|--------|--------|
| `booklet_title`, `course_name`, `school_name`, `total_students`, `completed`, `pending`, `percentage` | Progress | Progress summary query |
| `order_id`, `student_name`, `school`, `total`, `payment_method`, `payment_status`, `order_status`, `created_at` | Orders | Orders query with joins |
