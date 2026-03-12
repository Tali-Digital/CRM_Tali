import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, CheckSquare, Calendar, User, AlignLeft, Clock, RotateCcw, Trash2 } from 'lucide-react';
import { deleteCommercialCard, deleteFinancialCard, deleteOperationCard, deleteInternalTaskCard } from '../services/firestoreService';
import { Timestamp } from 'firebase/firestore';
import { CommercialCard, FinancialCard, OperationCard, InternalTaskCard, Client, UserProfile, Tag } from '../types';

interface QuickViewCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CommercialCard | FinancialCard | OperationCard | InternalTaskCard | null;
  client?: Client;
  users: UserProfile[];
  tags: Tag[];
  onEdit: () => void;
  sector: 'commercial' | 'financial' | 'operation' | 'internal';
}

export const QuickViewCardModal: React.FC<QuickViewCardModalProps> = ({ 
  isOpen, 
  onClose, 
  card, 
  client, 
  users, 
  tags, 
  onEdit,
  sector
}) => {
  if (!card) return null;

  const checklist = client?.checklist || card.checklist || [];
  const completedCount = checklist.filter(i => i.completed).length;
  const totalCount = checklist.length;
  
  const title = card.type === 'client' && client ? client.name : (card.title || (card as any).clientName || 'Card sem Título');
  
  const formatDate = (date: any) => {
    if (!date) return 'Não definida';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getSectorLabel = () => {
    switch (sector) {
      case 'commercial': return 'Comercial';
      case 'financial': return 'Integração';
      case 'operation': return 'Operação';
      case 'internal': return 'Tarefas Internas';
      default: return '';
    }
  };

  const getSectorColor = () => {
    switch (sector) {
      case 'commercial': return 'stone';
      case 'financial': return 'blue';
      case 'operation': return 'green';
      case 'internal': return 'purple';
      default: return 'stone';
    }
  };

  const sectorColor = getSectorColor();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-nunito">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header com Gradiente Sutil */}
            <div className={`h-2 bg-gradient-to-r from-${sectorColor}-400 to-${sectorColor}-600`} />
            
            <div className="flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-3">
                <div className={`px-4 py-1.5 rounded-full bg-${sectorColor}-50 border border-${sectorColor}-100 text-${sectorColor}-600 text-[10px] font-black uppercase tracking-widest`}>
                  {getSectorLabel()}
                </div>
                {client && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-50 border border-stone-100 text-stone-500 text-[10px] font-black uppercase tracking-widest">
                    <User size={12} className="text-stone-400" />
                    {client.name}
                  </div>
                )}
                {card.recurrence?.enabled && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest">
                    <RotateCcw size={12} className="animate-spin-slow" />
                    Notificação Recorrente
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                  className="p-3 bg-stone-50 hover:bg-stone-900 text-stone-400 hover:text-white rounded-2xl transition-all duration-300 group"
                  title="Editar Card"
                >
                  <Edit2 size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={async () => {
                    if (window.confirm('Tem certeza que deseja excluir este card?')) {
                      if ('commercialListId' in card) await deleteCommercialCard(card.id);
                      else if ('financialListId' in card) await deleteFinancialCard(card.id);
                      else if ('operationListId' in card) await deleteOperationCard(card.id);
                      else if ('internalTaskListId' in card) await deleteInternalTaskCard(card.id);
                      onClose();
                    }
                  }}
                  className="p-3 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all duration-300 group"
                  title="Excluir Card"
                >
                  <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={onClose}
                  className="p-3 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-2xl transition-all duration-300"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
              {/* Título */}
              <h1 className="text-3xl font-black text-stone-900 leading-tight mb-8">
                {title}
              </h1>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Coluna Principal: Notas e Checklist */}
                <div className="lg:col-span-3 space-y-8">
                  {/* Notas */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-stone-400 text-[11px] font-black uppercase tracking-[0.2em]">
                      <AlignLeft size={16} />
                      Anotações
                    </div>
                    <div className="bg-stone-50/50 rounded-3xl p-6 border border-stone-100 min-h-[120px]">
                      {card.notes ? (
                        <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">{card.notes}</p>
                      ) : (
                        <p className="text-stone-400 text-sm italic italic">Nenhuma anotação disponível.</p>
                      )}
                    </div>
                  </div>

                  {/* Checklist */}
                  {totalCount > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-stone-400 text-[11px] font-black uppercase tracking-[0.2em]">
                          <CheckSquare size={16} />
                          Checklist de Progresso
                        </div>
                        <div className="text-[11px] font-black text-stone-900 bg-stone-100 px-3 py-1 rounded-full border border-stone-200">
                          {completedCount}/{totalCount}
                        </div>
                      </div>
                      
                      {/* Barra de Progresso */}
                      <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200/50">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(completedCount / totalCount) * 100}%` }}
                          className={`h-full bg-gradient-to-r from-${sectorColor}-400 to-${sectorColor}-600`}
                        />
                      </div>

                      <div className="space-y-2">
                        {checklist.map((item) => (
                          <div 
                            key={item.id}
                            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${item.completed ? 'bg-green-50/30 border-green-100 text-green-700/60' : 'bg-white border-stone-100 text-stone-600 shadow-sm'}`}
                          >
                            <div className={`p-1 rounded-lg ${item.completed ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-300'}`}>
                              <CheckSquare size={14} />
                            </div>
                            <span className={`text-sm font-bold ${item.completed ? 'line-through opacity-70' : ''}`}>
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Lateral: Detalhes e Responsáveis */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Datas */}
                  <div className="bg-stone-50/30 rounded-3xl p-6 border border-stone-100 space-y-5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                    <div className="space-y-1.5 text-center px-2 py-3 rounded-2xl bg-white border border-stone-100 shadow-sm">
                      <div className="flex items-center justify-center gap-1.5 text-stone-400 text-[9px] font-black uppercase tracking-widest">
                        <Calendar size={12} />
                        Início
                      </div>
                      <div className="text-sm font-black text-stone-900">{formatDate(card.startDate)}</div>
                    </div>
                    
                    <div className="space-y-1.5 text-center px-2 py-3 rounded-2xl bg-white border border-stone-100 shadow-sm">
                      <div className="flex items-center justify-center gap-1.5 text-stone-400 text-[9px] font-black uppercase tracking-widest">
                        <Clock size={12} />
                        Entrega
                      </div>
                      <div className="text-sm font-black text-stone-900">{formatDate(card.deliveryDate)}</div>
                    </div>
                  </div>

                  {/* Responsáveis */}
                  <div className="space-y-4">
                    <div className="text-stone-400 text-[11px] font-black uppercase tracking-[0.2em] px-1">
                      Responsáveis
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {card.assignees && card.assignees.length > 0 ? (
                        card.assignees.map(userId => {
                          const u = users.find(user => user.id === userId);
                          if (!u) return null;
                          return (
                            <div key={userId} className="flex items-center gap-2 bg-white border border-stone-200 p-1.5 pr-4 rounded-2xl shadow-sm hover:border-stone-300 transition-all group">
                              <div className="w-8 h-8 rounded-xl border-2 border-stone-50 overflow-hidden bg-stone-100 group-hover:scale-105 transition-transform">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-black text-stone-400 uppercase">
                                    {u.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs font-black text-stone-700">{u.name}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs font-bold text-stone-400 italic px-1">Ninguém atribuído.</div>
                      )}
                    </div>
                  </div>

                  {/* Tags de Serviço (se for cliente) */}
                  {client?.serviceTags && client.serviceTags.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-stone-100">
                      <div className="text-stone-400 text-[11px] font-black uppercase tracking-[0.2em] px-1">
                        Serviços Contratados
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {client.serviceTags.map(tagId => {
                          const tag = tags.find(t => t.id === tagId);
                          if (!tag) return null;
                          return (
                            <span 
                              key={tag.id} 
                              className="text-[10px] font-black px-4 py-2 rounded-2xl shadow-sm border"
                              style={{ backgroundColor: `${tag.color}15`, color: tag.color, borderColor: `${tag.color}30` }}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 pt-4 bg-stone-50/50 border-t border-stone-100 flex justify-between items-center mt-auto">
              <div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                ID: {card.id.substring(0, 8)}
              </div>
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-stone-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 active:scale-95"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
