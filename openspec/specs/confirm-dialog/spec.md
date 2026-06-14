# Confirm Dialog Specification

## Purpose

Modal wrapper specifically for destructive and action confirmations. Built on the Modal component — no new dependencies. Replaces `window.confirm()` and inline confirm patterns across pages.

## Requirements

### Requirement: Confirm dialog renders Modal with message and two buttons

The ConfirmDialog MUST render a Modal with a confirmation message, Cancel button, and Confirm button. Closing via backdrop or Cancel MUST call `onCancel`.

#### Scenario: Confirm dialog with message

- GIVEN `<ConfirmDialog isOpen={true} message="Delete booklet?" onConfirm={fn} onCancel={fn} />`
- WHEN rendered
- THEN a Modal with the message, Cancel button, and Confirm button appears

#### Scenario: Cancel via backdrop

- GIVEN a ConfirmDialog is open
- WHEN the user clicks the backdrop
- THEN `onCancel` is called and the dialog closes

### Requirement: Callback pattern for confirmation

The Confirm button MUST call `onConfirm`. Cancel button or Escape MUST call `onCancel`.

#### Scenario: User confirms destructive action

- GIVEN a ConfirmDialog is open
- WHEN the user clicks Confirm
- THEN `onConfirm` is called and the dialog closes

#### Scenario: User cancels

- GIVEN a ConfirmDialog is open
- WHEN the user clicks Cancel
- THEN `onCancel` is called and the dialog closes

### Requirement: Danger variant for destructive actions

A `variant="danger"` prop MUST render the Confirm button in red with danger styling.

#### Scenario: Danger variant for deletes

- GIVEN `<ConfirmDialog variant="danger" confirmLabel="Delete" />`
- WHEN rendered
- THEN the Confirm button is red with "Delete" label

### Requirement: Configurable button labels

`confirmLabel` and `cancelLabel` props MUST allow custom button text.

#### Scenario: Custom action labels

- GIVEN `<ConfirmDialog confirmLabel="Archive" cancelLabel="Keep" />`
- WHEN rendered
- THEN buttons display the custom labels
