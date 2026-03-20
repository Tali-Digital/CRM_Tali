import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Maximize2, 
  Edit2,
  Copy, 
  Trash2,
  X
} from 'lucide-react';

interface CardOptionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  onAction: (action: string) => void;
}

export const CardOptionsMenu: React.FC<CardOptionsMenuProps> = ({ 
  isOpen, 
  onClose, 
  anchorRect,
  onAction 
}) => {
  if (!isOpen || !anchorRect) return null;

  const menuActions = [
    { id: 'open', label: 'Abrir cartão', icon: <Maximize2 size={14} /> },
    { id: 'edit', label: 'Editar', icon: <Edit2 size={14} /> },
    { id: 'duplicate', label: 'Duplicar card', icon: <Copy size={14} /> },
    { id: 'archive', label: 'Excluir', icon: <Trash2 size={14} />, danger: true },
  ];

  const top = anchorRect.top;
  const left = anchorRect.left;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-start justify-start pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="fixed inset-0 bg-stone-900/5 pointer-events-auto backdrop-blur-[1px]" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }} 
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{ 
            position: 'fixed',
            top: Math.max(10, Math.min(top, window.innerHeight - 250)),
            left: Math.max(10, Math.min(left + anchorRect.width + 10, window.innerWidth - 200)),
          }}
          className="w-52 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-stone-200 p-1.5 pointer-events-auto overflow-hidden z-[101]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 mb-1 border-b border-stone-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Opções do Card</span>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-stone-100 rounded-lg text-stone-400 transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            {menuActions.map((action) => (
              <button
                key={action.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAction(action.id);
                  onClose();
                }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm font-bold rounded-xl transition-all group ${
                  action.danger 
                    ? 'text-red-500 hover:bg-red-50' 
                    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                }`}
              >
                <span className={`${action.danger ? 'text-red-400' : 'text-stone-400 group-hover:text-stone-700'} transition-colors`}>
                  {action.icon}
                </span>
                {action.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
