# Proposal: Make FotoApp Fully Responsive

## Intent

FotoApp works on desktop but breaks on mobile — tabs overflow, tables clip instead of scrolling, badges burst their containers, and toasts float off-screen. Fix all pages to work from 320px phones to desktop without horizontal scroll at the page level.

## Scope

### In Scope
- Admin tabs: wrap or scroll on mobile
- All 9+ tables: horizontal scroll wrappers instead of `overflow-hidden`
- Order badges & action buttons: add `flex-wrap`
- Cart item layout: collapse to vertical on small screens
- Toast notifications: constrain width and pin both sides on mobile
- Login/Register theme toggle: prevent overlap with heading
- User pagination: responsive stacking

### Out of Scope
- Backend, API, or database changes
- New npm packages or UI libraries
- Logic refactors or behavior changes
- `html lang` or page title fixes (cosmetic, not responsiveness)

## Capabilities

> No spec-level behavior changes — this is a pure CSS/layout refactor.

### New Capabilities
None

### Modified Capabilities
None

## Approach

Pure Tailwind CSS v4 utility adjustments — no new CSS files, no JS logic changes:

| Issue | Fix | Files |
|-------|-----|-------|
| Table overflow | Wrap each `<table>` in `<div className="overflow-x-auto">` | Admin.jsx, ContabilidadTab.jsx |
| Admin tabs wrap | Add `flex-wrap` or `overflow-x-auto snap-x` | Admin.jsx |
| Order badges wrap | Add `flex-wrap` to badge container | Orders.jsx |
| Cart item cramp | `flex-col sm:flex-row` on item rows | Cart.jsx |
| Toast off-screen | Add `left-4 sm:left-auto max-w-sm` | Catalog, Admin, ContabilidadTab |
| Theme toggle overlap | Add padding/left margin or restructure layout | Login.jsx, Register.jsx |
| Pagination stack | `flex-col sm:flex-row` on controls | Admin.jsx |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/pages/Admin.jsx` | Modified | Table wrappers, tabs wrap, toast positioning, pagination |
| `frontend/src/pages/ContabilidadTab.jsx` | Modified | Table wrappers, toast positioning |
| `frontend/src/pages/Orders.jsx` | Modified | Badge + button flex-wrap |
| `frontend/src/pages/Cart.jsx` | Modified | Responsive item layout |
| `frontend/src/pages/Catalog.jsx` | Modified | Toast positioning |
| `frontend/src/pages/Login.jsx` | Modified | Theme toggle repositioning |
| `frontend/src/pages/Register.jsx` | Modified | Theme toggle repositioning |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `overflow-x-auto` inside `overflow-hidden` cards may shift layout on desktop | Low | Test on 3 viewports after change |
| Cart DOM restructure could break quantity update logic | Low | Visual check; no JS selector changes needed |
| Toast positioning overlaps other fixed elements | Low | Already isolated; no other fixed elements exist |

## Rollback Plan

Revert with `git checkout -- frontend/src/pages/`. All changes are isolated to 7 files with no cross-cutting dependencies — revert any file individually.

## Dependencies

None. All changes are self-contained CSS/class adjustments.

## Success Criteria

- [ ] No horizontal page overflow on 320px, 375px, 414px viewports
- [ ] All tables scroll horizontally on mobile (test booklet list, orders, users, contabilidad)
- [ ] Admin tab bar wraps or scrolls without overflow on 375px
- [ ] Cart items stack vertically on <640px width
- [ ] Toast notifications fully visible on mobile
- [ ] All interactive elements have ≥44px touch targets
- [ ] No regressions on desktop (≥1024px) layout
