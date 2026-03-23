import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Notification as AppNotification } from '../types';
import { subscribeToNotifications, markNotificationAsRead, clearAllNotifications } from '../services/firestoreService';
import { Bell, Check, X, RotateCcw, ExternalLink, Trash2, CheckCircle2, Maximize2 } from 'lucide-react';
import { playNotificationSound } from '../utils/audio';

interface NotificationCenterProps {
  userId: string;
  onJumpToCard?: (cardId: string, sector: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId, onJumpToCard }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const prevNotificationsCount = useRef(0);
  const hasLoadedInitial = useRef(false);

  useEffect(() => {
    if (userId) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }

      const unsubscribe = subscribeToNotifications(userId, (newNotifs) => {
        if (hasLoadedInitial.current && newNotifs.length > prevNotificationsCount.current) {
          playNotificationSound();
          
          const latest = newNotifs[0];
          if (latest && !latest.read && 'Notification' in window && Notification.permission === 'granted') {
            const showNotification = async () => {
              if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                (registration as any).showNotification(latest.title, {
                  body: latest.message,
                  icon: '/favicon.png',
                  badge: '/favicon.png',
                  vibrate: [100, 50, 100],
                  data: {
                    link: (latest.cardId && latest.sector) ? `/?jumpTo=${latest.cardId}&sector=${latest.sector}` : '/'
                  }
                });
              } else {
                new Notification(latest.title, {
                  body: latest.message,
                  icon: '/favicon.png'
                });
              }
            };
            showNotification();
          }
        }
        prevNotificationsCount.current = newNotifs.length;
        setNotifications(newNotifs);
        hasLoadedInitial.current = true;
      });
      return () => unsubscribe();
    }
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
  };
  
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (window.confirm('Deseja realmente limpar todas as notificações? Esta ação é permanente.')) {
      await clearAllNotifications(userId);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-stone-400 hover:text-stone-900 transition-colors p-2 rounded-full hover:bg-stone-100"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-stone-50"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-[-80px] md:right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-stone-900">Notificações</h3>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  playNotificationSound();
                }}
                className="text-stone-300 hover:text-stone-900 transition-colors"
                title="Testar som de notificação"
              >
                <Bell size={12} />
              </button>
            </div>
            {notifications.length > 0 && (
              <button 
                onClick={handleClearAll}
                className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-red-500 transition-colors flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200"
              >
                <Trash2 size={10} />
                Limpar
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-stone-500 text-sm">
                Nenhuma notificação.
              </div>
            ) : (
                notifications.map(notification => {
                  const isRecurrence = notification.type === 'recurrence' || notification.title.toLowerCase().includes('lembrete recorrente');
                  const cleanTitle = notification.title.replace(/^Lembrete Recorrente: /i, '');
                  
                  return (
                    <NotificationItem 
                      key={notification.id}
                      notification={notification}
                      cleanTitle={cleanTitle}
                      isRecurrence={isRecurrence}
                      onJumpToCard={onJumpToCard}
                      onMarkAsRead={handleMarkAsRead}
                      onCloseMenu={() => setIsOpen(false)}
                    />
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: AppNotification;
  cleanTitle: string;
  isRecurrence: boolean;
  onJumpToCard?: (cardId: string, sector: string) => void;
  onMarkAsRead: (id: string) => void;
  onCloseMenu: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, cleanTitle, isRecurrence, onJumpToCard, onMarkAsRead, onCloseMenu }) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 150], [1, 0]);
  
  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onMarkAsRead(notification.id);
    }
    // Snap back
    x.set(0);
  };

  const handleCardClick = () => {
    if (notification.cardId && notification.sector) {
      onJumpToCard?.(notification.cardId, notification.sector);
      onMarkAsRead(notification.id);
      onCloseMenu();
    }
  };

  return (
    <div className="relative overflow-hidden group">

      <div 
        onClick={handleCardClick}
        className={`p-4 border-b border-stone-50 hover:bg-stone-50 transition-colors relative z-10 cursor-pointer ${!notification.read ? 'bg-[#f0f7ff]' : 'bg-white'}`}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1.5">
              <h4 className={`text-[13px] leading-tight flex-1 min-w-0 break-words ${!notification.read ? 'font-black text-stone-900' : 'font-bold text-stone-700'}`}>
                {cleanTitle}
              </h4>
            </div>
            <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed mb-3">{notification.message}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded-md">
                  {notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                </span>
                {isRecurrence && (
                  <RotateCcw size={10} className="text-stone-400" strokeWidth={3} />
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-2">
              {notification.cardId && notification.sector && (
                <div className="text-stone-300 hover:text-stone-900 p-1.5 rounded-full hover:bg-stone-50 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                  <Maximize2 size={16} strokeWidth={3} />
                </div>
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!notification.read) {
                    onMarkAsRead(notification.id);
                  }
                }}
                className={`p-1.5 rounded-full transition-all flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 border border-transparent ${
                  notification.read 
                    ? 'text-green-500 bg-green-50/50' 
                    : 'text-stone-300 hover:text-green-600 hover:bg-green-50 hover:border-green-100'
                }`}
                title="Concluir Notificação"
              >
                <CheckCircle2 size={18} strokeWidth={notification.read ? 2 : 3} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
