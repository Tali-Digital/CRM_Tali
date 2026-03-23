import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { LogOut, User, Settings, Users, Key, Layers, Calendar as CalendarIcon, Smartphone } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { UserManagementModal } from './UserManagementModal';
import { UserProfileModal } from './UserProfileModal';

interface UserMenuProps {
  user: any;
  userProfile?: UserProfile;
  onOpenCardManager: () => void;
  onOpenProfile: () => void;
  onOpenManagement: () => void;
  onGoogleSync: () => void;
  deferredPrompt?: any;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, userProfile, onOpenCardManager, onOpenProfile, onOpenManagement, onGoogleSync, deferredPrompt }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const roleLabels = {
    admin: 'Administrador',
    client: 'Cliente',
    outsourced: 'Terceirizado'
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center text-stone-600 border border-stone-300 overflow-hidden hover:ring-2 hover:ring-stone-400 transition-all"
      >
        {(userProfile?.photoURL || user.photoURL) ? <img src={userProfile?.photoURL || user.photoURL} alt="User" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <User size={20} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-stone-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-stone-100">
            <p className="text-sm font-bold text-stone-900 truncate">{userProfile?.name || user.displayName || 'Usuário'}</p>
            <p className="text-xs text-stone-500 truncate">{user.email}</p>
            {userProfile?.role && (
              <span className="inline-block mt-1 bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {roleLabels[userProfile.role]}
              </span>
            )}
          </div>

          <div className="py-2">
            <button 
              onClick={() => { onOpenProfile(); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
            >
              <Settings size={16} className="text-stone-400" />
              Meu Perfil
            </button>

            <button 
              onClick={() => { onOpenCardManager(); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
            >
              <Layers size={16} className="text-stone-400" />
              Gestor de Cards
            </button>
            
            {userProfile?.role === 'admin' && (
              <button 
                onClick={() => { onOpenManagement(); setIsOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
              >
                <Users size={16} className="text-stone-400" />
                Gerenciar Usuários
              </button>
            )}

            <button 
              onClick={() => { onGoogleSync(); setIsOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
            >
              <CalendarIcon size={16} className="text-stone-400" />
              Sincronizar Google Agenda
            </button>

            {deferredPrompt && (
              <button 
                onClick={async () => {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  console.log(`User response to the install prompt: ${outcome}`);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
              >
                <Smartphone size={16} className="text-stone-400" />
                Baixar App Android
              </button>
            )}
          </div>

          <div className="border-t border-stone-100 py-2">
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
