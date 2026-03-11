import React, { useState } from 'react';
import { Modal } from './Modal';
import { auth } from '../firebase';
import { updateProfile, updatePassword } from 'firebase/auth';
import { saveUser } from '../services/firestoreService';
import { Camera, Lock } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, user }) => {
  const [name, setName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ text: '', type: '' });

    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name,
          photoURL: photoURL
        });

        if (newPassword) {
          await updatePassword(auth.currentUser, newPassword);
        }

        await saveUser(auth.currentUser);
        setMessage({ text: 'Perfil atualizado com sucesso!', type: 'success' });
        setTimeout(() => onClose(), 2000);
      }
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error);
      setMessage({ text: 'Erro ao atualizar perfil. Tente novamente.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Meu Perfil">
      <form onSubmit={handleSave} className="space-y-6">
        {message.text && (
          <div className={`p-3 rounded-xl text-sm text-center font-bold ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden border-2 border-stone-200 group">
            {photoURL ? (
              <img src={photoURL} alt="Perfil" className="w-full h-full object-cover" />
            ) : (
              <Camera size={32} className="text-stone-400" />
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={24} className="text-white" />
            </div>
          </div>
          <div className="w-full space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400">URL da Foto</label>
            <input 
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://exemplo.com/foto.jpg"
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Nome</label>
          <input 
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Nova Senha (opcional)</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Deixe em branco para não alterar"
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={isSaving}
          className="w-full bg-stone-900 text-white py-4 rounded-2xl hover:bg-stone-800 transition-all font-bold disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </form>
    </Modal>
  );
};
