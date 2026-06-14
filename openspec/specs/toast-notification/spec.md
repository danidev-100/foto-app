# Toast Notification Specification

## Purpose

Context-based toast/notification system for transient user feedback — success confirmations, error alerts, and info messages. Eliminates inline `useState` toast patterns across pages.

## Requirements

### Requirement: Toast Provider wraps app at top level

The system MUST provide a `<ToastProvider>` component wrapping the application root with a managed toast queue. Calling `useToast()` from any descendant MUST return `toast.success(msg)`, `toast.error(msg)`, and `toast.info(msg)`.

#### Scenario: Provider makes toast accessible throughout app

- GIVEN `App.jsx` renders `<ToastProvider><Routes /></ToastProvider>`
- WHEN any page component calls `useToast()`
- THEN the returned functions trigger toasts without prop drilling

### Requirement: Toast types with semantic styling

Each toast type MUST render with a distinct color: success (green), error (red), info (blue).

#### Scenario: Success toast

- GIVEN a component calls `toast.success("Booklet created")`
- WHEN the toast renders
- THEN a green toast with "Booklet created" appears

#### Scenario: Error toast

- GIVEN `toast.error("Network error")`
- WHEN the toast renders
- THEN a red toast displays the error text

### Requirement: Auto-dismiss with manual close

Toasts MUST auto-dismiss after 3000ms. Each toast MUST show a close button for manual dismiss. The duration MUST be overridable via an options parameter.

#### Scenario: Default auto-dismiss

- GIVEN a success toast is shown
- WHEN 3000ms elapse
- THEN the toast is removed from DOM

#### Scenario: Manual dismiss

- GIVEN a toast is visible
- WHEN the user clicks its close button
- THEN the toast is removed immediately

### Requirement: Toast queue with stacking

Multiple toasts MUST stack vertically. Queue size MUST be capped at 5, removing oldest first on overflow.

#### Scenario: Multiple toasts stack

- GIVEN `toast.success("Saved")` and `toast.error("Failed")` are called rapidly
- WHEN both render
- THEN they appear stacked with the newest at top
