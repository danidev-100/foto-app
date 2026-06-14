# Loading Skeleton Specification

## Purpose

Loading indicators for async content: a circular spinner for brief waits and pulsing skeleton placeholders for longer content loading. Replaces all inline spinner/loading JSX across pages.

## Requirements

### Requirement: Spinner variant

A `variant="spinner"` MUST render a centered rotating circular animation.

#### Scenario: Spinner renders centered

- GIVEN `<Loading variant="spinner" />`
- WHEN rendered
- THEN a spinning circle animation is centered in the container

### Requirement: Skeleton line variant

A `variant="skeleton"` MUST render pulsing gray rectangles simulating text lines. A `count` prop (default 3) controls the number of lines.

#### Scenario: Three skeleton lines

- GIVEN `<Loading variant="skeleton" count={3} />`
- WHEN rendered
- THEN three stacked pulsing rectangles appear

#### Scenario: Single skeleton line

- GIVEN `<Loading variant="skeleton" count={1} />`
- WHEN rendered
- THEN a single rectangle appears (default count is 3)

### Requirement: Skeleton card variant

A `variant="card"` MUST render an image block placeholder followed by two skeleton lines, simulating a card layout.

#### Scenario: Card skeleton

- GIVEN `<Loading variant="card" count={2} />`
- WHEN rendered
- THEN two card skeletons appear, each with a top image block and two line skeletons below

### Requirement: Custom className

All variants MUST accept a `className` prop merged onto the root container element.

#### Scenario: Custom class applied

- GIVEN `<Loading variant="spinner" className="h-64" />`
- WHEN rendered
- THEN the `h-64` class is applied to the root container
