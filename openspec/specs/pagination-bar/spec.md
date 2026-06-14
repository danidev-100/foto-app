# Pagination Bar Specification

## Purpose

Page navigation bar with prev/next controls and current page indicator. Controlled via `page`/`onPageChange`/`totalPages` props. Replaces inline pagination in Admin and catalog pages.

## Requirements

### Requirement: Prev/Next navigation with boundary disable

The pagination bar MUST render Previous and Next buttons. Previous MUST be disabled on page 1. Next MUST be disabled on the last page.

#### Scenario: First page disables Previous

- GIVEN `<Pagination page={1} totalPages={5} onPageChange={fn} />`
- WHEN rendered
- THEN Previous is disabled, Next is enabled, and "Page 1 of 5" is displayed

#### Scenario: Last page disables Next

- GIVEN `page={5}` and `totalPages={5}`
- WHEN rendered
- THEN Next is disabled, Previous is enabled

### Requirement: Page change callback

Clicking Previous or Next MUST call `onPageChange(page - 1)` or `onPageChange(page + 1)` respectively.

#### Scenario: Navigate to next page

- GIVEN `page={2}` and `onPageChange={spy}`
- WHEN the user clicks Next
- THEN `onPageChange` is called with `3`

#### Scenario: Navigate to previous page

- GIVEN `page={3}`
- WHEN the user clicks Previous
- THEN `onPageChange` is called with `2`

### Requirement: Hide when single page

When `totalPages <= 1`, the pagination bar MUST render nothing.

#### Scenario: Single page hides bar

- GIVEN `totalPages={1}`
- WHEN rendered
- THEN the component returns null

### Requirement: Optional page info toggle

A `showPageInfo` prop (defaulting to true) controls whether "Page X of Y" text renders.

#### Scenario: Page info suppressed

- GIVEN `<Pagination showPageInfo={false} />`
- WHEN rendered
- THEN only prev/next buttons show, no page count text
