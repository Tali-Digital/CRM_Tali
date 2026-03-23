import React, { useState, useEffect } from 'react';
import { CommercialList, FinancialList, OperationList, UserProfile } from '../types';
import { Modal } from './Modal';
import { Trash2, Plus, X, AlertTriangle, Users } from 'lucide-react';
import { subscribeToUsers, createNotification } from '../services/firestoreService';
import { auth } from '../firebase';

interface ListSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  list: CommercialList | FinancialList | OperationList;
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const ListSettingsModal: React.FC<ListSettingsModalProps> = ({ isOpen, onClose, list, onUpdate, onDelete }) => {
  const [name, setName] = useState(list.name);
  const [checklist, setChecklist] = useState<string[]>(list.defaultChecklist || []);
  const [assignees, setAssignees] = useState<string[]>(list.assignees || []);
  const [newItemText, setNewItemText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [color, setColor] = useState(list.color || '#1c222d');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const colorPresets = [
    '#1c222d', // Dark Blue (Original)
    '#1c2d2d', // Dark Teal
    '#251c2d', // Dark Purple
    '#2d1c1c', // Dark Red
    '#1c2d20', // Dark Green
    '#2d291c', // Dark Brown
    '#1c262d', // Dark Slate
  ];

  useEffect(() => {
    if (isOpen) {
      const unsubscribe = subscribeToUsers(setUsers);
      return () => unsubscribe();
    }
  }, [isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onUpdate(list.id, {
      name,
      defaultChecklist: checklist,
      assignees,
      color
    });

    const newAssignees = assignees.filter(id => !(list.assignees || []).includes(id));
    for (const assigneeId of newAssignees) {
      if (assigneeId !== auth.currentUser?.uid) {
        await createNotification({
          userId: assigneeId,
          title: 'Novo Setor Atribuído',
          message: `Atribuído ao setor: ${name}`,
          read: false,
          type: 'system'
        });
      }
    }

    setIsSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await onDelete(list.id);
      onClose();
    } catch (error) {
      console.error("Erro ao excluir setor:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const addChecklistItem = () => {
    if (newItemText.trim()) {
      setChecklist([...checklist, newItemText.trim()]);
      setNewItemText('');
    }
  };

  const removeChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Setor">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Nome do Setor</label>
          <input 
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
          />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Cor do Setor</label>
          <div className="flex flex-wrap gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200/50">
            {colorPresets.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setColor(preset)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${color === preset ? 'border-stone-900 scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: preset }}
                title={preset}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-full border-0 p-0 overflow-hidden cursor-pointer"
              />
              <span className="text-[10px] font-mono text-stone-500 uppercase">{color}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Users size={14} />
              Responsáveis pelo Setor
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {users.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  if (assignees.includes(user.id)) {
                    setAssignees(assignees.filter(id => id !== user.id));
                  } else {
                    setAssignees([...assignees, user.id]);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                  assignees.includes(user.id)
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center text-[8px]">
                    {user.name.charAt(0)}
                  </div>
                )}
                {user.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Checklist Padrão</label>
            <span className="text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
              Aplicado a novos cards
            </span>
          </div>
          
          <div className="flex gap-2">
            <input 
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
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
            {checklist.map((item, index) => (
              <div key={index} className="flex items-center justify-between bg-stone-50 border border-stone-200 p-2 rounded-xl group">
                <span className="text-sm text-stone-700">{item}</span>
                <button 
                  type="button"
                  onClick={() => removeChecklistItem(index)}
                  className="text-stone-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {checklist.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-2">Nenhum item padrão configurado.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          {!showConfirmDelete ? (
            <button 
              type="button"
              onClick={() => setShowConfirmDelete(true)}
              className="text-red-500 hover:bg-red-50 p-2 rounded-xl transition-colors flex items-center gap-2 text-sm font-bold"
            >
              <Trash2 size={16} />
              Excluir Setor
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-red-50 p-2 rounded-xl border border-red-100 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="flex items-center gap-2 text-red-600 text-[10px] font-bold uppercase tracking-wider">
                <AlertTriangle size={14} />
                Tem certeza?
              </div>
              <div className="flex gap-1">
                <button 
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="bg-red-500 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Sim, Excluir
                </button>
                <button 
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="bg-white text-stone-500 px-3 py-1 rounded-lg text-[10px] font-bold border border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  Não
                </button>
              </div>
            </div>
          )}
          
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
