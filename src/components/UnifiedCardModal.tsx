import React, { useState, useEffect } from 'react';
import { NotesEditor } from './NotesEditor';
import { ChecklistItem, Client, UserProfile, RecurrenceSettings, Sector } from '../types';
import { motion } from 'motion/react';
import { 
  updateCommercialCard, deleteCommercialCard, 
  updateFinancialCard, deleteFinancialCard, 
  updateOperationCard, deleteOperationCard, 
  updateInternalTaskCard, deleteInternalTaskCard, 
  updateClient,
  updateDynamicCard, deleteDynamicCard
} from '../services/firestoreService';
import { Modal } from './Modal';
import { 
  Trash2, Plus, X, CheckSquare, FileText, User, Edit2, 
  Calendar, Briefcase, TrendingUp, Settings, LayoutGrid, DollarSign, Clock, Tag as TagIcon
} from 'lucide-react';
import { RecurrenceSelector } from './RecurrenceSelector';
import { Timestamp } from 'firebase/firestore';

export type CardSector = 'commercial' | 'financial' | 'operation' | 'internal_tasks' | string;

interface UnifiedCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: any | null; // Generic card
  sector: CardSector;
  client?: Client;
  clients: Client[];
  users: UserProfile[];
  onMoveToSector?: (sectorId: string) => void;
  allSectors?: Sector[];
}

export const UnifiedCardModal: React.FC<UnifiedCardModalProps> = ({ 
  isOpen, onClose, card, sector, client, clients, users, onMoveToSector, allSectors = [] 
}) => {
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceSettings | undefined>(undefined);
  const [cardColor, setCardColor] = useState('#ffffff');
  const [activeTab, setActiveTab] = useState<'geral' | 'avancado'>('geral');
  const [price, setPrice] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [statusTags, setStatusTags] = useState<string[]>([]);

  // Carga inicial e reset ao trocar de card
  useEffect(() => {
    if (card) {
      setNotes(card.notes || '');
      setSaveStatus('idle');
      setClientName(card.title || card.clientName || '');
      setChecklist(card.type === 'client' ? (card.checklist || client?.checklist || []) : (card.checklist || []));
      setAssignedUserIds(card.assignees || []);
      setStartDate(card.startDate ? (card.startDate instanceof Timestamp ? card.startDate.toDate() : new Date(card.startDate)).toISOString().split('T')[0] : '');
      setDeliveryDate(card.deliveryDate ? (card.deliveryDate instanceof Timestamp ? card.deliveryDate.toDate() : new Date(card.deliveryDate)).toISOString().split('T')[0] : '');
      setSelectedClientId(card.clientId || '');
      setRecurrence(card.recurrence);
      setCardColor(card.color || '#ffffff');
      setPrice(card.price ? card.price.toString() : '');
      setStatusTags(card.statusTags || []);
      setActiveTab('geral');
    }
  }, [card?.id, sector]);

  // Sincronização em segundo plano - apenas se não houver alterações locais pendentes
  useEffect(() => {
    if (card && saveStatus === 'idle' && card.notes !== undefined && card.notes !== notes) {
      setNotes(card.notes);
    }
  }, [card?.notes, saveStatus]);

  // Autosave for notes
  useEffect(() => {
    if (!card || !isOpen || notes === (card.notes || '')) {
      if (saveStatus !== 'saving' && saveStatus !== 'saved') setSaveStatus('idle');
      return;
    }

    const currentCardId = card.id;
    const currentSector = sector;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const data = { notes, updatedAt: new Date() };
        await updateCardService(currentCardId, data, currentSector);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        console.error('Falha no auto-salve:', err);
        setSaveStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [notes, card?.id, sector, isOpen]);

  const updateCardService = async (id: string, data: any, targetSector: CardSector) => {
    switch (targetSector) {
      case 'comercial':
      case 'commercial': return updateCommercialCard(id, data);
      case 'integracao':
      case 'financial': return updateFinancialCard(id, data);
      case 'operacao':
      case 'operation': return updateOperationCard(id, data);
      case 'internal_tasks':
      case 'internal': return updateInternalTaskCard(id, data);
      default: return updateDynamicCard(id, data);
    }
  };

  const deleteCardService = async (id: string, targetSector: CardSector) => {
    switch (targetSector) {
      case 'comercial':
      case 'commercial': return deleteCommercialCard(id);
      case 'integracao':
      case 'financial': return deleteFinancialCard(id);
      case 'operacao':
      case 'operation': return deleteOperationCard(id);
      case 'internal_tasks':
      case 'internal': return deleteInternalTaskCard(id);
      default: return deleteDynamicCard(id);
    }
  };

  if (!card) return null;

  const isCustom = card.type === 'custom';

  const handleInternalClose = async () => {
    // Garantir que as notas sejam salvas se mudaram
    if (card && notes !== (card.notes || '')) {
      try {
        await updateCardService(card.id, { notes, updatedAt: new Date() }, sector);
      } catch (err) {
        console.error('Erro ao salvar notas ao fechar:', err);
      }
    }
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const cardData: any = {
        clientId: selectedClientId || '',
        title: isCustom ? clientName : null,
        notes,
        checklist,
        assignees: assignedUserIds,
        startDate: startDate ? new Date(startDate + 'T12:00:00') : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00') : null,
        updatedAt: new Date(),
        recurrence: recurrence || null,
        color: cardColor,
        statusTags: statusTags
      };

      if (sector === 'internal_tasks' || !['commercial', 'financial', 'operation', 'internal_tasks'].includes(sector)) {
        cardData.price = price ? parseFloat(price) : null;
      }

      await updateCardService(card.id, cardData, sector);

      if (card.type === 'client' && selectedClientId) {
        await updateClient(selectedClientId, { checklist });
      }

      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar card.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleUser = (userId: string) => {
    setAssignedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleDelete = async () => {
    const msg = sector === 'internal_tasks' 
      ? 'Deseja mover esta tarefa para a lixeira?' 
      : 'Deseja mover este cliente para a lixeira?';
      
    if (window.confirm(`${msg} Você poderá recuperá-lo no gestor de cards.`)) {
      try {
        await deleteCardService(card.id, sector);
        onClose();
      } catch (err) {
        console.error(err);
        alert('Erro ao mover para lixeira.');
      }
    }
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklist([
        ...checklist,
        {
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          text: newChecklistItem.trim(),
          completed: false
        }
      ]);
      setNewChecklistItem('');
    }
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(checklist.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleInternalClose} 
      title={isCustom ? (sector === 'internal_tasks' ? 'Editar Tarefa' : 'Editar Card') : 'Editar Cliente'}
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSave} className="flex flex-col h-[75vh]">
        <div className="flex items-center gap-2 mb-6 sm:mb-8 border-b border-stone-100 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'geral' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <div className="flex items-center gap-2">
              <LayoutGrid size={14} />
              Informações Gerais
            </div>
            {activeTab === 'geral' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900 rounded-full" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('avancado')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative ${activeTab === 'avancado' ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}
          >
            <div className="flex items-center gap-2">
              <Settings size={14} />
              Configurações
            </div>
            {activeTab === 'avancado' && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900 rounded-full" />}
          </button>

          <div className="ml-auto flex items-center gap-3">
            {saveStatus === 'saving' && <span className="text-[10px] font-bold text-stone-400 uppercase animate-pulse">Salvando...</span>}
            {saveStatus === 'saved' && <span className="text-[10px] font-bold text-green-500 uppercase">Salvo!</span>}
            <button 
              type="button" 
              onClick={handleDelete}
              className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
              title="Mover para lixeira"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {activeTab === 'geral' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
              <div className="lg:col-span-8 space-y-8">
                {/* Título / Cliente */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1">
                     {isCustom ? "Título do Card" : "Nome do Cliente"}
                  </label>
                  <input 
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-[2rem] px-6 py-4 text-xl font-black text-stone-900 focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all"
                    placeholder="Digite o título..."
                  />
                </div>

                {/* Tags de Status */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                    <TagIcon size={12} /> Status do Trabalho
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setStatusTags(prev => prev.includes('aguardando equipe') ? [] : ['aguardando equipe'])}
                      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${statusTags.includes('aguardando equipe') ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105' : 'bg-stone-50 border-stone-200 text-stone-400 hover:border-blue-300 hover:text-blue-500'}`}
                    >
                      Aguardando Equipe
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusTags(prev => prev.includes('em aprovação') ? [] : ['em aprovação'])}
                      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${statusTags.includes('em aprovação') ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20 scale-105' : 'bg-stone-50 border-stone-200 text-stone-400 hover:border-green-300 hover:text-green-500'}`}
                    >
                      Em Aprovação
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusTags(prev => prev.includes('aguardando cliente') ? [] : ['aguardando cliente'])}
                      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${statusTags.includes('aguardando cliente') ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105' : 'bg-stone-50 border-stone-200 text-stone-400 hover:border-orange-300 hover:text-orange-500'}`}
                    >
                      Aguardando Cliente
                    </button>
                  </div>
                </div>

                {/* Datas e Preço */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                      <Calendar size={12} /> Data de Início
                    </label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-stone-900/5"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                      <Clock size={12} /> Data de Entrega
                    </label>
                    <input 
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all"
                    />
                  </div>
                  {(sector === 'internal_tasks' || !['commercial', 'financial', 'operation', 'internal_tasks'].includes(sector)) && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                        <DollarSign size={12} /> Preço
                      </label>
                      <input 
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all"
                        placeholder="0,00"
                      />
                    </div>
                  )}
                </div>

                {/* Notas */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                    <FileText size={12} /> Anotações
                  </label>
                  <div className="bg-stone-50 border border-stone-200 rounded-[2rem] overflow-hidden min-h-[300px]">
                    <NotesEditor 
                      value={notes} 
                      onChange={setNotes} 
                      placeholder="Comece a escrever suas notas aqui..."
                      status={saveStatus}
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-8">
                {/* Checklist */}
                <div className="space-y-4 bg-stone-50 rounded-[2.5rem] p-6 border border-stone-200">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 flex items-center gap-2">
                      <CheckSquare size={12} /> Checklist
                    </label>
                    <span className="text-[10px] font-black text-stone-300">
                      {checklist.filter(i => i.completed).length}/{checklist.length}
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar px-1">
                    {checklist.map(item => (
                      <div key={item.id} className="group flex items-center gap-3 bg-white p-3 rounded-2xl border border-stone-100 shadow-sm hover:border-stone-200 transition-all">
                        <button
                          type="button"
                          onClick={() => toggleChecklistItem(item.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-green-500 border-green-500 text-white' : 'border-stone-200 hover:border-stone-400'}`}
                        >
                          {item.completed && <CheckSquare size={14} />}
                        </button>
                        <span className={`text-xs font-bold flex-1 ${item.completed ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                          {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-300 hover:text-red-500 transition-all"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="relative pt-2">
                    <input 
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                      className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 pr-12 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all"
                      placeholder="Adicionar item..."
                    />
                    <button
                      type="button"
                      onClick={addChecklistItem}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Responsáveis */}
                <div className="space-y-4 bg-stone-50 rounded-[2.5rem] p-6 border border-stone-200">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-2 flex items-center gap-2">
                    <User size={12} /> Atribuir Membros
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {users.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUser(u.id)}
                        className={`flex items-center gap-2 p-2 rounded-2xl border transition-all text-left ${assignedUserIds.includes(u.id) ? 'bg-stone-900 border-stone-900 text-white shadow-lg' : 'bg-white border-stone-100 text-stone-600 hover:border-stone-300'}`}
                      >
                        <div className="w-8 h-8 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase">
                              {u.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-black truncate">{u.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10 pb-10">
              {/* Opções Avançadas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                       Cor do Card
                    </label>
                    <div className="flex flex-wrap gap-3 p-6 bg-stone-50 rounded-[2rem] border border-stone-200">
                      {['#ffffff', '#f8fafc', '#f1f5f9', '#fecaca', '#fed7aa', '#fef08a', '#dcfce7', '#d1fae5', '#dbeafe', '#e0e7ff', '#f3e8ff', '#fae8ff'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCardColor(c)}
                          className={`w-10 h-10 rounded-xl border-2 transition-all ${cardColor === c ? 'border-stone-900 scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <input 
                        type="color" 
                        value={cardColor} 
                        onChange={(e) => setCardColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-none"
                      />
                    </div>
                  </div>

                  {isCustom && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                         Cliente Vinculado (Opcional)
                      </label>
                      <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all"
                      >
                        <option value="">Nenhum cliente</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 px-1 flex items-center gap-2">
                     Recorrência & Notificações
                  </label>
                  <div className="p-6 bg-stone-50 rounded-[2rem] border border-stone-200">
                    <RecurrenceSelector 
                      value={recurrence || { enabled: false, period: 'daily', interval: 1 }} 
                      onChange={setRecurrence} 
                    />
                  </div>
                </div>
              </div>            </div>
          )}
        </div>

        <div className="flex gap-3 pt-6 border-t border-stone-100">
          <button 
            type="button" 
            onClick={handleInternalClose}
            className="flex-1 py-4 rounded-2xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-all"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            disabled={isSaving}
            className="flex-[2] bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold shadow-xl shadow-stone-900/20 disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
