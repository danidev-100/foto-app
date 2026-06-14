# Proposal: Shared Component Library

## Intent

Every page in the frontend duplicates patterns inline — toasts, spinners, confirm dialogs, badges, empty states, pagination. This makes UI inconsistent, bloats page components (Admin.jsx alone is 1600+ lines), and makes every new page start from scratch. Extract these patterns into a reusable component library under `frontend/src/components/`.

## Scope

### In Scope
- Toast/Notification context provider with success/error/info types and auto-dismiss
- Modal/Dialog component with confirm/cancel, custom content, size variants
- Pagination bar component with page info and prev/next controls
- ConfirmDialog wrapper (delete/action confirmations)
- EmptyState component (icon + text + optional action)
- Loading (spinner) and Skeleton (lines, card) components
- Badge component with status variant presets

### Out of Scope
- New pages or features
- Backend or API changes
- New npm dependencies
- Changing existing component logic — extraction only

## Capabilities

### New Capabilities
- `toast-notification`: Context-based toast system — programmatic trigger, auto-dismiss, success/error/info types, configurable position
- `modal-dialog`: Reusable modal with backdrop, sizes, custom content, close-on-escape
- `confirm-dialog`: Modal wrapper for delete/action confirmations with callback pattern
- `pagination-bar`: Page navigation with prev/next, current page indicator, total pages
- `empty-state`: Consistent empty state with icon, message, optional action button
- `loading-skeleton`: Spinner and skeleton line/card variants for async content
- `badge`: Status badge presets with semantic colors (success, warning, error, info, neutral)

### Modified Capabilities
- None — no existing capability behavior changes

## Approach

Create standalone components in `frontend/src/components/`, each in its own file or directory. Toast uses React Context to avoid prop-drilling. All components accept Tailwind className overrides. No new dependencies — use existing Tailwind v4 utility classes.

| Component | Pattern | State handling |
|-----------|---------|---------------|
| Toast | Context + useReducer + portal | queue, auto-dismiss with timer |
| Modal | Controlled via `isOpen`/`onClose` | open state only |
| Pagination | Controlled via `page`/`onPageChange` | disabled states at bounds |
| ConfirmDialog | IsModal + `onConfirm`/`onCancel` | wrapper callback pattern |
| EmptyState | Pure presentational | icon/message/action only |
| Loading/Skeleton | Pure presentational | variant + size props |
| Badge | Pure presentational | variant prop maps to Tailwind classes |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/components/` | New | 7+ component files + Toast context |
| `frontend/src/pages/Admin.jsx` | Modified | Replace toast → Toast, confirm dialog → ConfirmDialog, badges → Badge, pagination → Pagination, loading → Loading/Skeleton |
| `frontend/src/pages/Catalog.jsx` | Modified | Replace toast → Toast, loading → Loading, empty state → EmptyState |
| `frontend/src/pages/Cart.jsx` | Modified | Replace loading → Loading, empty state → EmptyState |
| `frontend/src/pages/Orders.jsx` | Modified | Replace badges → Badge, loading → Loading/Skeleton, empty state → EmptyState |
| `frontend/src/pages/ContabilidadTab.jsx` | Modified | Replace loading → Loading/Skeleton, badges → Badge, empty state → EmptyState |
| `frontend/src/pages/Login.jsx` | Modified | Replace loading → Loading (spinner) |
| `frontend/src/pages/Register.jsx` | Modified | Replace loading → Loading (spinner) |
| `frontend/src/App.jsx` | Modified | Wrap with ToastProvider |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing toast behavior | Low | Keep same visuals for success/error; no API contract change |
| Tailwind v4 class conflicts | Low | Each component uses scoped utility classes; override via `className` prop |
| Toast provider missing on some pages | Low | Wrap at App.jsx level above all routes |

## Rollback Plan

Revert all page changes to `frontend/src/pages/*.jsx` and `frontend/src/App.jsx` via `git checkout`. Delete `frontend/src/components/` directory. Single-commit change.

## Dependencies

- React 19 (Context API built-in, no new deps)
- Tailwind CSS v4 (already installed)

## Success Criteria

- [ ] Toast works on Catalog, Admin, ContabilidadTab — same visuals as before
- [ ] Modal replaces `window.confirm()` in Admin.jsx for booklet/course deletion
- [ ] Pagination bar renders in Admin students section with working prev/next
- [ ] Badge components render identically to existing inline badges
- [ ] EmptyState renders in Catalog, Cart, Orders, Admin
- [ ] Loading and Skeleton replace all inline spinner/loading JSX
- [ ] No visual regressions across all pages
