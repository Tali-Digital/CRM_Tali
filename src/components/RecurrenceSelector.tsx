import React from 'react';
import { RecurrencePeriod, RecurrenceSettings } from '../types';
import { Calendar, Clock, RotateCcw, ChevronDown } from 'lucide-react';

interface RecurrenceSelectorProps {
  settings?: RecurrenceSettings;
  onChange: (settings: RecurrenceSettings) => void;
}

const DAYS = [
  { label: 'D', value: 0 },
  { label: 'S', value: 1 },
  { label: 'T', value: 2 },
  { label: 'Q', value: 3 },
  { label: 'Q', value: 4 },
  { label: 'S', value: 5 },
  { label: 'S', value: 6 },
];

export const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({ settings, onChange }) => {
  const enabled = settings?.enabled || false;
  const period = settings?.period || 'daily';
  const interval = settings?.interval || 1;
  const daysOfWeek = settings?.daysOfWeek || [];

  const handleToggle = () => {
    onChange({
      enabled: !enabled,
      period: period,
      interval: interval,
      daysOfWeek: daysOfWeek,
    });
  };

  const updateSettings = (updates: Partial<RecurrenceSettings>) => {
    onChange({
      enabled,
      period,
      interval,
      daysOfWeek,
      ...updates,
    });
  };

  const toggleDay = (day: number) => {
    const newDays = daysOfWeek.includes(day)
      ? daysOfWeek.filter((d) => d !== day)
      : [...daysOfWeek, day].sort();
    updateSettings({ daysOfWeek: newDays });
  };

  return (
    <div className="space-y-4 p-4 bg-stone-50 rounded-2xl border border-stone-200 mt-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400">
          <RotateCcw size={14} />
          Habilitar Notificação Recorrente
        </label>
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? 'bg-stone-900' : 'bg-stone-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-stone-600">Repetição a cada</span>
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2">
              <input
                type="number"
                min="1"
                value={interval}
                onChange={(e) => updateSettings({ interval: parseInt(e.target.value) || 1 })}
                className="w-8 text-sm font-bold text-stone-900 focus:outline-none"
              />
              <div className="h-4 w-px bg-stone-200"></div>
              <select
                value={period}
                onChange={(e) => updateSettings({ period: e.target.value as RecurrencePeriod })}
                className="text-sm font-bold text-stone-900 focus:outline-none bg-transparent cursor-pointer pr-1"
              >
                <option value="daily">dia{interval > 1 ? 's' : ''}</option>
                <option value="weekly">semana{interval > 1 ? 's' : ''}</option>
                <option value="monthly">mês{interval > 1 ? 'es' : ''}</option>
                <option value="yearly">ano{interval > 1 ? 's' : ''}</option>
              </select>
            </div>
          </div>

          {period === 'weekly' && (
            <div className="flex items-center gap-2">
              {DAYS.map((day, idx) => {
                const isSelected = daysOfWeek.includes(day.value);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                        : 'bg-stone-100 border-stone-100 text-stone-400 hover:bg-stone-200'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-stone-400 font-medium">
            <Clock size={12} />
            As notificações serão enviadas às 06:00 AM para os membros atribuídos.
          </div>
        </div>
      )}
    </div>
  );
};
