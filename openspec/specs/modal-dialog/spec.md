# Modal Dialog Specification

## Purpose

Reusable modal overlay for focused interactions — form overlays, detail views, and confirmation prompts. Controlled via `isOpen`/`onClose` props with keyboard and backdrop interaction support.

## Requirements

### Requirement: Controlled open/close with backdrop

The modal MUST render only when `isOpen` is true. A semi-transparent backdrop MUST overlay the page. Closing MUST call `onClose`.

#### Scenario: Modal opens and shows backdrop

- GIVEN `<Modal isOpen={true} onClose={fn}>`
- WHEN rendered
- THEN the modal content and backdrop are visible, blocking page interaction

#### Scenario: Modal closes via parent

- GIVEN a modal is open
- WHEN the parent sets `isOpen={false}`
- THEN the modal and backdrop are removed from DOM

### Requirement: Backdrop click and Escape close

Clicking the backdrop or pressing Escape MUST call `onClose`. Both MUST be configurable via `closeOnBackdropClick` and `closeOnEscape` boolean props (defaulting to true).

#### Scenario: Close on backdrop click

- GIVEN a modal is open
- WHEN the user clicks the backdrop outside the content area
- THEN `onClose` is called

#### Scenario: Close on Escape key

- GIVEN a modal is open
- WHEN the user presses Escape
- THEN `onClose` is called

### Requirement: Size variants

The modal MUST support `sm`, `md`, `lg`, `xl`, and `fullscreen` size variants controlling max-width.

#### Scenario: Medium size renders at 512px

- GIVEN `<Modal isOpen={true} size="md">`
- WHEN rendered
- THEN the content container has a max-width of 512px

#### Scenario: Fullscreen fills viewport

- GIVEN `<Modal isOpen={true} size="fullscreen">`
- WHEN rendered
- THEN the modal fills the entire viewport

### Requirement: Content slots

The modal MUST accept `title`, `children` (body), and `footer` props for content composition.

#### Scenario: Modal with title, body, and footer

- GIVEN a modal with all three slots populated
- WHEN rendered
- THEN title is at top, children in the middle, and footer at bottom
