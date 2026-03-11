import React, { useState, useEffect } from 'react';
import { CommercialCard, ChecklistItem, Client, UserProfile } from '../types';
import { updateCommercialCard, deleteCommercialCard, updateClient, subscribeToUsers } from '../services/firestoreService';
import { Modal } from './Modal';
import { Trash2, Plus, X, CheckSquare, FileText, User, Edit2, Users, Calendar } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface EditCommercialCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CommercialCard | null;
  client?: Client;
  clients: Client[];
}

export const EditCommercialCardModal: React.FC<EditCommercialCardModalProps> = ({ isOpen, onClose, card, client, clients }) => {
  const [clientName, setClientName] = useState('');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToUsers(setUsers);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (client) {
      setClientName(client.name);
      setNotes(client.notes || '');
      setChecklist(client.checklist || []);
      setAssignedUserIds(card?.assignees || []);
      setStartDate(card?.startDate ? (card.startDate instanceof Timestamp ? card.startDate.toDate() : new Date(card.startDate)).toISOString().split('T')[0] : '');
      setDeliveryDate(card?.deliveryDate ? (card.deliveryDate instanceof Timestamp ? card.deliveryDate.toDate() : new Date(card.deliveryDate)).toISOString().split('T')[0] : '');
      setSelectedClientId(card?.clientId || '');
    } else if (card) {
      setClientName(card.type === 'custom' ? (card.title || '') : (card.clientName || ''));
      setNotes(card.notes || '');
      setChecklist(card.checklist || []);
      setAssignedUserIds(card.assignees || []);
      setStartDate(card.startDate ? (card.startDate instanceof Timestamp ? card.startDate.toDate() : new Date(card.startDate)).toISOString().split('T')[0] : '');
      setDeliveryDate(card.deliveryDate ? (card.deliveryDate instanceof Timestamp ? card.deliveryDate.toDate() : new Date(card.deliveryDate)).toISOString().split('T')[0] : '');
      setSelectedClientId(card.clientId || '');
    }
  }, [card, client]);

  if (!card) return null;

  const isCustom = card.type === 'custom';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    if (client || selectedClientId) {
      const finalClientId = client?.id || selectedClientId;
      const finalClient = clients.find(c => c.id === finalClientId);
      
      if (finalClient && !client) {
         // Newly linking a client - update card to client type
         await updateCommercialCard(card.id, {
           clientId: finalClientId,
           type: 'client',
           title: '',
           assignees: assignedUserIds,
           startDate: startDate ? new Date(startDate + 'T12:00:00') : null,
           deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00') : null,
           updatedAt: new Date()
         });
      } else if (finalClient && client) {
        await updateClient(finalClient.id, {
          name: clientName,
          notes,
          checklist
        });
        await updateCommercialCard(card.id, {
          assignees: assignedUserIds,
          startDate: startDate ? new Date(startDate + 'T12:00:00') : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00') : null,
          updatedAt: new Date()
        });
      }
    } else {
      await updateCommercialCard(card.id, {
        ...(isCustom ? { title: clientName } : { clientName }),
        notes,
        checklist,
        assignees: assignedUserIds,
        startDate: startDate ? new Date(startDate + 'T12:00:00') : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate + 'T12:00:00') : null,
        updatedAt: new Date()
      });
    }
    
    setIsSaving(false);
    onClose();
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
    <Modal isOpen={isOpen} onClose={onClose} title={isCustom ? "Editar Card Personalizado" : "Editar Cliente no Setor"}>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
            {isCustom ? <Edit2 size={14} /> : <User size={14} />}
            {isCustom ? "Título do Card" : "Nome do Cliente"}
          </label>
          <input 
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            disabled={!!client} // Disable if it's a central client, they should edit in the Clients tab
          />
          {client && <p className="text-xs text-stone-400">Para alterar o nome, acesse a aba Clientes.</p>}
        </div>

        {!client && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
              <Users size={14} />
              Vincular Cliente Central
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            >
              <option value="">Nenhum cliente central vinculado</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-stone-400">Ao vincular, este card passará a usar os dados do cliente central.</p>
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
            <Users size={14} />
            Responsáveis
          </label>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleUser(u.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  assignedUserIds.includes(u.id)
                    ? 'bg-stone-900 border-stone-900 text-white'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.name} className="w-4 h-4 rounded-full" />
                ) : (
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${assignedUserIds.includes(u.id) ? 'bg-stone-700' : 'bg-stone-200'}`}>
                    {u.name.charAt(0)}
                  </div>
                )}
                {u.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
            <FileText size={14} />
            Anotações
          </label>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none custom-scrollbar"
            placeholder="Adicione informações importantes sobre o cliente..."
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

          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
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

        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
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
