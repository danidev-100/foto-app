# Design: Shared Component Library

## Technical Approach

Extract 7 duplicated UI patterns into reusable components under `frontend/src/components/`, each in its own file. Toast uses React Context + portal (same pattern as `AuthProvider`). Modal uses `createPortal`. All others are pure presentational or controlled components. Zero new npm deps — all styling via Tailwind v4 utility classes with `dark:` variants matching the existing `index.css` conventions.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Toast state | Context+useReducer vs Zustand | useReducer is built-in, no new deps | **Context+useReducer** — matches AuthProvider pattern, zero deps |
| Component files | One file per component vs barrel index | Flat imports vs convenience re-exports | **One file per component** — simpler, matches empty `components/` dir |
| Portal target | `document.body` vs `#root` sibling | body is universal but nesting edge cases | **`document.body`** — modal/confirm always on top |
| Badge variants | Tailwind merge vs conditional strings | `clsx` would be cleaner but adds a dep | **Inline conditional strings** — same pattern as `index.css` `btn-primary`, zero deps |
| Skeleton animation | `animate-pulse` vs custom keyframes | Tailwind built-in vs more control | **`animate-pulse`** — already global, matches the spinner `animate-spin` pattern |
| Dark mode | `dark:` variants per component | verbose but consistent | **`dark:` on every surface/text class** — matches existing codebase convention |

## Data Flow

```
ToastProvider (App.jsx)
  └── ToastContext.Provider
        ├── useToast() → { success, error, info }
        └── ToastContainer (portal to document.body)
              └── Toast[] (stacked, top-right)

Modal / ConfirmDialog
  ├── isOpen (prop) → renders portal to document.body
  ├── onClose (prop) → called on backdrop/Escape
  └── children rendered inside backdrop overlay

Pagination
  ├── page (prop) → renders prev/next
  ├── totalPages (prop) → disables bounds
  └── onPageChange (prop) → called with new page

EmptyState / Loading / Badge
  ├── Pure props → virtual DOM only
  └── No side effects, no state
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/components/ToastProvider.jsx` | Create | Context provider + useReducer + portal — `useToast()` hook exported |
| `frontend/src/components/Modal.jsx` | Create | Portal-based controlled modal with backdrop, Escape close, sizes |
| `frontend/src/components/ConfirmDialog.jsx` | Create | Modal wrapper for confirm/cancel with danger variant |
| `frontend/src/components/Pagination.jsx` | Create | Prev/Next bar with page info and boundary disable |
| `frontend/src/components/EmptyState.jsx` | Create | Centered icon + message + optional description + action |
| `frontend/src/components/Loading.jsx` | Create | Spinner, skeleton lines, and card skeleton variants |
| `frontend/src/components/Badge.jsx` | Create | Color variant badge with sm/md sizes |
| `frontend/src/App.jsx` | Modify | Wrap `<Routes>` with `<ToastProvider>`; replace `window.confirm()` on logout |
| `frontend/src/pages/Admin.jsx` | Modify | Replace inline toast → `useToast()`, inline modal → `<ConfirmDialog>`, `window.confirm()` → `<ConfirmDialog>`, inline spinner → `<Loading>`, inline badges → `<Badge>`, inline pagination → `<Pagination>`, inline empty states → `<EmptyState>` |
| `frontend/src/pages/Catalog.jsx` | Modify | Replace inline toast → `useToast()`, inline spinner → `<Loading>`, inline empty states → `<EmptyState>` |
| `frontend/src/pages/Cart.jsx` | Modify | Replace inline spinner → `<Loading>`, inline empty state → `<EmptyState>` |
| `frontend/src/pages/Orders.jsx` | Modify | Replace inline status badges → `<Badge>`, inline spinner → `<Loading>`, inline empty state → `<EmptyState>` |
| `frontend/src/pages/ContabilidadTab.jsx` | Modify | Replace inline toast/error → `useToast()`, inline spinner → `<Loading>`, inline badges → `<Badge>`, inline empty states → `<EmptyState>` |
| `frontend/src/pages/Login.jsx` | Modify | Replace inline spinner → `<Loading>` |
| `frontend/src/pages/Register.jsx` | Modify | Replace inline spinner → `<Loading>` |

## Interfaces / Contracts

```jsx
// ToastProvider
<ToastProvider>                      // wraps app, no props
  const toast = useToast();          // hook: { success, error, info }
  toast.success(msg, opts?);         // opts.duration overrides 3000ms
  toast.error(msg, opts?);
  toast.info(msg, opts?);

// Modal
<Modal isOpen onClose size title footer>
  {children}
</Modal>  // size: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen'

// ConfirmDialog
<ConfirmDialog isOpen message onConfirm onCancel
  confirmLabel cancelLabel variant />
  // variant: 'danger' | 'default'

// Pagination
<Pagination page totalPages onPageChange showPageInfo />
  // showPageInfo defaults to true; hidden when totalPages <= 1

// EmptyState
<EmptyState icon message description action />
  // icon: React component | null; action: { label, onClick }

// Loading
<Loading variant count className />
  // variant: 'spinner' | 'skeleton' | 'card'; count default 3

// Badge
<Badge variant size className>children</Badge>
  // variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; size: 'sm' | 'md'
```

## Existing Inline Mappings

| Inline Pattern | File | Replacement |
|---|---|---|
| `setToast({message,type})` + `setTimeout` | Admin, Catalog, ContabilidadTab | `toast.success()` / `toast.error()` |
| `window.confirm("¿Eliminar...?")` | Admin.jsx:546, App.jsx:149 | `<ConfirmDialog>` |
| Inline modal div with bg-black/40 | Admin.jsx:1113-1184 | `<ConfirmDialog variant="danger">` |
| `<div className="... animate-spin">` | All 8 pages | `<Loading variant="spinner">` |
| `loadingBooklets ? spinner : ...` | Catalog.jsx:191-196 | `<Loading variant="spinner">` |
| `studentsLoading ? spinner : ...` | Admin.jsx:1557-1560 | `<Loading variant="spinner">` |
| Inline empty div with SVG + text | Catalog, Cart, Orders, Admin, ContabilidadTab | `<EmptyState icon={...} message="...">` |
| Inline status badges | Orders.jsx:4-9, Admin.jsx:327-358 | `<Badge variant="success/warning/error">` |
| Inline pagination buttons | Admin.jsx:1613-1638 | `<Pagination page={...} totalPages={...}>` |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Each component renders with required props | React Testing Library — mount + assert DOM |
| Unit | Toast types render correct colors | Render provider + `toast.success()` → assert green class |
| Unit | Modal open/close behavior | Toggle `isOpen` prop, assert `createPortal` renders |
| Unit | Pagination disables at bounds | `page=1` → prev disabled; `page=totalPages` → next disabled |
| Unit | EmptyState icon optional | Mount with and without `icon` prop |
| Integration | ToastProvider wraps correctly | Mount in App tree, trigger from child |
| Visual | Badge color variants match existing | Side-by-side comparison with production classes |

## Migration / Rollout

No migration required. Components are pure additions — existing pages get updated one at a time by replacing inline JSX with component calls. Each replacement is visually identical since components use the same Tailwind v4 classes as the inline originals.

## Open Questions

- [ ] The `StatusBadge` in Admin.jsx (line 327) is a `<select>` element for status transitions — should we create a separate `StatusSelect` component or keep it inline? Per spec scope, keep as-is — badge is display only.
- [ ] The `.badge` CSS class in `index.css` defines `rounded-full` — the spec says "rounded-md" in some variants. Confirm which wins when applying. (Answer: the Badge component will use the `.badge` class from index.css as base + variant overrides.)
