import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  BarChart3, 
  Settings, 
  LogOut,
  Users,
  TrendingUp,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Logo } from './Logo';

interface Props {
  onLogout: () => void;
  activeTab: 'dashboard' | 'projects' | 'reports' | 'comercial' | 'integracao' | 'operacao' | 'clientes' | 'internal_tasks';
  onTabChange: (tab: 'dashboard' | 'projects' | 'reports' | 'comercial' | 'integracao' | 'operacao' | 'clientes' | 'internal_tasks') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<Props> = ({ onLogout, activeTab, onTabChange, isCollapsed, onToggleCollapse }) => {
  const menuItems: any[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { type: 'header', label: 'Blocos da Agência' },
    { id: 'comercial', icon: TrendingUp, label: 'Comercial' },
    { id: 'integracao', icon: UserPlus, label: 'Integração do Cliente' },
    { id: 'operacao', icon: RefreshCw, label: 'Operação Contínua' },
    { type: 'header', label: 'Tarefas Internas' },
    { id: 'internal_tasks', icon: CheckCircle2, label: 'Tarefas Internas' },
  ];

  const themeClasses = 'bg-[#0C1122] text-white border-[#0C1122]';
  const itemHoverClasses = 'hover:bg-[#5271FF] hover:text-white';
  const activeItemClasses = 'bg-[#5271FF] text-white shadow-md';

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen flex flex-col p-4 fixed left-0 top-0 border-r font-nunito z-[999] transition-all duration-300 ease-in-out ${themeClasses}`}>
      <div className={`mb-10 px-2 flex items-center justify-between ${isCollapsed ? 'flex-col gap-6 pt-2' : ''}`}>
        {!isCollapsed ? (
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
        <button 
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white ${isCollapsed ? 'mt-2' : ''}`}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
        {menuItems.map((item, index) => {
          if (item.type === 'header') {
            if (isCollapsed) return <div key={`header-${index}`} className="h-px bg-white/10 my-4 mx-4" />;
            return (
              <div key={`header-${index}`} className="px-4 pt-4 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  {item.label}
                </span>
              </div>
            );
          }

          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as any)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? activeItemClasses 
                  : itemHoverClasses
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <Icon size={20} className="shrink-0" />
              {!isCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="pt-4 border-t space-y-1 border-white/10">
        <button
          onClick={() => onTabChange('clientes')}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all ${
            activeTab === 'clientes' 
              ? activeItemClasses 
              : itemHoverClasses
          }`}
          title={isCollapsed ? 'Clientes' : ''}
        >
          <Users size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-sm font-bold truncate">Clientes</span>}
        </button>
        <button 
          onClick={onLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} px-4 py-3 rounded-xl transition-all hover:bg-red-600 hover:text-white text-white/80`}
          title={isCollapsed ? 'Sair' : ''}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-sm font-bold truncate">Sair</span>}
        </button>
      </div>
    </div>
  );
};
