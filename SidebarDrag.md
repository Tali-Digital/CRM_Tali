How to implement Sidebar Drop:
1. In `Sidebar.tsx`, add `data-sidebar-tab={item.id}` to the sidebar buttons.
2. In `UnifiedSectorView.tsx`, track the pointer position via a `useEffect` on `window.addEventListener('pointermove', ...)` that updates a global variable `window.__lastDragPos`.
3. In `handleDragEnd`, read `window.__lastDragPos`, optionally use `document.elementsFromPoint(x, y)` to find the sidebar tab.
4. If dropped on a sidebar tab, call `onMoveToSector(activeCard, targetSector)`.
