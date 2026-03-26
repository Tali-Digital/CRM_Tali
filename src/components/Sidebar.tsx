import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  LogOut,
  Users,
  TrendingUp,
  UserPlus,
  RefreshCw,
  FileVideo,
  Edit2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  MonitorPlay,
  Layers
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
  const isUserVisible = (sectorId: string) => {
    if (userRole === 'admin' || userRole === 'equipe') return true;
    const sector = sectors?.find(s => s.id === sectorId);
    if (!sector || !sector.visibility || sector.visibility.length === 0) return true;
    return sector.visibility.includes(currentUserId);
  };
  const getIconForSector = (name: string, defaultIcon: any) => {
    const lower = name.toLowerCase().trim();
    if (lower.includes('tutorial') || lower.includes('tutoriais')) return MonitorPlay;
    return defaultIcon;
  };

  const menuItems: any[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
    { type: 'header', label: 'Cliente', onAdd: userRole === 'admin' ? () => onAddSector?.('cliente') : undefined },
    ...(isUserVisible('comercial') ? [{ 
      id: 'comercial', 
      icon: TrendingUp, 
      label: sectors?.find(s => s.id === 'comercial')?.name || 'Comercial',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'comercial') || { id: 'comercial', name: 'Comercial', group: 'cliente' }) : undefined
    }] : []),
    ...(isUserVisible('integracao') ? [{ 
      id: 'integracao', 
      icon: UserPlus, 
      label: sectors?.find(s => s.id === 'integracao')?.name || 'Integração do Cliente',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'integracao') || { id: 'integracao', name: 'Integração do Cliente', group: 'cliente' }) : undefined
    }] : []),
    ...(isUserVisible('operacao') ? [{ 
      id: 'operacao', 
      icon: RefreshCw, 
      label: sectors?.find(s => s.id === 'operacao')?.name || 'Operação Contínua',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'operacao') || { id: 'operacao', name: 'Operação Contínua', group: 'cliente' }) : undefined
    }] : []),
    ...(sectors?.filter(s => s.group === 'cliente' && !['comercial', 'integracao', 'operacao', 'internal_tasks'].includes(s.id) && isUserVisible(s.id)).map(s => ({
      id: s.id,
      icon: getIconForSector(s.name, TrendingUp),
      label: s.name,
      isDynamic: true,
      onEdit: userRole === 'admin' ? () => onEditSector?.(s) : undefined
    })) || []),
    { type: 'header', label: 'Tarefas', onAdd: userRole === 'admin' ? () => onAddSector?.('interno') : undefined },
    ...(isUserVisible('internal_tasks') ? [{ 
      id: 'internal_tasks', 
      icon: CheckCircle2, 
      label: sectors?.find(s => s.id === 'internal_tasks')?.name || 'Tarefas',
      onEdit: userRole === 'admin' ? () => onEditSector?.(sectors?.find(s => s.id === 'internal_tasks') || { id: 'internal_tasks', name: 'Tarefas', group: 'interno' }) : undefined
    }] : []),
    ...(sectors?.filter(s => s.group === 'interno' && !['internal_tasks'].includes(s.id) && isUserVisible(s.id)).map(s => ({
      id: s.id,
      icon: getIconForSector(s.name, CheckCircle2),
      label: s.name,
      isDynamic: true,
      onEdit: userRole === 'admin' ? () => onEditSector?.(s) : undefined
    })) || []),
  ];

  const themeClasses = 'bg-[#0C1122] text-white border-[#0C1122] shadow-2xl';
  const itemHoverClasses = 'hover:bg-[#5271FF] hover:text-white';
  const activeItemClasses = 'bg-[#5271FF] text-white shadow-md shadow-black/20';

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
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}
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

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
          {menuItems.map((item, index) => {
            if (item.type === 'header') {
              if (isCollapsed && !isMobileOpen) return <div key={`header-${index}`} className="h-px bg-white/10 my-4 mx-4" />;
              return (
                <div key={`header-${index}`} className="group flex items-center justify-between px-4 pt-4 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {item.label}
                  </span>
                  {item.onAdd && (
                    <button 
                      onClick={item.onAdd}
                      className="p-1 rounded-md hover:bg-white/10 text-white/20 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                      title={`Adicionar Novo sob ${item.label}`}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              );
            }

            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                data-sidebar-tab={item.id}
                onClick={() => onTabChange(item.id as any)}
                className={`w-full flex items-center ${isCollapsed && !isMobileOpen ? 'md:justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all ${
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
                    {item.onEdit && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          item.onEdit();
                        }}
                        className="p-1 rounded-md bg-white/0 hover:bg-white/20 text-white/0 group-hover:text-white/40 hover:text-white transition-all ml-2"
                        title="Editar Setor"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t space-y-1 border-white/10">
          <button
            onClick={() => onTabChange('equipe')}
            className={`w-full flex items-center ${isCollapsed && !isMobileOpen ? 'md:justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all ${
              activeTab === 'equipe' 
                ? activeItemClasses 
                : itemHoverClasses
            }`}
            title={isCollapsed ? 'Equipe' : ''}
          >
            <Briefcase size={20} className="shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span className="text-sm font-bold truncate">Equipe</span>}
          </button>
          {userRole !== 'client' && (
            <button
              onClick={() => onTabChange('clientes')}
              className={`w-full flex items-center ${isCollapsed && !isMobileOpen ? 'md:justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all ${
                activeTab === 'clientes' 
                  ? activeItemClasses 
                  : itemHoverClasses
              }`}
              title={isCollapsed ? 'Clientes' : ''}
            >
              <Users size={20} className="shrink-0" />
              {(!isCollapsed || isMobileOpen) && <span className="text-sm font-bold truncate">Clientes</span>}
            </button>
          )}
          <button 
            onClick={onLogout}
            className={`w-full flex items-center ${isCollapsed && !isMobileOpen ? 'md:justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all hover:bg-red-600 hover:text-white text-white/80`}
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
