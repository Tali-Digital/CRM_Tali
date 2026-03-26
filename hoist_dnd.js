const fs = require('fs');

let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add dnd-kit imports to App.tsx
if (!appContent.includes('DndContext')) {
  appContent = appContent.replace("import { auth } from './firebase';",
    `import { auth } from './firebase';\nimport { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';\nimport { sortableKeyboardCoordinates } from '@dnd-kit/sortable';\nimport { defaultDropAnimationSideEffects } from '@dnd-kit/core';\nimport { SortableCard } from './components/SortableCard';`);
}

// 2. Wrap the return in DndContext. We'll add the handlers inside App later.
fs.writeFileSync('src/App.tsx', appContent);
console.log('Added imports to App.tsx');
