import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  LogOut,
  Users,
  TrendingUp,
  UserPlus,
  RefreshCw,
  Edit2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  MonitorPlay,
  Link,
  Search,
  FileText,
  Lock,
  Map
} from 'lucide-react';
import { Logo } from './Logo';

interface Props {
  onLogout: () => void;
  activeTab: string;
  onTabChange: (tab: any) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onClose?: () => void;
  userRole?: string;
  sectors?: any[];
  onAddSector?: (group: 'cliente' | 'interno') => void;
  onEditSector?: (sector: any) => void;
  currentUserId?: string;
}

export const Sidebar: React.FC<Props> = ({ onLogout, activeTab, onTabChange, isCollapsed, onToggleCollapse, isMobileOpen, onClose, userRole, sectors, onAddSector, onEditSector, currentUserId }) => {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    vendas: false,
    clientes: false,
    tarefas: false,
    configuracoes: false
  });

  const toggleMenu = (menu: string) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const isUserVisible = (sectorId: string) => {
    if (userRole === 'admin') return true;
    const sector = sectors?.find(s => s.id === sectorId);
    if (!sector || !sector.visibility || sector.visibility.length === 0) return false;
    return sector.visibility.includes(currentUserId);
  };
  
  const getIconForSector = (name: string, defaultIcon: any) => {
    const lower = name.toLowerCase().trim();
    if (lower.includes('tutorial') || lower.includes('tutoriais')) return MonitorPlay;
    return defaultIcon;
  };

  // 1. Clientes
  const clienteChildren = [
    ...(isUserVisible('comercial') ? [{ 
      id: 'comercial', icon: TrendingUp, label: sectors?.find(s => s.id === 'comercial')?.name || 'Comercial',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'comercial') || { id: 'comercial', name: 'Comercial', group: 'cliente' }) : undefined
    }] : []),
    ...(isUserVisible('integracao') ? [{ 
      id: 'integracao', icon: UserPlus, label: sectors?.find(s => s.id === 'integracao')?.name || 'Integração do Cliente',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'integracao') || { id: 'integracao', name: 'Integração do Cliente', group: 'cliente' }) : undefined
    }] : []),
    ...(isUserVisible('operacao') ? [{ 
      id: 'operacao', icon: RefreshCw, label: sectors?.find(s => s.id === 'operacao')?.name || 'Operação Contínua',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'operacao') || { id: 'operacao', name: 'Operação Contínua', group: 'cliente' }) : undefined
    }] : []),
    ...(sectors?.filter(s => s.group === 'cliente' && !['comercial', 'integracao', 'operacao', 'internal_tasks'].includes(s.id) && isUserVisible(s.id)).map(s => ({
      id: s.id, icon: getIconForSector(s.name, TrendingUp), label: s.name, onEdit: userRole === 'admin' ? () => onEditSector?.(s) : undefined
    })) || [])
  ];

  // 2. Tarefas
  const tarefasChildren = [
    ...(isUserVisible('internal_tasks') ? [{ 
      id: 'internal_tasks', icon: CheckCircle2, label: sectors?.find(s => s.id === 'internal_tasks')?.name || 'Tarefas',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'internal_tasks') || { id: 'internal_tasks', name: 'Tarefas', group: 'interno' }) : undefined
    }] : []),
    ...(sectors?.filter(s => s.group === 'interno' && !['internal_tasks'].includes(s.id) && isUserVisible(s.id)).map(s => ({
      id: s.id, icon: getIconForSector(s.name, CheckCircle2), label: s.name, onEdit: userRole === 'admin' ? () => onEditSector?.(s) : undefined
    })) || [])
  ];

  const topMenuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
    { id: 'links', icon: Link, label: 'Links Rápidos' },
    {
      id: 'vendas', icon: Search, label: 'Vendas & Prospecção', isGroup: true,
      children: [
        { id: 'prospeccao', icon: Search, label: 'Prospecção online' },
        { id: 'editor_prospeccao', icon: FileText, label: 'Prospecção Presencial' },
        { id: 'rota_prospeccao', icon: Map, label: 'Rota de Prospecção' },
      ]
    },
    {
      id: 'clientes', icon: Users, label: 'Clientes e Operação', isGroup: true,
      onAdd: userRole === 'admin' ? () => onAddSector?.('cliente') : undefined,
      children: clienteChildren
    },
    {
      id: 'tarefas', icon: CheckCircle2, label: 'Atividades e Rotinas', isGroup: true,
      onAdd: userRole === 'admin' ? () => onAddSector?.('interno') : undefined,
      children: tarefasChildren
    }
  ];

  const bottomMenuItems = [
    {
      id: 'configuracoes', icon: Settings, label: 'Administrativo', isGroup: true,
      children: [
        { id: 'equipe', icon: Briefcase, label: 'Equipe' },
        ...(userRole !== 'equipe' ? [{ id: 'clientes', icon: Users, label: 'Base de Clientes' }] : []),
        ...(userRole === 'admin' ? [{ id: 'admin', icon: Lock, label: 'Administração' }] : []),
      ]
    }
  ];

  const themeClasses = 'bg-[#0C1122] text-white border-[#0C1122] shadow-2xl';
  const itemHoverClasses = 'hover:bg-[#5271FF] hover:text-white';
  const activeItemClasses = 'bg-[#5271FF] text-white shadow-md shadow-black/20';

  const renderItem = (item: any, isBottom: boolean = false) => {
    if (item.isGroup) {
      const isOpen = openMenus[item.id] || (isCollapsed && !isMobileOpen); // keep visual state for collapsed
      
      // Auto expand se algum filho está ativo
      const isChildActive = item.children?.some((c: any) => c.id === activeTab);
      const shouldOpen = isOpen || isChildActive;

      return (
        <div key={item.id} className="mb-2">
          <button 
            onClick={() => {
              if (isCollapsed && !isMobileOpen) {
                onToggleCollapse(); // expande a sidebar primeiro
              }
              toggleMenu(item.id);
            }} 
            className={`w-full flex items-center ${isCollapsed && !isMobileOpen ? 'justify-center' : 'justify-between'} px-4 py-3 rounded-xl transition-all ${itemHoverClasses} ${isChildActive ? 'bg-white/5' : ''}`}
            title={isCollapsed ? item.label : ''}
          >
            <div className="flex items-center space-x-3">
               <item.icon size={20} className={`shrink-0 ${isChildActive ? 'text-[#5271FF]' : ''}`} />
               {(!isCollapsed || isMobileOpen) && <span className="text-sm font-bold truncate">{item.label}</span>}
            </div>
            {(!isCollapsed || isMobileOpen) && (
               <div className="flex items-center gap-1">
                  {item.onAdd && (
                    <div 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        e.preventDefault();
                        if(item.onAdd) item.onAdd(); 
                      }} 
                      className="p-1 hover:bg-[#5271FF] rounded-md transition-colors"
                      title="Adicionar"
                    >
                      <Plus size={16} />
                    </div>
                  )}
                  <ChevronDown size={16} className={`transition-transform duration-300 ${shouldOpen ? 'rotate-180' : ''}`} />
               </div>
            )}
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${shouldOpen && (!isCollapsed || isMobileOpen) ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            <div className="pl-4 pr-1 space-y-1 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[1px] before:bg-white/10">
              {item.children.map((child: any) => {
                 const isActive = activeTab === child.id;
                 const ChildIcon = child.icon;
                 return (
                   <a 
                     key={child.id} 
                     href={`#/${child.id}`}
                     onClick={() => {
                       onTabChange(child.id);
                       if (window.innerWidth < 768 && onClose) onClose();
                     }}
                     className={`w-full flex items-center justify-between pl-6 pr-4 py-2.5 rounded-xl transition-all ${isActive ? activeItemClasses : itemHoverClasses} relative`}
                   >
                      <div className="flex items-center space-x-3 min-w-0">
                        {isActive && <div className="absolute left-[3px] top-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full bg-[#5271FF]" />}
                        <ChildIcon size={16} className={`shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`} />
                        <span className={`text-sm truncate ${isActive ? 'font-bold' : 'font-medium text-white/80'}`}>{child.label}</span>
                      </div>
                      {child.onEdit && (
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            child.onEdit();
                          }}
                          className="p-1 rounded-md hover:bg-white/20 text-white/40 hover:text-white transition-all ml-2 flex-shrink-0"
                          title="Editar"
                        >
                          <Edit2 size={12} />
                        </div>
                      )}
                   </a>
                 )
              })}
            </div>
          </div>
        </div>
      );
    }

    // Normal Item
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <a
        key={item.id}
        data-sidebar-tab={item.id}
        href={`#/${item.id}`}
        onClick={() => {
          onTabChange(item.id as any);
          if (window.innerWidth < 768 && onClose) onClose();
        }}
        className={`w-full flex items-center ${isCollapsed && !isMobileOpen ? 'md:justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all mb-1 ${
          isActive 
            ? activeItemClasses 
            : itemHoverClasses
        }`}
        title={isCollapsed ? item.label : ''}
      >
        <Icon size={20} className="shrink-0" />
        {(!isCollapsed || isMobileOpen) && (
          <div className="flex-1 flex items-center justify-between min-w-0">
            <span className="text-sm font-bold truncate">{item.label}</span>
          </div>
        )}
      </a>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[998] md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed left-0 top-0 h-screen flex flex-col p-4 border-r font-nunito z-[999] transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-20' : 'md:w-[280px]'}
        ${themeClasses}
      `}>
        <div className={`mb-10 px-2 flex items-center justify-between ${isCollapsed ? 'md:flex-col md:gap-6 pt-2' : ''}`}>
          {!isCollapsed || isMobileOpen ? (
            <div className="flex flex-col">
              <Logo className="h-8 w-auto mb-1" />
              <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">
                Sistema de Gestão
              </p>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <Logo className="h-7 w-auto" />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <button 
              onClick={onToggleCollapse}
              className={`hidden md:block p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white ${isCollapsed ? 'mt-2' : ''}`}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            
            {isMobileOpen && (
              <button 
                onClick={onClose}
                className="md:hidden p-2 rounded-xl bg-white/10 text-white"
              >
                <ChevronLeft size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Top Menus */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
          {topMenuItems.map(item => renderItem(item))}
        </nav>

        {/* Bottom Menus */}
        <div className="pt-4 border-t border-white/10 mt-2">
          {bottomMenuItems.map(item => renderItem(item, true))}
          
          <button
            onClick={onLogout}
            className={`w-full flex items-center mt-2 ${isCollapsed && !isMobileOpen ? 'md:justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all hover:bg-red-500/20 text-red-400 hover:text-red-300`}
            title={isCollapsed ? 'Sair' : ''}
          >
            <LogOut size={20} className="shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span className="text-sm font-bold truncate">Sair</span>}
          </button>
        </div>
      </div>
    </>
  );
};
