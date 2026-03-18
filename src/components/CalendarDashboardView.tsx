
import React, { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Clock } from 'lucide-react';
import { Client, Tag, UserProfile } from '../types';

interface CalendarDashboardViewProps {
  allCards: any[];
  clients: Client[];
  tags: Tag[];
  users: UserProfile[];
  onCardClick: (card: any, sector: string) => void;
}

export const CalendarDashboardView: React.FC<CalendarDashboardViewProps> = ({
  allCards,
  clients,
  tags,
  users,
  onCardClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: Date, cards: any[] } | null>(null);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });

  const numDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= numDays; i++) {
    days.push(new Date(year, month, i));
  }

  const allEvents = useMemo(() => {
    const events: any[] = [];
    const calendarStart = new Date(year, month, 1);
    const calendarEnd = new Date(year, month + 1, 0);

    allCards.forEach(card => {
      // Base date for the original card: delivery date, start date, or creation date
      const baseDateObj = card.deliveryDate || card.startDate || card.createdAt;
      if (!baseDateObj) return;
      
      let baseDate: Date;
      if (baseDateObj instanceof Timestamp) {
        baseDate = baseDateObj.toDate();
      } else if (typeof baseDateObj === 'string') {
        baseDate = new Date(baseDateObj);
      } else if (baseDateObj instanceof Date) {
        baseDate = baseDateObj;
      } else if (baseDateObj && typeof baseDateObj === 'object' && 'seconds' in baseDateObj) {
        // Handle cases where it might be a plain object representing a Timestamp but not an instance
        baseDate = new Date(baseDateObj.seconds * 1000);
      } else {
        baseDate = new Date(); // Final fallback
      }
      
      baseDate.setHours(0, 0, 0, 0);
      
      // Add the original card as an event
      events.push({ ...card, eventDate: baseDate });

      // Generate recurrences if enabled
      if (card.recurrence?.enabled) {
        const { period, interval = 1, daysOfWeek = [], dayOfMonth, monthOfYear } = card.recurrence;
        const startDate = new Date(baseDate);
        
        // Final date: defined delivery date OR 6 months from start
        let finalDate: Date;
        let isCapped = false;
        if (card.deliveryDate) {
          finalDate = card.deliveryDate instanceof Timestamp ? card.deliveryDate.toDate() : new Date(card.deliveryDate);
        } else {
          finalDate = new Date(startDate);
          finalDate.setMonth(finalDate.getMonth() + 6);
          isCapped = true;
        }

        let nextDate = new Date(startDate);
        // Step forward from the day after the start date
        const nextOccurrence = (d: Date) => {
          const res = new Date(d);
          if (period === 'daily') res.setDate(res.getDate() + interval);
          else if (period === 'weekly') res.setDate(res.getDate() + (7 * interval));
          else if (period === 'monthly') res.setMonth(res.getMonth() + interval);
          else if (period === 'yearly') res.setFullYear(res.getFullYear() + interval);
          return res;
        };

        nextDate = nextOccurrence(nextDate);
        
        while (nextDate <= finalDate) {
          // If we are about to hit/pass final date and it's capped, mark with warning
          const isLastCappedDay = isCapped && (nextOccurrence(nextDate) > finalDate);
          
          events.push({
            ...card,
            eventDate: new Date(nextDate),
            isRecurrence: true,
            title: isLastCappedDay ? `[FIM RECORRÊNCIA] ${card.title || 'Tarefa'}` : card.title
          });
          
          nextDate = nextOccurrence(nextDate);
          // Safety break to prevent infinite loops
          if (events.length > 5000) break; 
        }
      }
    });

    return events;
  }, [allCards, year, month]);

  const getCardsForDate = (date: Date) => {
    return allEvents.filter(event => {
      const d = event.eventDate;
      return d.getDate() === date.getDate() &&
             d.getMonth() === date.getMonth() &&
             d.getFullYear() === date.getFullYear();
    });
  };

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="flex flex-col bg-white rounded-3xl border border-stone-200 shadow-sm">
      <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-900 text-white rounded-xl">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-stone-900 capitalize">{monthName} {year}</h2>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Calendário de Prazos</p>
          </div>
        </div>
        <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-stone-50 text-stone-600 rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={() => setCurrentDate(new Date())} 
            className="px-4 py-2 text-xs font-black uppercase tracking-widest text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
          >
            Hoje
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-stone-50 text-stone-600 rounded-lg transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-7 border-b border-stone-100 bg-stone-50/30">
          {dayNames.map(day => (
            <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-stone-400 border-r border-stone-100 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,auto)] min-h-0">
          {days.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="bg-stone-50/20 border-b border-r border-stone-100" />;
            
            const cards = getCardsForDate(date);
            const isToday = new Date().toDateString() === date.toDateString();

            return (
              <div key={date.toISOString()} className={`p-2 border-b border-r border-stone-100 min-h-[120px] transition-colors hover:bg-stone-50/50 ${isToday ? 'bg-stone-50/30' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`flex items-center justify-center w-7 h-7 text-xs font-black rounded-full ${isToday ? 'bg-stone-900 text-white shadow-md' : 'text-stone-400'}`}>
                    {date.getDate()}
                  </span>
                  {cards.length > 0 && (
                    <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-md border border-stone-200/50">
                      {cards.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {cards.slice(0, 4).map(card => {
                    const client = clients.find(c => c.id === card.clientId);
                    const isEventOverdue = (() => {
                      if (!card.deliveryDate) return false; // Only highlight red if there's an actual delivery date
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const ed = new Date(card.eventDate);
                      ed.setHours(0, 0, 0, 0);
                      return ed <= today;
                    })();

                    const getLuminance = (hexColor: string) => {
                      const hex = hexColor.replace('#', '');
                      const r = parseInt(hex.substring(0, 2), 16) || 0;
                      const g = parseInt(hex.substring(2, 4), 16) || 0;
                      const b = parseInt(hex.substring(4, 6), 16) || 0;
                      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                    };

                    const eventBgColor = isEventOverdue ? '#991b1b' : (card.color || '');
                    const isDarkBg = isEventOverdue || (card.color && getLuminance(card.color) < 0.6);
                    
                    const eventStyle = eventBgColor ? {
                      backgroundColor: eventBgColor,
                      color: isDarkBg ? 'white' : 'inherit',
                      borderColor: isEventOverdue ? '#7f1d1d' : (isDarkBg ? 'transparent' : '#e5e7eb')
                    } : {};

                    const sectorColor = !eventBgColor ? (
                      card.sector === 'comercial' ? 'border-amber-200 bg-amber-50 text-amber-900' :
                      card.sector === 'integracao' ? 'border-blue-200 bg-blue-50 text-blue-900' :
                      card.sector === 'operacao' ? 'border-green-200 bg-green-50 text-green-900' :
                      'border-stone-200 bg-stone-50 text-stone-900'
                    ) : '';

                    return (
                      <div 
                        key={card.id + '-' + card.eventDate.getTime()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCardClick(card, card.sector);
                        }}
                        style={eventStyle}
                        className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold truncate cursor-pointer hover:shadow-sm transition-all shadow-inner ${sectorColor}`}
                      >
                        {card.title || client?.name || 'Sem título'}
                      </div>
                    );
                  })}
                  {cards.length > 4 && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDay({ date, cards });
                      }}
                      className="text-[10px] font-black text-stone-400 hover:text-stone-900 cursor-pointer pt-1 uppercase tracking-tighter transition-colors"
                    >
                      + {cards.length - 4} outros
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Expansão do Dia */}
      {selectedDay && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-stone-100">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-stone-900 text-white rounded-xl">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-stone-900 capitalize">
                    {selectedDay.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{selectedDay.cards.length} tarefas para este dia</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400 hover:text-stone-900"
              >
                <ChevronLeft className="rotate-180" size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {selectedDay.cards.map(card => {
                const client = clients.find(c => c.id === card.clientId);
                const sectorColor = 
                  card.sector === 'comercial' ? 'border-amber-200 bg-amber-50 text-amber-900' :
                  card.sector === 'integracao' ? 'border-blue-200 bg-blue-50 text-blue-900' :
                  card.sector === 'operacao' ? 'border-green-200 bg-green-50 text-green-900' :
                  'border-stone-200 bg-stone-50 text-stone-900';

                return (
                  <div 
                    key={card.id}
                    onClick={() => {
                      onCardClick(card, card.sector);
                      setSelectedDay(null);
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer hover:shadow-lg transition-all group flex items-start justify-between gap-4 ${sectorColor} shadow-sm`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{card.sector}</span>
                        {client && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-current opacity-30"></span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{client.name}</span>
                          </>
                        )}
                      </div>
                      <h4 className="font-extrabold text-sm leading-tight truncate">{card.title || client?.name || 'Sem título'}</h4>
                    </div>
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
