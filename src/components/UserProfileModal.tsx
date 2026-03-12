import React, { useState, useRef, useCallback } from 'react';
import { Modal } from './Modal';
import { auth } from '../firebase';
import { updateProfile, updatePassword } from 'firebase/auth';
import { saveUser } from '../services/firestoreService';
import { Camera, Lock, Check, X, MoveHorizontal } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/imageUtils';

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
  
  // Image Upload and Crop State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result as string);
        setIsEditing(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const handleApplyCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      setPhotoURL(croppedImage);
      setIsEditing(false);
      setImageSrc(null);
    } catch (e) {
      console.error(e);
      setMessage({ text: 'Erro ao processar imagem.', type: 'error' });
    }
  };

  const handleCancelCrop = () => {
    setIsEditing(false);
    setImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      {isEditing && imageSrc ? (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
          <div className="relative w-full max-w-md aspect-square bg-stone-900 rounded-2xl overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          
          <div className="w-full max-w-md mt-6 space-y-6">
            <div className="flex items-center gap-4 text-white">
              <MoveHorizontal size={20} className="text-stone-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1.5 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelCrop}
                className="flex-1 bg-white/10 text-white py-4 rounded-2xl hover:bg-white/20 transition-all font-bold flex items-center justify-center gap-2"
              >
                <X size={20} /> Cancelar
              </button>
              <button
                onClick={handleApplyCrop}
                className="flex-1 bg-white text-stone-900 py-4 rounded-2xl hover:bg-stone-100 transition-all font-bold flex items-center justify-center gap-2"
              >
                <Check size={20} /> Recortar e Salvar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {message.text && (
            <div className={`p-3 rounded-xl text-sm text-center font-bold ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
            
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden border-2 border-stone-200 group cursor-pointer hover:border-stone-400 transition-all"
            >
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
      )}
    </Modal>
  );
};
