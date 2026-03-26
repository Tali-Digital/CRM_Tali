const fs = require('fs');

let sector = fs.readFileSync('src/components/UnifiedSectorView.tsx', 'utf8');

sector = sector.replace(
  /<div \n          ref=\{boardRef\}\n          \{\.\.\.boardScrollProps\}\n          className=\{`flex-1 overflow-x-auto overflow-y-hidden select-none p-4 sm:p-8 custom-scrollbar-horizontal flex gap-8 \$\{dragClassName \|\| ''\}`\}/,
  `<DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >\n        <div \n          ref={boardRef}\n          {...boardScrollProps}\n          className={\`flex-1 overflow-x-auto overflow-y-hidden select-none p-4 sm:p-8 custom-scrollbar-horizontal flex gap-8 \${dragClassName || ''}\`}`);

sector = sector.replace(/<\/SortableContext>\n\n          <button /, '</SortableContext>\n\n          <button ');
sector = sector.replace(/<\/div>\n\n        <DragOverlay/, '</div>\n\n        <DragOverlay');
sector = sector.replace(/<\/DragOverlay>\n\n      \{\/\* Modais de Criar Lista\/Card \*\/\}/, '</DragOverlay>\n      </DndContext>\n\n      {/* Modais de Criar Lista/Card */}');

fs.writeFileSync('src/components/UnifiedSectorView.tsx', sector);
console.log('Restored');
