import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Type, Palette, List, ListOrdered } from 'lucide-react';

interface NotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({ value, onChange, placeholder, minHeight = '150px' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Synchronize internal value with editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  return (
    <div className={`flex flex-col transition-all duration-300 rounded-3xl overflow-hidden border-2 ${
      isFocused ? 'border-stone-900 bg-white' : 'border-stone-200 bg-stone-50 hover:border-stone-300'
    }`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-stone-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <button 
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
          className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-600"
          title="Negrito"
        >
          <Bold size={16} strokeWidth={2.5} />
        </button>
        <button 
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
          className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-600"
          title="Itálico"
        >
          <Italic size={16} strokeWidth={2.5} />
        </button>
        
        <div className="w-px h-4 bg-stone-200 mx-1" />
        
        {/* Font Size Selector */}
        <div className="flex items-center gap-1">
          {[
            { size: '2', label: 'P', title: 'Pequeno' },
            { size: '3', label: 'M', title: 'Médio' },
            { size: '5', label: 'G', title: 'Grande' }
          ].map((item) => (
            <button
              key={item.size}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCommand('fontSize', item.size); }}
              className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded-xl transition-colors text-stone-600 text-[10px] font-black"
              title={item.title}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-stone-200 mx-1" />

        {/* Color Palette */}
        <div className="flex items-center gap-1">
          {[
            { color: '#0C1122', title: 'Preto' },
            { color: '#5271FF', title: 'Azul' },
            { color: '#059669', title: 'Verde' },
            { color: '#DC2626', title: 'Vermelho' },
          ].map((c) => (
            <button
              key={c.color}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCommand('foreColor', c.color); }}
              className="w-5 h-5 rounded-full border border-stone-200 transition-transform hover:scale-125"
              style={{ backgroundColor: c.color }}
              title={c.title}
            />
          ))}
        </div>

        <div className="w-px h-4 bg-stone-200 mx-1" />

        <button 
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }}
          className="p-2 hover:bg-stone-100 rounded-xl transition-colors text-stone-600"
          title="Lista"
        >
          <List size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Editable Area */}
      <div className="relative flex-1 flex flex-col min-h-0">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="p-6 text-sm text-stone-800 focus:outline-none custom-scrollbar overflow-y-auto whitespace-pre-wrap leading-relaxed rich-text-content"
          style={{ minHeight }}
          spellCheck={false}
        />
        {!value && (
          <div className="absolute top-6 left-6 text-stone-400 text-sm italic pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
};
