import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, CheckSquare, Calendar, User, AlignLeft, Clock, RotateCcw, Trash2, Check, CheckCircle2 } from 'lucide-react';
import { 
  deleteCommercialCard, 
  deleteFinancialCard, 
  deleteOperationCard, 
  deleteInternalTaskCard,
  updateCommercialCard,
  updateFinancialCard,
  updateOperationCard,
  updateInternalTaskCard
} from '../services/firestoreService';
import { Timestamp } from 'firebase/firestore';
import { CommercialCard, FinancialCard, OperationCard, InternalTaskCard, Client, UserProfile, Tag, ChecklistItem } from '../types';

const isLightColor = (color: string) => {
  if (!color) return true;
  if (!color.startsWith('#')) return true;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return true;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155; // Slightly higher threshold for better contrast
};

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

const getNextRecurrenceDate = (recurrence: any) => {
  if (!recurrence || !recurrence.enabled) return null;
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  let startDate = recurrence.lastTriggeredDate ? new Date(recurrence.lastTriggeredDate) : new Date();
  startDate.setHours(0, 0, 0, 0);

  if (recurrence.lastTriggeredDate) {
    startDate.setDate(startDate.getDate() + 1);
  }

  if (recurrence.period === 'daily') {
    return startDate;
  }

  if (recurrence.period === 'weekly' && recurrence.daysOfWeek?.length) {
    let nextDate = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      if (recurrence.daysOfWeek.includes(nextDate.getDay())) {
        return nextDate;
      }
      nextDate.setDate(nextDate.getDate() + 1);
    }
  }

  if (recurrence.period === 'monthly' && recurrence.dayOfMonth) {
    let nextDate = new Date(startDate.getFullYear(), startDate.getMonth(), recurrence.dayOfMonth);
    if (nextDate < startDate) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    return nextDate;
  }

  if (recurrence.period === 'yearly' && recurrence.monthOfYear && recurrence.dayOfMonth) {
    let nextDate = new Date(startDate.getFullYear(), recurrence.monthOfYear - 1, recurrence.dayOfMonth);
    if (nextDate < startDate) {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
    return nextDate;
  }

  return null;
};

const getDateProximity = (date: any) => {
  if (!date) return 'normal';
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const checkDate = new Date(d);
  checkDate.setHours(0, 0, 0, 0);

  const diffTime = checkDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'overdue';
  if (diffDays <= 3) return 'near';
  return 'normal';
};

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
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localNotes, setLocalNotes] = useState('');
  const [localTitle, setLocalTitle] = useState('');
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (card) {
      setLocalNotes(card.notes || '');
      setLocalTitle(card.type === 'client' && client ? client.name : (card.title || (card as any).clientName || ''));
      setLocalChecklist(card.checklist || client?.checklist || []);
    }
  }, [card, client]);

  if (!card) return null;

  const checklist = localChecklist;
  const completedCount = checklist.filter(i => i.completed).length;
  const totalCount = checklist.length;
  
  const formatDate = (date: any) => {
    if (!date) return 'Não definida';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const syncUpdate = async (data: any) => {
    try {
      if (sector === 'commercial') await updateCommercialCard(card.id, data);
      else if (sector === 'financial') await updateFinancialCard(card.id, data);
      else if (sector === 'operation') await updateOperationCard(card.id, data);
      else if (sector === 'internal') await updateInternalTaskCard(card.id, data);
    } catch (err) {
      console.error('Erro ao atualizar card:', err);
    }
  };

  const toggleCheckItem = async (itemId: string) => {
    const updated = localChecklist.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setLocalChecklist(updated);
    await syncUpdate({ checklist: updated });
  };

  const handleNotesBlur = async () => {
    setIsEditingNotes(false);
    if (localNotes !== card.notes) {
      await syncUpdate({ notes: localNotes });
    }
  };

  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    if (card.type !== 'client' && localTitle !== (card.title || '')) {
      await syncUpdate({ title: localTitle });
    }
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
            className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
          >
            {/* Header com Gradiente Sutil */}
            <div className={`h-2 bg-gradient-to-r from-${sectorColor}-500 to-${sectorColor}-700 shadow-sm`} />
            
            <div className="flex items-center justify-between p-8 pb-4">
              <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 rounded-full bg-stone-100 border border-stone-300 text-stone-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
                  {getSectorLabel()}
                </div>
                {client && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
                    <User size={12} className="text-blue-500" />
                    {client.name}
                  </div>
                )}
                {card.recurrence?.enabled && (
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-black uppercase tracking-widest shadow-sm">
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
                  className="p-3 bg-stone-100 hover:bg-stone-900 text-stone-500 hover:text-white rounded-2xl transition-all duration-300 group shadow-sm border border-stone-200"
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
                  className="p-3 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all duration-300 group shadow-sm border border-red-100"
                  title="Excluir Card"
                >
                  <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={onClose}
                  className="p-3 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-2xl transition-all duration-300 ml-2"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
              {/* Título Editável */}
              {isEditingTitle && card.type !== 'client' ? (
                <input 
                  autoFocus
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
                  className="text-3xl font-black text-stone-900 leading-tight mb-8 w-full bg-transparent border-b-2 border-stone-200 focus:outline-none focus:border-stone-900 pb-1"
                />
              ) : (
                <h1 
                  onClick={() => card.type !== 'client' && setIsEditingTitle(true)}
                  className={`text-3xl font-black text-stone-900 leading-tight mb-8 ${card.type !== 'client' ? 'cursor-text hover:text-stone-600 transition-colors' : ''}`}
                >
                  {localTitle}
                </h1>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                {/* Coluna Principal: Notas e Checklist */}
                <div className="lg:col-span-3 space-y-8">
                  {/* Notas Editáveis */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-stone-600 text-[11px] font-black uppercase tracking-[0.2em]">
                      <AlignLeft size={16} className="text-stone-400" />
                      Anotações
                    </div>
                    <div 
                      onClick={() => setIsEditingNotes(true)}
                      className={`bg-stone-50 rounded-3xl p-6 border-2 transition-all min-h-[120px] shadow-sm ${isEditingNotes ? 'border-stone-900 bg-white' : 'border-stone-200 hover:border-stone-300 cursor-text'}`}
                    >
                      {isEditingNotes ? (
                        <textarea 
                          autoFocus
                          value={localNotes}
                          onChange={(e) => setLocalNotes(e.target.value)}
                          onBlur={handleNotesBlur}
                          className="w-full bg-transparent border-none focus:ring-0 text-stone-800 text-sm leading-relaxed whitespace-pre-wrap resize-none p-0"
                          rows={6}
                        />
                      ) : localNotes ? (
                        <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">{localNotes}</p>
                      ) : (
                        <p className="text-stone-400 text-sm italic">Nenhuma anotação disponível. Clique para adicionar.</p>
                      )}
                    </div>
                  </div>

                  {/* Checklist Interativo */}
                  {totalCount > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-stone-600 text-[11px] font-black uppercase tracking-[0.2em]">
                          <CheckSquare size={16} className="text-stone-400" />
                          Checklist de Progresso
                        </div>
                        <div className="text-[11px] font-black text-stone-900 bg-stone-200 px-3 py-1 rounded-full border border-stone-300 shadow-sm">
                          {completedCount}/{totalCount}
                        </div>
                      </div>
                      
                      {/* Barra de Progresso */}
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200 shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(completedCount / totalCount) * 100}%` }}
                          className={`h-full bg-gradient-to-r from-${sectorColor}-600 to-${sectorColor}-800 shadow-xl`}
                        />
                      </div>

                      <div className="space-y-2.5">
                        {checklist.map((item) => (
                          <button 
                            key={item.id}
                            onClick={() => toggleCheckItem(item.id)}
                            className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group ${item.completed ? 'bg-green-50/50 border-green-200 text-green-800/60' : 'bg-white border-stone-100 text-stone-700 shadow-md hover:border-stone-200 active:scale-[0.98]'}`}
                          >
                            <div className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${item.completed ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200'}`}>
                              {item.completed ? <Check size={16} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-stone-300" />}
                            </div>
                            <span className={`text-sm font-bold flex-1 ${item.completed ? 'line-through opacity-70' : ''}`}>
                              {item.text}
                            </span>
                            {!item.completed && (
                              <CheckCircle2 size={16} className="text-stone-200 opacity-0 group-hover:opacity-100 transition-all" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna Lateral: Detalhes e Responsáveis */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Datas */}
                  <div className="bg-stone-100/50 rounded-3xl p-6 border border-stone-200 space-y-5 shadow-sm">
                    <div className="space-y-1.5 text-center px-2 py-3 rounded-2xl bg-white border border-stone-200 shadow-sm">
                      <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[9px] font-black uppercase tracking-widest">
                        <Calendar size={12} className="text-stone-400" />
                        Início
                      </div>
                      <div className="text-sm font-black text-stone-900">{formatDate(card.startDate)}</div>
                    </div>
                    
                    <div className="space-y-1.5 text-center px-2 py-3 rounded-2xl bg-white border border-stone-200 shadow-sm">
                      <div className="flex items-center justify-center gap-1.5 text-stone-500 text-[9px] font-black uppercase tracking-widest">
                        <Clock size={12} className="text-stone-400" />
                        Entrega
                      </div>
                      {(() => {
                        const proximity = getDateProximity(card.deliveryDate);
                        const colorClass = proximity === 'overdue' ? 'text-red-600 bg-red-50/30' : proximity === 'near' ? 'text-orange-600 bg-orange-50/30' : 'text-stone-900';
                        return (
                          <div className={`text-sm font-black rounded-lg py-0.5 ${colorClass}`}>{formatDate(card.deliveryDate)}</div>
                        );
                      })()}
                    </div>

                    {card.recurrence?.enabled && (() => {
                      const nextRec = getNextRecurrenceDate(card.recurrence);
                      if (!nextRec) return null;
                      const proximity = getDateProximity(nextRec);
                      const colorClass = proximity === 'overdue' ? 'text-red-700 font-black' : proximity === 'near' ? 'text-orange-700 font-black' : 'text-stone-900 font-black';
                      return (
                        <div className="space-y-1.5 text-center px-2 py-3 rounded-2xl bg-orange-50 border border-orange-200 shadow-sm animate-in fade-in duration-500">
                          <div className="flex items-center justify-center gap-1.5 text-orange-600 text-[9px] font-black uppercase tracking-widest">
                            <RotateCcw size={12} className={proximity === 'near' || proximity === 'overdue' ? 'animate-spin-slow' : ''} />
                            Recorrência
                          </div>
                          <div className={`text-sm ${colorClass}`}>{formatDate(nextRec)}</div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Responsáveis */}
                  <div className="space-y-4">
                    <div className="text-stone-500 text-[11px] font-black uppercase tracking-[0.2em] px-1">
                      Responsáveis
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {card.assignees && card.assignees.length > 0 ? (
                        card.assignees.map(userId => {
                          const u = users.find(user => user.id === userId);
                          if (!u) return null;
                          return (
                            <div key={userId} className="flex items-center gap-2 bg-white border border-stone-200 p-1.5 pr-4 rounded-2xl shadow-sm hover:border-stone-400 transition-all group">
                              <div className="w-8 h-8 rounded-xl border-2 border-stone-100 overflow-hidden bg-stone-100 group-hover:scale-105 transition-transform shadow-sm">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-black text-stone-500 uppercase">
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
                    <div className="space-y-4 pt-4 border-t border-stone-200">
                      <div className="text-stone-500 text-[11px] font-black uppercase tracking-[0.2em] px-1">
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
                              style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
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
            <div className="p-8 pt-4 bg-stone-100/50 border-t border-stone-200 flex justify-between items-center mt-auto">
              <div className="text-[10px] text-stone-500 font-black uppercase tracking-widest bg-white px-3 py-1 rounded-lg border border-stone-200 shadow-sm">
                ID: {card.id.substring(0, 8)}
              </div>
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-stone-900 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-stone-800 transition-all shadow-lg hover:shadow-stone-900/20 active:scale-95 flex items-center gap-2"
              >
                <Check size={16} strokeWidth={3} />
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
