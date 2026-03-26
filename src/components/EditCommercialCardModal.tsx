import React, { useState, useEffect } from 'react';
import { NotesEditor } from './NotesEditor';
import { CommercialCard, ChecklistItem, Client, UserProfile } from '../types';
import { updateCommercialCard, deleteCommercialCard, updateClient, subscribeToUsers } from '../services/firestoreService';
import { Modal } from './Modal';
import { Trash2, Plus, X, CheckSquare, FileText, User, Edit2, Users, Calendar, Briefcase, TrendingUp, Settings, RotateCcw, LayoutGrid } from 'lucide-react';
import { RecurrenceSelector } from './RecurrenceSelector';
import { RecurrenceSettings } from '../types';
import { Timestamp } from 'firebase/firestore';

interface EditCommercialCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CommercialCard | null;
  client?: Client;
  clients: Client[];
  users: UserProfile[];
  onMoveToSector?: (sectorId: string) => void;
}

export const EditCommercialCardModal: React.FC<EditCommercialCardModalProps> = ({ isOpen, onClose, card, client, clients, users, onMoveToSector }) => {
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');



  useEffect(() => {
    if (card) {
      setClientName(card.title || card.clientName || '');
      // Somente atualiza notes se não estivermos com o status 'saving' ou 'saved' recente para evitar sobrescrita durante digitação
      if (saveStatus === 'idle') {
        setNotes(card.notes || '');
      }
      setChecklist(card.type === 'client' ? (card.checklist || client?.checklist || []) : (card.checklist || []));
      setAssignedUserIds(card.assignees || []);
      setStartDate(card.startDate ? (card.startDate instanceof Timestamp ? card.startDate.toDate() : new Date(card.startDate)).toISOString().split('T')[0] : '');
      setDeliveryDate(card.deliveryDate ? (card.deliveryDate instanceof Timestamp ? card.deliveryDate.toDate() : new Date(card.deliveryDate)).toISOString().split('T')[0] : '');
      setSelectedClientId(card.clientId || '');
      setRecurrence(card.recurrence);
      setCardColor(card.color || '#ffffff');
    }
  }, [card, client]);

  // Autosave for notes
  useEffect(() => {
    if (!card || notes === (card.notes || '')) return;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateCommercialCard(card.id, { notes, updatedAt: new Date() });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        console.error('Falha no auto-salve:', err);
        setSaveStatus('idle');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [notes, card?.id]);


  if (!card) return null;

  const isCustom = card.type === 'custom';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await updateCommercialCard(card.id, {
        clientId: selectedClientId || '',
        title: isCustom ? clientName : null,
        notes,
        checklist,
        assignees: assignedUserIds,
        startDate: startDate ? new Date(startDate + 'T12:00:00') : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00') : null,
        updatedAt: new Date(),
        recurrence: recurrence || null,
        color: cardColor
      });

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
    if (window.confirm('Deseja mover este card para a lixeira? Você poderá recuperá-lo no gestor de cards.')) {
      try {
        await deleteCommercialCard(card.id);
        onClose();
      } catch (err) {
        console.error(err);
        alert('Erro ao mover card para lixeira. Verifique sua conexão ou permissões.');
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
    <Modal isOpen={isOpen} onClose={onClose} title={isCustom ? "Editar Card Personalizado" : "Editar Cliente no Setor"} maxWidth="max-w-6xl">
      <form onSubmit={handleSave} className="flex flex-col h-full">
        <div className="max-h-[70vh] overflow-y-auto px-1 -mx-1 custom-scrollbar space-y-6">
          {isCustom ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
                  <Edit2 size={14} />
                  Título do Card
                </label>
                <input 
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
                  <LayoutGrid size={14} />
                  Cor do Card
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Branco', value: '#ffffff' },
                    { name: 'Azul', value: '#bae6fd' },
                    { name: 'Verde', value: '#dcfce7' },
                    { name: 'Amarelo', value: '#fef9c3' },
                    { name: 'Laranja', value: '#ffedd5' },
                    { name: 'Roxo', value: '#f3e8ff' },
                    { name: 'Rosa', value: '#fce7f3' },
                    { name: 'Cinza', value: '#f1f5f9' },
                  ].map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCardColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${cardColor === c.value ? 'border-stone-900 scale-110' : 'border-stone-200 hover:scale-105'}`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-stone-100 rounded-2xl border border-stone-200">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">Cliente</label>
                <div className="flex items-center gap-2">
                  <User size={16} className="text-stone-400" />
                  <span className="font-bold text-stone-900">{client?.name || card.clientName || 'Cliente vinculado'}</span>
                </div>
                <p className="text-[10px] text-stone-500 mt-2 italic font-medium">Nome gerido pela central de clientes.</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
                  <LayoutGrid size={14} />
                  Cor do Card
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Branco', value: '#ffffff' },
                    { name: 'Azul', value: '#bae6fd' },
                    { name: 'Verde', value: '#dcfce7' },
                    { name: 'Amarelo', value: '#fef9c3' },
                    { name: 'Laranja', value: '#ffedd5' },
                    { name: 'Roxo', value: '#f3e8ff' },
                    { name: 'Rosa', value: '#fce7f3' },
                    { name: 'Cinza', value: '#f1f5f9' },
                  ].map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCardColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${cardColor === c.value ? 'border-stone-900 scale-110' : 'border-stone-200 hover:scale-105'}`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}


        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
                <Calendar size={14} />
                Data de Início
              </label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
                <Calendar size={14} />
                Data de Entrega
              </label>
              <input 
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              />
            </div>
          </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
            <User size={14} />
            Vincular Cliente Central
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
          >
            <option value="">Nenhum cliente vinculado (Card Personalizado)</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-stone-400">
            {selectedClientId 
              ? "Este card agora usa os dados do cliente central selecionado." 
              : "Transforme este card em um cliente central selecionando um acima."}
          </p>
        </div>

        <div className="space-y-6 pt-2 border-t border-stone-100">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
              <User size={14} className="text-stone-300" />
              Responsáveis (Administradores)
            </label>
            <div className="flex flex-wrap gap-2">
              {users.filter(u => u.role === 'admin').map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    assignedUserIds.includes(u.id)
                      ? 'bg-stone-900 border-stone-900 text-white shadow-lg shadow-stone-900/10'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:border-stone-300'
                  }`}
                >
                  <div className="w-5 h-5 rounded-lg overflow-hidden border border-stone-200/50">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-200 text-[8px] font-black">
                        {u.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">
              <Briefcase size={14} className="text-stone-300" />
              Delegado para (Equipe)
            </label>
            <div className="flex flex-wrap gap-2">
              {users.filter(u => u.role === 'equipe').map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    assignedUserIds.includes(u.id)
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/10'
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:border-stone-300'
                  }`}
                >
                  <div className="w-5 h-5 rounded-lg overflow-hidden border border-stone-200/50">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-200 text-[8px] font-black">
                        {u.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  {u.name}
                </button>
              ))}
              {users.filter(u => u.role === 'equipe').length === 0 && (
                <p className="text-[10px] text-stone-400 italic">Nenhum membro da equipe disponível.</p>
              )}
            </div>
          </div>
        </div>
        
        {onMoveToSector && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
              <Briefcase size={14} />
              Mover para outro Bloco
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onMoveToSector('integracao')}
                className="bg-stone-50 border border-stone-200 rounded-xl py-2 px-3 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors text-left flex items-center gap-2"
              >
                <TrendingUp size={14} className="text-stone-400" />
                Integração
              </button>
              <button
                type="button"
                onClick={() => onMoveToSector('operacao')}
                className="bg-stone-50 border border-stone-200 rounded-xl py-2 px-3 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors text-left flex items-center gap-2"
              >
                <Settings size={14} className="text-stone-400" />
                Operação
              </button>
              <button
                type="button"
                onClick={() => onMoveToSector('internal_tasks')}
                className="bg-stone-50 border border-stone-200 rounded-xl py-2 px-3 text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors text-left flex items-center gap-2"
              >
                <CheckSquare size={14} className="text-stone-400" />
                Tarefas Internas
              </button>
            </div>
          </div>
        )}

        <RecurrenceSelector 
          settings={recurrence} 
          onChange={setRecurrence} 
        />

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
            <FileText size={14} />
            Anotações
          </label>
          <NotesEditor 
            value={notes}
            onChange={setNotes}
            placeholder="Adicione informações importantes sobre o cliente..."
            status={saveStatus}
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
            <CheckSquare size={14} />
            Checklist
          </label>
          
          <div className="flex gap-2">
            <input 
              value={newChecklistItem}
              onChange={(e) => setNewChecklistItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addChecklistItem();
                }
              }}
              placeholder="Novo item do checklist..."
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
            <button 
              type="button"
              onClick={addChecklistItem}
              className="bg-stone-100 text-stone-600 p-2 rounded-xl hover:bg-stone-200 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-stone-50 border border-stone-200 p-2 rounded-xl group">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                      item.completed 
                        ? 'bg-stone-900 border-stone-900 text-white' 
                        : 'border-stone-300 hover:border-stone-400 bg-white'
                    }`}
                  >
                    {item.completed && <CheckSquare size={12} />}
                  </button>
                  <span className={`text-sm flex-1 ${item.completed ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                    {item.text}
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={() => removeChecklistItem(item.id)}
                  className="text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {checklist.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-2">Nenhum item no checklist.</p>
            )}
          </div>
        </div>

        </div>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100 flex-shrink-0">
          <button 
            type="button"
            onClick={handleDelete}
            className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold"
          >
            <Trash2 size={16} />
            Mover para Lixeira
          </button>
          
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-xl transition-colors text-sm font-bold"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="bg-stone-900 text-white px-6 py-2 rounded-xl hover:bg-stone-800 transition-colors text-sm font-bold disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
