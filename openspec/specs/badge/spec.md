# Badge Specification

## Purpose

Small status badge with semantic color presets. Used for order status, payment status, and other classification labels. Replaces inline badge styling across Admin, Orders, and ContabilidadTab pages.

## Requirements

### Requirement: Status variant presets

The Badge MUST support `success`, `warning`, `error`, `info`, and `neutral` variants, each mapping to semantic Tailwind v4 colors.

#### Scenario: Success badge renders green

- GIVEN `<Badge variant="success">Paid</Badge>`
- WHEN rendered
- THEN the badge displays "Paid" with green background/text

#### Scenario: Error badge renders red

- GIVEN `<Badge variant="error">Failed</Badge>`
- WHEN rendered
- THEN the badge displays "Failed" with red styling

#### Scenario: Warning badge renders amber

- GIVEN `<Badge variant="warning">Pending</Badge>`
- WHEN rendered
- THEN the badge displays "Pending" with amber/yellow styling

#### Scenario: Neutral badge renders gray

- GIVEN `<Badge variant="neutral">Draft</Badge>`
- WHEN rendered
- THEN the badge displays "Draft" with gray styling

### Requirement: Children content

The Badge MUST render `children` inside the badge container.

#### Scenario: Badge with formatted content

- GIVEN `<Badge variant="info"><span>In Progress</span></Badge>`
- WHEN rendered
- THEN children render inside the badge

### Requirement: Optional size variant

A `size` prop (`sm`, `md`) MUST control padding and font size. Default is `md`.

#### Scenario: Small badge

- GIVEN `<Badge variant="success" size="sm">Paid</Badge>`
- WHEN rendered
- THEN the badge has reduced padding and smaller font

### Requirement: Custom className

The `className` prop MUST merge onto the badge element.

#### Scenario: Custom class applied

- GIVEN `<Badge variant="neutral" className="uppercase">Draft</Badge>`
- WHEN rendered
- THEN the badge includes the `uppercase` utility class
