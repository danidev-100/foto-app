# Spec: Responsive Redesign — app-responsive

**Project:** foto-app
**Change:** app-responsive
**Phase:** Spec
**Date:** 2026-06-03

## Overview

FotoApp works on desktop but breaks on mobile. This change brings all pages to full usability from 320px phones to desktop without horizontal page overflow. No new functionality — pure responsive layout adjustments using Tailwind CSS v4 utility classes.

---

## Requirement Catalog

---

### REQ-NAV-01: Mobile Navigation

**Description:** The top navigation bar must remain accessible on screens narrower than 640px. Nav labels are hidden on mobile, so icons must be unambiguous and touch targets adequate.

**Rationale:** The nav currently uses `hidden sm:inline` to hide text labels on small screens, but the remaining icons must be self-explanatory and tappable.

**Scenarios:**

- **NAV-01-01:** Student opens FotoApp on a 375px phone → The nav bar displays 4 icon buttons (Home, Cart, Orders, Admin if applicable) in a single row without overflow. Labels are hidden. Each icon is ≥44×44px touch target.
- **NAV-01-02:** Student on a 320px device navigates from Courses to Cart to Orders → The active nav icon has a visible background highlight distinguishing it from inactive icons. Each tap successfully navigates to the expected route.
- **NAV-01-03:** Student with Admin role opens nav on a 360px phone → Admin icon appears alongside the other 3 icons without breaking to a new row. All 4 icons remain within the viewport with adequate spacing.

---

### REQ-TBL-01: Admin Table Horizontal Scroll

**Description:** All data tables in the admin panel must be usable on mobile without causing horizontal page overflow. Tables must scroll horizontally within their container rather than being clipped or forcing the page to widen.

**Rationale:** Every `<table>` in Admin.jsx and ContabilidadTab.jsx sits inside a `card overflow-hidden` div which clips overflowing columns instead of scrolling. On desktop all columns fit, but on mobile (≤414px) tables with 5–6 columns overflow invisibly.

**Affected tables (9 instances):**
1. Admin — Booklets list (6 cols: Título, Curso/División, Colegio, Precio, Estado, Acciones)
2. Admin — Order search by ID (6 cols: Pedido, Usuario, Cuadernillos, Total, Estado, Pago)
3. Admin — Order search by student (5 cols: Pedido, Usuario, Cuadernillos, Total, Estado)
4. Admin — Order search by booklet (6 cols: Estudiante, Pedido, Cuadernillo, Cantidad, Estado, Acciones)
5. Admin — All orders grouped by school (6 cols: Pedido, Usuario, Colegio, Cuadernillos, Total, Estado)
6. Admin — Users list (5 cols: Nombre, Email, Rol, Estado, Acciones)
7. Contabilidad — Student detail (3 cols: Nombre, Estado, Acción)
8. Contabilidad — Progress summary (4 cols: Cuadernillo, Curso, Progreso, Pendientes)
9. Contabilidad — Production summary (5 cols: Cuadernillo, Curso, Impresos, Pedidos, Faltantes)

**Scenarios:**

- **TBL-01-01:** Admin views the booklets list on a 375px phone → The page does NOT have horizontal scroll. The table is inside a horizontally scrollable container. Admin can swipe left/right to see all 6 columns. Column headers remain readable.
- **TBL-01-02:** Admin searches orders by booklet title on a 360px phone → The results table (6 cols) scrolls horizontally without page overflow. The "Acciones" column buttons remain tappable after scroll.
- **TBL-01-03:** Admin views the users table on a 414px phone → The table shows 5 columns with horizontal scroll. Row text does not overflow. Action buttons (Hacer admin, Desactivar) remain tappable.
- **TBL-01-04:** Admin views Contabilidad → Production table on a 375px phone → All 5 columns (Cuadernillo, Curso, Impresos, Pedidos, Faltantes) scroll horizontally. The inline-edit input for "Impresos" remains usable.

---

### REQ-TAB-01: Admin Tab Bar Wrap/Scroll

**Description:** The admin tab bar with 5 items must be usable on screens narrower than 400px without horizontal page overflow. Tabs must either wrap to multiple lines or scroll horizontally.

**Rationale:** Admin.jsx has 5 tab buttons (Cuadernillos, Pedidos Pendientes + badge, Cursos, Usuarios, Contabilidad) in `flex gap-2` with no wrapping, requiring ~650px minimum — impossible on mobile.

**Scenarios:**

- **TAB-01-01:** Admin opens the panel on a 375px phone → All 5 tabs are visible by either wrapping to 2+ rows or scrolling horizontally. No tab is clipped or hidden. The active tab is clearly indicated.
- **TAB-01-02:** Admin switches from "Cuadernillos" to "Contabilidad" on a 360px phone → The tap on "Contabilidad" is registered correctly even if the tab is on a second row. The content panel below updates to show the Contabilidad tab.
- **TAB-01-03:** Admin with pending orders badge sees the "Pedidos Pendientes (N)" tab on a 320px device → The badge count (e.g. "3") does not overflow or clip. The tab + badge fit within the available width.

---

### REQ-LAYOUT-01: Cart and Orders Layout

**Description:** The Cart and Orders pages must be fully usable on mobile without horizontal scroll or cramped layouts.

**Rationale:** Cart items place thumbnail (64px) + info + quantity controls (~120px) + remove button in a single row. Orders badge clusters (payment method + payment status + order status) overflow on small screens. Footer action buttons cramp.

**Scenarios:**

- **LAYOUT-01-01:** Student views their cart on a 375px phone → Each cart item stacks the thumbnail, title, quantity controls, and remove button in a vertical or properly wrapped layout. The quantity buttons and remove button are ≥44×44px touch targets. The subtotal is visible below the item.
- **LAYOUT-01-02:** Student views an order on a 360px phone → The three status badges (payment method, payment status, order status) wrap to the next line if they don't fit beside the order ID/date. No badge is clipped.
- **LAYOUT-01-03:** Student sees an order with "Pagar con MP" and "Cancelar" buttons on a 320px phone → Both action buttons stack vertically or wrap properly. Both are fully visible and tappable. Text is not truncated.
- **LAYOUT-01-04:** Student checks the cart total section on a 375px phone → The "Pagar con Mercado Pago" and "Pagar en efectivo" buttons are full-width (already the case). The total amount is readable alongside the "Total" label.

---

### REQ-LAYOUT-02: Catalog Grid Responsiveness

**Description:** School and course cards must display properly on all screen sizes from 320px to desktop. No cards should overflow or clip content.

**Rationale:** The catalog already uses `md:grid-cols-2` and `sm:grid-cols-2 lg:grid-cols-3` grids, which work reasonably. However, the division badges on booklet items and the school level badges must not overflow on small screens.

**Scenarios:**

- **LAYOUT-02-01:** Student browses the school list on a 375px phone → School cards stack in a single column (no grid columns). School name, course count, and level badges (Primaria/Secundaria) are fully visible. The arrow icon is present and tappable.
- **LAYOUT-02-02:** Student selects a school and views courses on a 360px phone → Course cards display in a single column. Course name and "Ver cuadernillos →" label are visible. The accent color bar at the top of each card is visible.
- **LAYOUT-02-03:** Student opens a course's booklet list on a 414px phone → Each booklet row shows title, division badge, price, and "Agregar" button without overflow. The division badge text does not clip. The "Agregar" button is ≥44px tall.

---

### REQ-FORM-01: Login/Register Forms

**Description:** Login and Register forms must be fully usable on mobile without elements overlapping or being hidden.

**Rationale:** On Login.jsx and Register.jsx, the theme toggle button is positioned `absolute top-4 right-4` which overlaps with the "FotoApp" heading on very small screens (<360px). The brand panel is already hidden on mobile (`hidden lg:flex`).

**Scenarios:**

- **FORM-01-01:** Student opens Login on a 320px phone → The "FotoApp" heading and "Encargá tus cuadernillos" subtitle are fully visible. The theme toggle button does NOT overlap with the heading text. The email input, password input, and "Ingresar" button are full-width and tappable.
- **FORM-01-02:** Student opens Register on a 360px phone → The form panel shows name, email, and password inputs stacked vertically. The theme toggle is positioned so it doesn't overlap the "FotoApp" heading or "Crear cuenta" title. The "Crear cuenta" button is full-width.
- **FORM-01-03:** Student toggles dark mode on Login on a 375px phone → The theme toggle button is accessible (≥44×44px touch target) in its repositioned location. Tapping it successfully toggles the theme without triggering any other action.

---

### REQ-TOAST-01: Toast Notification Positioning

**Description:** Toast notifications must be fully visible and readable on all screen sizes. On mobile, they must not extend past the viewport edge.

**Rationale:** All toasts use `fixed top-4 right-4` with no `max-width` or `left-4` constraint. A long message on mobile extends past the viewport's left edge, becoming partially invisible.

**Affected locations:** Catalog.jsx (line 154-171), Admin.jsx (line 673-679), ContabilidadTab.jsx (line 154-159)

**Scenarios:**

- **TOAST-01-01:** Student adds a booklet with a long title to cart on a 375px phone → The success toast ("'Matemáticas Unidad 1 Fracciones y Decimales' agregado al carrito") appears at the top of the screen. The toast is horizontally constrained to fit within the viewport with padding on both sides. All text is readable.
- **TOAST-01-02:** Admin receives an error toast on a 360px phone → The error toast appears within the viewport with equal spacing from left and right edges. No part of the toast extends beyond the viewport.
- **TOAST-01-03:** User sees a toast on a 1280px desktop → The toast remains in the top-right corner (its current position) with the same styling as before. The `left-4` constraint does NOT affect desktop positioning.

---

### REQ-TOUCH-01: Touch Target Minimum Size

**Description:** All interactive elements (buttons, links, inputs, select controls) must have a minimum touch target of 44×44px as recommended by WCAG 2.1 (Success Criterion 2.5.8).

**Rationale:** Many action buttons and controls use small text-only buttons (e.g., "Editar", "Eliminar", quantity +/−) that may be smaller than 44px on mobile.

**Scenarios:**

- **TOUCH-01-01:** Admin taps "Editar" on a booklet row in the admin table on a 375px phone → The touch target is ≥44×44px. The action is registered on the first tap without requiring zoom.
- **TOUCH-01-02:** Student taps the quantity increment (+) button on a cart item on a 360px phone → The + button is ≥44×44px. The quantity updates by 1.
- **TOUCH-01-03:** Admin taps "Anterior" or "Siguiente" in pagination controls on a 320px phone → Both buttons are ≥44×44px touch targets with adequate spacing between them.
- **TOUCH-01-04:** Student taps the theme toggle on login on a 375px phone → The toggle button is ≥44×44px. The theme changes on first tap.

---

### REQ-FORM-02: Admin Booklet Creation Form

**Description:** The booklet creation form with the multi-select division toggle chips must work on mobile without horizontal overflow.

**Rationale:** The division selector shows toggle chips (A, B, C, D, E, N, H) in a `flex flex-wrap gap-2` container. The 4-column grid for school/nivel/grado/divisiones must stack on mobile.

**Scenarios:**

- **FORM-02-01:** Admin creates a booklet on a 375px phone → The form fields (Colegio, Nivel, Grado, Divisiones) stack vertically in a single column. Division toggle chips wrap to multiple rows. Each chip is ≥44px tall with adequate text.
- **FORM-02-02:** Admin selects division "A", "B", "C", "N", "H" for a Secundaria course on a 360px phone → All 5 division chips are visible (some on wrapped rows). The ✓ indicator appears on selected chips. The form does NOT overflow horizontally.
- **FORM-02-03:** Admin sees the confirmation text after selecting divisions on a 414px phone → The summary text ("Cuadernillo para: Secundaria - 1° Primero — Divisiones A, B, C") fits within the card without overflow.
- **FORM-02-04:** Admin submits the form on a 375px phone → The "Crear cuadernillo" button is full-width and ≥44px tall. Any validation errors are displayed clearly below the relevant field.

---

## Version Information

| Field | Value |
|-------|-------|
| Spec Version | 1.0 |
| Created | 2026-06-03 |
| Phase | Spec |
| Applies To | Design, Tasks, Apply, Verify |

## Traceability

| Requirement | Proposal Section | Exploration Section |
|-------------|-----------------|-------------------|
| REQ-NAV-01 | Approach → Nav/App | Issues: CRITICAL, linebreak |
| REQ-TBL-01 | Approach → Table overflow | Issues: CRITICAL #2 |
| REQ-TAB-01 | Approach → Admin tabs wrap | Issues: CRITICAL #1 |
| REQ-LAYOUT-01 | Approach → Cart/Orders | Issues: QUALITY #3, #4, #8 |
| REQ-LAYOUT-02 | (implicit from scope) | Issues: linebreak |
| REQ-FORM-01 | Approach → Theme toggle | Issues: QUALITY #6 |
| REQ-TOAST-01 | Approach → Toast positioning | Issues: QUALITY #5 |
| REQ-TOUCH-01 | Success Criteria | (derived from WCAG) |
| REQ-FORM-02 | Approach → Booklet form | Affected Areas table |
