# Full Spec: admin-responsive

> **Change**: mega-features — responsive admin layout for mobile
> **Stack**: React 19 + Tailwind 4
> **Status**: Draft

## Purpose

Make the admin panel responsive for mobile devices (320px+ widths). This is a CSS/layout-only change — no backend or functional behavior modifications.

## Requirements

| ID | Description | Priority |
|----|------------|----------|
| RESP-01 | All admin data tables SHALL switch from horizontal `<table>` layout to vertical card layout below `md` breakpoint (768px). | P0 |
| RESP-02 | Tab navigation (<nav> with <button>s) SHALL collapse into a hamburger/dropdown menu below `md`. | P0 |
| RESP-03 | All interactive elements (buttons, links, inputs, toggles) SHALL have minimum touch target of 44×44px. | P0 |
| RESP-04 | Admin pages SHALL render without horizontal scrolling on viewports 320px wide and above. | P0 |
| RESP-05 | Table-to-card conversion SHALL preserve all information: each card shows row data stacked vertically with field labels. | P0 |

### Scenario: Table becomes cards on mobile

- GIVEN the admin orders page with a data table
- WHEN viewport is 375px wide
- THEN rows render as stacked cards with label-value pairs
- AND no horizontal scrollbar appears
- AND all row data is visible

### Scenario: Tab nav becomes hamburger

- GIVEN the admin page with 5 tab buttons
- WHEN viewport is 375px wide
- THEN tabs are hidden behind a hamburger icon
- AND clicking the hamburger opens a dropdown with tab items
- AND each dropdown item has 44px min height

### Scenario: Touch targets meet minimum size

- GIVEN any admin page
- WHEN inspecting all interactive elements
- THEN every button, link, toggle, and input has `min-height: 44px` and `min-width: 44px` (or equivalent `min-w-[44px]` / `min-h-[44px]`)
- AND there is no visible overlap between targets

### Scenario: Desktop layout unchanged

- GIVEN the admin page
- WHEN viewport is 1280px wide
- THEN tables render as traditional `<table>` with columns
- AND tab navigation shows inline buttons (no hamburger)

## Responsive Breakpoints

| Breakpoint | Width | Table Layout | Nav Layout |
|-----------|-------|-------------|------------|
| `sm` | 640px+ | Card | Hamburger |
| `md` | 768px+ | Card → Table (transition) | Hamburger → Inline |
| `lg` | 1024px+ | Table | Inline |

## Test Matrix

| Viewport | Pages | Layout |
|----------|-------|--------|
| 320×568 | All admin tabs | Cards, hamburger |
| 375×667 | All admin tabs | Cards, hamburger |
| 768×1024 | All admin tabs | Table transition zone |
| 1280×720 | All admin tabs | Full table, inline tabs |
