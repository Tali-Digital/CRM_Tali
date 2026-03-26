const fs = require('fs');

let appContent = fs.readFileSync('src/App.tsx', 'utf8');

if (!appContent.includes('DndContext')) {
  appContent = appContent.replace("import { auth } from './firebase';",
    "import { auth } from './firebase';\nimport { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent } from '@dnd-kit/core';\nimport { sortableKeyboardCoordinates } from '@dnd-kit/sortable';\nimport { defaultDropAnimationSideEffects } from '@dnd-kit/core';\nimport { SortableCard } from './components/SortableCard';");
}

let sector = fs.readFileSync('src/components/UnifiedSectorView.tsx', 'utf8');

// Modify UnifiedSectorView
sector = sector.replace(/<DndContext[\s\S]*?>/m, '');
sector = sector.replace(/<\/DndContext>/g, '');
// Removing drag start / end logic inside it
fs.writeFileSync('src/components/UnifiedSectorView.tsx', sector);

console.log('Done script');
