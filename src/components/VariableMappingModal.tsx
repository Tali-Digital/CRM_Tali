import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Search, Sparkles, Plus, Code, BookOpen, Layers } from 'lucide-react';
import { Prospect } from '../types';
import { DEFAULT_VARIABLE_TAGS, VariableTag } from '../services/mappingTagsService';
import Swal from 'sweetalert2';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedProspect?: Prospect | null;
  diagnosticData?: any;
  onSelectTag?: (tagCode: string) => void;
}

export const VariableMappingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedProspect,
  diagnosticData,
  onSelectTag
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<VariableTag[]>([]);

  // Form para nova variável customizada
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTagCode, setNewTagCode] = useState('');
  const [newTagDesc, setNewTagDesc] = useState('');
  const [newTagCategory, setNewTagCategory] = useState<VariableTag['category']>('Geral & Empresa');

  useEffect(() => {
    // Carregar variáveis customizadas salvas
    const saved = localStorage.getItem('custom_crm_variables');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCustomTags(parsed);
      } catch (e) {}
    }
  }, []);

  if (!isOpen) return null;

  const allTags = [
    ...DEFAULT_VARIABLE_TAGS,
    ...customTags.map(t => ({
      ...t,
      exampleValue: (p: any) => `[Personalizado: ${t.description}]`
    }))
  ];

  const categories = ['Todas', 'Geral & Empresa', 'Notas & Desempenho', 'SEO & Google Maps', 'Site & Rastreamento', 'Simulações & Anúncios', 'IA & Resumos'];

  const filteredTags = allTags.filter(t => {
    const matchesCategory = selectedCategory === 'Todas' || t.category === selectedCategory;
    const matchesSearch = t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);

    if (onSelectTag) {
      onSelectTag(code);
    }
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagCode.trim()) {
      Swal.fire('Atenção', 'Digite o código da variável (ex: {{VALOR_PROPOSTA}}).', 'warning');
      return;
    }

    let codeFormatted = newTagCode.trim();
    if (!codeFormatted.startsWith('{{')) codeFormatted = `{{${codeFormatted}`;
    if (!codeFormatted.endsWith('}}')) codeFormatted = `${codeFormatted}}`;
    codeFormatted = codeFormatted.toUpperCase().replace(/\s+/g, '_');

    const newTag: VariableTag = {
      code: codeFormatted,
      category: newTagCategory,
      description: newTagDesc.trim() || 'Variável personalizada',
      exampleValue: () => ''
    };

    const updated = [...customTags, newTag];
    setCustomTags(updated);
    localStorage.setItem('custom_crm_variables', JSON.stringify(updated));

    setNewTagCode('');
    setNewTagDesc('');
    setShowAddForm(false);

    Swal.fire('Sucesso!', `Nova variável ${codeFormatted} mapeada e pronta para uso!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div className="bg-[#0f111e] border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-[#16192b]">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                <Code size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Mapeamento de Variáveis & Tags das Cartas</h2>
                <p className="text-xs text-gray-400">Códigos dinâmicos para automatizar propostas, relatórios e cartas de vendas.</p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters & Search Header */}
        <div className="p-6 border-b border-gray-800/80 bg-[#121424] space-y-4">
          <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-3 text-gray-500" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tag (ex: {{NOME_DONO}})..."
                className="w-full bg-[#090a12] border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
              />
            </div>

            {/* Add Custom Tag Button */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shrink-0"
            >
              <Plus size={16} />
              Indicar Novo Mapeamento
            </button>
          </div>

          {/* Form para adicionar novo mapeamento */}
          {showAddForm && (
            <form onSubmit={handleAddCustomTag} className="bg-[#181b30] p-4 rounded-2xl border border-indigo-500/30 space-y-3 animate-fadeIn">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} /> Novo Mapeamento Customizado
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newTagCode}
                  onChange={(e) => setNewTagCode(e.target.value)}
                  placeholder="Nome da Tag (ex: VALOR_DESCONTO)"
                  className="bg-[#090a12] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
                <input
                  type="text"
                  value={newTagDesc}
                  onChange={(e) => setNewTagDesc(e.target.value)}
                  placeholder="Descrição do que esta variável representa"
                  className="bg-[#090a12] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <select
                  value={newTagCategory}
                  onChange={(e) => setNewTagCategory(e.target.value as any)}
                  className="bg-[#090a12] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  {categories.filter(c => c !== 'Todas').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold"
                >
                  Salvar Mapeamento
                </button>
              </div>
            </form>
          )}

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-[#181b30] text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body / Variable Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#0d0f19]">
          {filteredTags.map((tag, idx) => {
            const sampleVal = tag.exampleValue(selectedProspect, diagnosticData);
            const isCopied = copiedCode === tag.code;

            return (
              <div
                key={idx}
                className="bg-[#151829] hover:bg-[#1a1e33] border border-gray-800/80 hover:border-indigo-500/40 p-4 rounded-2xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-black text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-500/30 group-hover:border-indigo-500">
                      {tag.code}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
                      {tag.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 font-medium">{tag.description}</p>

                  {/* Live Sample Preview */}
                  <div className="text-xs bg-[#090a12] p-2.5 rounded-xl border border-gray-800 font-mono flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">Valor Exemplo:</span>
                    <span className="text-emerald-400 truncate">{sampleVal || '[Não preenchido nesta clínica]'}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(tag.code)}
                  className={`w-full md:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 ${
                    isCopied
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                      : 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30'
                  }`}
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  {isCopied ? 'Copiado!' : 'Copiar Tag'}
                </button>
              </div>
            );
          })}

          {filteredTags.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Layers size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-sm text-gray-400">Nenhum mapeamento encontrado para esta busca.</p>
              <p className="text-xs">Clique no botão "Indicar Novo Mapeamento" acima para cadastrar!</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#16192b] flex items-center justify-between text-xs text-gray-400">
          <span>Escreva as tags dentro do texto da proposta (ex: <code className="text-indigo-400 font-mono">{"{{NOME_CLINICA}}"}</code>).</span>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-xl font-bold transition-all"
          >
            Fechar Mapeamento
          </button>
        </div>

      </div>
    </div>
  );
};
