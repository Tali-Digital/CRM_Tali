import React, { useState, useEffect, useRef } from 'react';
import { Notification as AppNotification } from '../types';
import { subscribeToNotifications, markNotificationAsRead } from '../services/firestoreService';
import { Bell, Check, X, RotateCcw, ExternalLink } from 'lucide-react';
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
            new Notification(latest.title, {
              body: latest.message,
              icon: '/logo192.png'
            });
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
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-lg border border-stone-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
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
            {unreadCount > 0 && (
              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount} novas
              </span>
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
                    <div 
                      key={notification.id} 
                      className={`p-4 border-b border-stone-50 hover:bg-stone-50 transition-colors group relative ${!notification.read ? 'bg-blue-50/20' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2 mb-1.5">
                            <h4 className={`text-[13px] leading-tight flex-1 min-w-0 break-words ${!notification.read ? 'font-black text-stone-900' : 'font-bold text-stone-700'}`}>
                              {cleanTitle}
                            </h4>
                            {isRecurrence && (
                              <span className="shrink-0 bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border border-amber-200/50 shadow-sm flex items-center gap-1">
                                <RotateCcw size={8} strokeWidth={3} />
                                Recorrente
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed mb-3">{notification.message}</p>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded-md">
                              {notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Agora'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {notification.cardId && notification.sector && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onJumpToCard?.(notification.cardId!, notification.sector!);
                                handleMarkAsRead(notification.id);
                                setIsOpen(false);
                              }}
                              className="text-stone-300 hover:text-stone-900 p-1.5 rounded-full hover:bg-stone-50 transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-stone-100"
                              title="Ir para o card"
                            >
                              <ExternalLink size={14} strokeWidth={3} />
                            </button>
                          )}
                          {!notification.read && (
                            <button 
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="text-stone-300 hover:text-green-600 p-1.5 rounded-full hover:bg-green-50 transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-green-100"
                              title="Marcar como lida"
                            >
                              <Check size={14} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
