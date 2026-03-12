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
  CheckCircle2
} from 'lucide-react';
import { Logo } from './Logo';

interface Props {
  onLogout: () => void;
  activeTab: 'dashboard' | 'projects' | 'reports' | 'comercial' | 'integracao' | 'operacao' | 'clientes' | 'internal_tasks';
  onTabChange: (tab: 'dashboard' | 'projects' | 'reports' | 'comercial' | 'integracao' | 'operacao' | 'clientes' | 'internal_tasks') => void;
}

export const Sidebar: React.FC<Props> = ({ onLogout, activeTab, onTabChange }) => {
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
    <div className={`w-64 h-screen flex flex-col p-4 fixed left-0 top-0 border-r font-nunito z-[999] ${themeClasses}`}>
      <div className="mb-10 px-2">
        <Logo className="h-8 w-auto mb-2" />
        <p className="text-[10px] uppercase tracking-widest mt-1 font-bold text-white/60">
          Sistema de Gestão
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
        {menuItems.map((item, index) => {
          if (item.type === 'header') {
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
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? activeItemClasses 
                  : itemHoverClasses
              }`}
            >
              <Icon size={20} />
              <span className="text-sm font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="pt-4 border-t space-y-1 border-white/10">
        <button
          onClick={() => onTabChange('clientes')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
            activeTab === 'clientes' 
              ? activeItemClasses 
              : itemHoverClasses
          }`}
        >
          <Users size={20} />
          <span className="text-sm font-bold">Clientes</span>
        </button>
        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all hover:bg-red-600 hover:text-white text-white/80"
        >
          <LogOut size={20} />
          <span className="text-sm font-bold">Sair</span>
        </button>
      </div>
    </div>
  );
};
