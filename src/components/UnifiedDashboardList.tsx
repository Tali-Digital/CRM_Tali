import React from 'react';
import { 
  CommercialCard, 
  FinancialCard, 
  OperationCard, 
  InternalTaskCard,
  Client,
  Tag,
  UserProfile
} from '../types';
import { 
  TrendingUp, 
  Briefcase, 
  RefreshCw, 
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface UnifiedDashboardListProps {
  commercialCards: CommercialCard[];
  financialCards: FinancialCard[];
  operationCards: OperationCard[];
  internalTaskCards: InternalTaskCard[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onNavigate: (tab: any) => void;
}

export const UnifiedDashboardList: React.FC<UnifiedDashboardListProps> = ({
  commercialCards,
  financialCards,
  operationCards,
  internalTaskCards,
  clients,
  tags,
  users,
  onNavigate
}) => {
  const getClientName = (card: any) => {
    if (card.type === 'custom') return card.title || 'Sem título';
    const client = clients.find(c => c.id === card.clientId);
    return client ? client.name : card.clientName || card.title || 'Cliente desconhecido';
  };

  const formatDate = (date: any) => {
    if (!date) return '---';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const allActiveCards = [
    ...commercialCards.filter(c => !c.deleted && !c.completed).map(c => ({ ...c, metaType: 'comercial' as const })),
    ...financialCards.filter(c => !c.deleted && !c.completed).map(c => ({ ...c, metaType: 'integracao' as const })),
    ...operationCards.filter(c => !c.deleted && !c.completed).map(c => ({ ...c, metaType: 'operacao' as const })),
    ...internalTaskCards.filter(c => !c.deleted && !c.completed).map(c => ({ ...c, metaType: 'internal_tasks' as const }))
  ].sort((a, b) => {
    const dateA = a.updatedAt instanceof Timestamp ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
    const dateB = b.updatedAt instanceof Timestamp ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
    return dateB - dateA;
  });

  const getSectorIcon = (type: string) => {
    switch (type) {
      case 'comercial': return <TrendingUp size={14} className="text-blue-500" />;
      case 'integracao': return <Briefcase size={14} className="text-emerald-500" />;
      case 'operacao': return <RefreshCw size={14} className="text-orange-500" />;
      case 'internal_tasks': return <CheckCircle2 size={14} className="text-purple-500" />;
      default: return null;
    }
  };

  const getSectorLabel = (type: string) => {
    switch (type) {
      case 'comercial': return 'Comercial';
      case 'integracao': return 'Integração';
      case 'operacao': return 'Operação';
      case 'internal_tasks': return 'Interno';
      default: return '';
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden flex-1 flex flex-col min-h-0">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
            <tr className="border-b border-stone-100">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Card / Cliente</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Setor</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Membros</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Atualizado</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {allActiveCards.map((card) => (
              <tr 
                key={`${card.metaType}-${card.id}`} 
                className="group hover:bg-stone-50/50 transition-all cursor-pointer"
                onClick={() => onNavigate(card.metaType)}
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-stone-900 leading-tight">{getClientName(card)}</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {card.tags?.slice(0, 2).map(tagId => {
                        const t = tags.find(tag => tag.id === tagId);
                        if (!t) return null;
                        return (
                          <span 
                            key={tagId} 
                            className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-stone-100 text-stone-400"
                          >
                            {t.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-stone-100 flex items-center justify-center group-hover:bg-white transition-colors">
                      {getSectorIcon(card.metaType)}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">{getSectorLabel(card.metaType)}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-1.5">
                    {card.assignees?.slice(0, 3).map(userId => {
                      const u = users.find(user => user.id === userId);
                      if (!u) return null;
                      return (
                        <div key={userId} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden bg-stone-100" title={u.name}>
                          {u.photoURL ? <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-stone-400">{u.name.charAt(0)}</div>}
                        </div>
                      );
                    })}
                    {(card.assignees?.length || 0) > 3 && (
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-stone-100 flex items-center justify-center text-[8px] font-bold text-stone-400">
                        +{(card.assignees?.length || 0) - 3}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-xs font-bold text-stone-400">
                    <Clock size={12} />
                    <span>{formatDate(card.updatedAt)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <ChevronRight size={16} className="text-stone-300 group-hover:text-stone-900 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {allActiveCards.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-stone-300">
          <Layers size={40} className="mb-4 opacity-20" />
          <p className="text-sm font-bold tracking-tight">Nenhum card ativo encontrado.</p>
        </div>
      )}
    </div>
  );
};
