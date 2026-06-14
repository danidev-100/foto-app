# Empty State Specification

## Purpose

Consistent empty state display when lists, search results, or pages have no data. Renders an icon, message text, and optional action button. Replaces inline empty-state JSX across Catalog, Cart, Orders, and Admin pages.

## Requirements

### Requirement: Icon and centered message

The EmptyState MUST render a large icon above centered message text.

#### Scenario: Simple empty state

- GIVEN `<EmptyState icon={InboxIcon} message="No orders yet" />`
- WHEN rendered
- THEN a centered layout shows the icon above "No orders yet"

#### Scenario: Long message wraps

- GIVEN `<EmptyState message="No booklets match your filters. Try adjusting your search criteria." />`
- WHEN rendered
- THEN the message wraps within the available width

### Requirement: Optional action button

An `action` prop with `{label, onClick}` MUST render a styled button below the message.

#### Scenario: Empty state with action

- GIVEN `<EmptyState message="Cart is empty" action={{ label: "Browse Catalog", onClick: fn }} />`
- WHEN rendered
- THEN a button with "Browse Catalog" appears below the message
- WHEN the user clicks it
- THEN `action.onClick` is called

### Requirement: Custom icon component

The `icon` prop MUST accept any React component. When omitted, no icon renders.

#### Scenario: Custom icon

- GIVEN `<EmptyState icon={SearchIcon} message="No results" />`
- WHEN rendered
- THEN SearchIcon renders in the icon slot

### Requirement: Optional description text

A `description` prop MUST render smaller secondary text below the main message.

#### Scenario: Empty state with description

- GIVEN `<EmptyState message="No students" description="Students will appear once they register" />`
- WHEN rendered
- THEN the description appears below the main message in muted text
