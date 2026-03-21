import React, { useState, useEffect, useRef } from 'react';
import { Notification } from '../types';
import { subscribeToNotifications, markNotificationAsRead } from '../services/firestoreService';
import { Bell, Check, X } from 'lucide-react';
import { playNotificationSound } from '../utils/audio';

interface NotificationCenterProps {
  userId: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const prevNotificationsCount = useRef(0);
  const hasLoadedInitial = useRef(false);

  useEffect(() => {
    if (userId) {
      const unsubscribe = subscribeToNotifications(userId, (newNotifs) => {
        if (hasLoadedInitial.current && newNotifs.length > prevNotificationsCount.current) {
          playNotificationSound();
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
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`p-4 border-b border-stone-50 hover:bg-stone-50 transition-colors group ${!notification.read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <h4 className={`text-sm ${!notification.read ? 'font-bold text-stone-900' : 'font-medium text-stone-700'}`}>
                        {notification.title}
                      </h4>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">{notification.message}</p>
                      <span className="text-[10px] text-stone-400 mt-2 block">
                        {notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleString() : 'Agora'}
                      </span>
                    </div>
                    {!notification.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="text-stone-400 hover:text-green-500 p-1 rounded-full hover:bg-green-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Marcar como lida"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
