const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The broken part starts at return (
const returnStartStr = '  return (';
const index = content.lastIndexOf(returnStartStr);
if (index !== -1) {
  const head = content.substring(0, index);
  const fixedReturn = \`  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-stone-50 flex">
        <Sidebar 
          onLogout={handleLogout} 
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setIsMobileMenuOpen(false);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          userRole={userProfile?.role}
          sectors={allSectors.filter(s => !s.deleted)}
          onAddSector={(group) => {
            setAddSectorGroup(group);
            setIsAddSectorOpen(true);
          }}
          onEditSector={(sector) => {
            setEditingSector(sector);
            setEditSectorName(sector.name);
            setIsEditSectorOpen(true);
          }}
        />
        
        <main className={\`flex-1 \${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} transition-all duration-300 font-nunito flex flex-col bg-stone-50 h-screen overflow-hidden\`}>
          <header className="flex items-center justify-between px-4 md:px-6 py-2 shrink-0 bg-white border-b border-stone-100 relative z-20">
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 mr-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 rounded-xl text-stone-600 hover:bg-stone-100 md:hidden"
              >
                <Menu size={24} />
              </button>
              <div className="shrink-0">
                <h1 className="text-base md:text-lg font-black text-stone-900 tracking-tight leading-none">
                  Talí<span className="hidden sm:inline"> Agência Digital</span>
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <button
                onClick={() => setAudioMuted(!isAudioEnabled)}
                className="p-2 md:p-3 rounded-2xl bg-stone-50 text-stone-600 hover:bg-stone-100 transition-all flex items-center justify-center border border-stone-100"
                title={isAudioEnabled ? "Mutar sons" : "Ativar sons"}
              >
                {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <NotificationCenter users={users} tags={tags} currentUserId={user?.uid} userRole={userProfile?.role} />
              <div className="w-px h-6 bg-stone-200 mx-1 md:mx-2 hidden md:block"></div>
              <UserMenu 
                userProf={userProfile} 
                onEditProfile={() => setIsProfileOpen(true)}
                onManageUsers={() => setIsUserManagementOpen(true)}
              />
            </div>
          </header>

          {renderTabContent()}
        </main>
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeId ? (
           <div className="w-[380px] scale-105 pointer-events-none opacity-80">
              {/* Simplified Drag Item for App Level */}
              <div className="bg-white p-4 rounded-2xl shadow-2xl border border-stone-200">
                <p className="text-sm font-bold text-stone-900">{activeCard?.title || activeCard?.clientName || 'Arrastando Card...'}</p>
              </div>
           </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function AppWithHistory() {
  return (
    <HistoryProvider>
      <App />
    </HistoryProvider>
  );\n}\n\`;
  
  // Find where export default function AppWithHistory() starts to cut off the old mess
  const searchMess = 'export default function AppWithHistory()';
  content = head + fixedReturn;
  fs.writeFileSync('src/App.tsx', content);
  console.log('Fixed App.tsx');
} else {
  console.log('Could not find return start');
}
