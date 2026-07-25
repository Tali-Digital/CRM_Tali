import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Search, Sparkles, Plus, Code, Layers, Trash2 } from 'lucide-react';
import { Prospect } from '../types';
import { DEFAULT_VARIABLE_TAGS, VariableTag } from '../services/mappingTagsService';
import Swal from 'sweetalert2';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedProspect?: Prospect | null;
  diagnosticData?: any;
  onSelectTag?: (tagCode: string) => void;
  initialSelectedText?: string;
}

// Preset mapping data sources available in the CRM
const MAPPING_SOURCE_PRESETS = [
  { id: 'clinicName', label: 'Nome da Clínica / Empresa', category: 'Geral & Empresa', defaultCode: 'NOME_CLINICA_NOVO', desc: 'Nome oficial da clínica prospectada' },
  { id: 'ownerName', label: 'Nome do Proprietário / Dono', category: 'Geral & Empresa', defaultCode: 'NOME_DONO_NOVO', desc: 'Nome do proprietário ou sócio' },
  { id: 'cnpj', label: 'CNPJ da Clínica', category: 'Geral & Empresa', defaultCode: 'CNPJ_CLINICA', desc: 'Número do CNPJ formatado' },
  { id: 'location', label: 'Cidade / Região', category: 'Geral & Empresa', defaultCode: 'CIDADE_REGIAO', desc: 'Cidade ou município da clínica' },
  { id: 'fullAddress', label: 'Endereço Completo', category: 'Geral & Empresa', defaultCode: 'ENDERECO_COMPLETO', desc: 'Endereço completo da unidade' },
  { id: 'clinicInstagram', label: 'Instagram da Clínica', category: 'Geral & Empresa', defaultCode: 'INSTAGRAM_CLINICA', desc: 'Handle ou link do Instagram' },
  { id: 'site', label: 'Website / Landing Page', category: 'Geral & Empresa', defaultCode: 'WEBSITE_CLINICA', desc: 'URL oficial do site' },
  { id: 'termoPesquisado', label: 'Termo Pesquisado (ex: "dentista")', category: 'SEO & Google Maps', defaultCode: 'TERMO_PESQUISADO_NOVO', desc: 'Palavra-chave pesquisada na região' },
  { id: 'nomesConcorrentes', label: 'Nomes dos Concorrentes Diretos', category: 'SEO & Google Maps', defaultCode: 'NOMES_CONCORRENTES_TEXTO', desc: 'Lista de nomes dos concorrentes à frente' },
  { id: 'posicaoGeral', label: 'Posição no Ranking Geral (ex: 7ª posição)', category: 'SEO & Google Maps', defaultCode: 'POSICAO_GERAL_MAPA', desc: 'Posição da clínica nas buscas locais' },
  { id: 'pontosPresenca', label: 'Pontos do Mapa com Presença (ex: 19 pontos)', category: 'SEO & Google Maps', defaultCode: 'PONTOS_PRESENCA_MAPA', desc: 'Total de pontos com presença no mapa' },
  { id: 'percentResultados', label: 'Porcentagem dos Resultados (ex: 38,78%)', category: 'SEO & Google Maps', defaultCode: 'PERCENTUAL_RESULTADOS', desc: 'Participação do SoLV nos resultados' },
  { id: 'posicaoForaTop20', label: 'Indicador de Posição 20+', category: 'SEO & Google Maps', defaultCode: 'FORA_TOP20', desc: 'Indicador de áreas invisíveis no mapa' },
  { id: 'notaGeral', label: 'Nota Geral do Diagnóstico (0-100)', category: 'Notas & Desempenho', defaultCode: 'NOTA_GERAL_DIAG', desc: 'Pontuação geral de presença digital' },
  { id: 'gmnRating', label: 'Nota Estrelas no Google (★)', category: 'Notas & Desempenho', defaultCode: 'ESTRELAS_GOOGLE', desc: 'Classificação de estrelas no Google' },
  { id: 'gmnReviewsCount', label: 'Quantidade de Avaliações Google', category: 'Notas & Desempenho', defaultCode: 'QTD_AVALIACOES', desc: 'Número total de avaliações' },
  { id: 'scoreGoogle', label: 'Pilar Google (0-100)', category: 'Notas & Desempenho', defaultCode: 'SCORE_PILAR_GOOGLE', desc: 'Pontuação do pilar Google Meu Negócio' },
  { id: 'scoreReputacao', label: 'Pilar Reputação (0-100)', category: 'Notas & Desempenho', defaultCode: 'SCORE_PILAR_REPUTACAO', desc: 'Pontuação do pilar Reputação' },
  { id: 'scoreInstagram', label: 'Pilar Instagram (0-100)', category: 'Notas & Desempenho', defaultCode: 'SCORE_PILAR_INSTAGRAM', desc: 'Pontuação do pilar Instagram' },
  { id: 'scoreSite', label: 'Pilar Site (0-100)', category: 'Notas & Desempenho', defaultCode: 'SCORE_PILAR_SITE', desc: 'Pontuação do pilar Site & Desempenho' },
  { id: 'scoreAds', label: 'Pilar Ads (0-100)', category: 'Notas & Desempenho', defaultCode: 'SCORE_PILAR_ADS', desc: 'Pontuação do pilar Anúncios' },
  { id: 'velocidade', label: 'Velocidade Mobile PageSpeed (0-100)', category: 'Site & Rastreamento', defaultCode: 'VELOCIDADE_MOBILE', desc: 'Nota de velocidade oficial do Google' },
  { id: 'seo', label: 'SEO Técnico PageSpeed (0-100)', category: 'Site & Rastreamento', defaultCode: 'SEO_TECNICO', desc: 'Nota técnica de SEO do site' },
  { id: 'dinheiroConservador', label: 'Faturamento Perdido Conservador', category: 'Simulações & Anúncios', defaultCode: 'RECEITA_PERDIDA_CONS', desc: 'Projeção mensal do cenário conservador' },
  { id: 'dinheiroModerado', label: 'Faturamento Perdido Moderado', category: 'Simulações & Anúncios', defaultCode: 'RECEITA_PERDIDA_MOD', desc: 'Projeção mensal do cenário moderado' },
  { id: 'dinheiroAgressivo', label: 'Faturamento Perdido Agressivo', category: 'Simulações & Anúncios', defaultCode: 'RECEITA_PERDIDA_AGR', desc: 'Projeção mensal do cenário agressivo' },
  { id: 'planoAcao', label: 'Plano de Ação de 30 Dias (IA)', category: 'IA & Resumos', defaultCode: 'PLANO_ACAO_30DIAS', desc: 'Passos prioritários gerados por IA' },
  { id: 'resumoIA', label: 'Resumo Executivo da IA', category: 'IA & Resumos', defaultCode: 'RESUMO_EXECUTIVO_IA', desc: 'Pontos-chave do diagnóstico' },
  { id: 'customText', label: '✨ Texto Personalizado / Valor Fixo', category: 'Geral & Empresa', defaultCode: 'TEXTO_CUSTOMIZADO', desc: 'Valor fixo definido manualmente ou capturado da seleção' }
] as const;

export const VariableMappingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedProspect,
  diagnosticData,
  onSelectTag,
  initialSelectedText
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<any[]>([]);

  // Form para nova variável customizada
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('clinicName');
  const [newTagCode, setNewTagCode] = useState('NOME_CLINICA_NOVO');
  const [newTagDesc, setNewTagDesc] = useState('Nome oficial da clínica prospectada');
  const [customFixedValue, setCustomFixedValue] = useState('');

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

  useEffect(() => {
    if (isOpen && initialSelectedText) {
      setShowAddForm(true);
      setSelectedSourceId('customText');
      setCustomFixedValue(initialSelectedText);

      const cleanSlug = initialSelectedText
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24);

      setNewTagCode(cleanSlug ? `TAG_${cleanSlug}` : 'TAG_TRECHO_SELECIONADO');
      setNewTagDesc(`Trecho selecionado no diagnóstico: "${initialSelectedText.slice(0, 45)}..."`);
    }
  }, [isOpen, initialSelectedText]);

  if (!isOpen) return null;

  // Resolver valor dinâmico baseado na fonte de dados selecionada
  const resolveSourceValue = (sourceId: string, p?: Prospect | null, d?: any, fixedVal?: string) => {
    if (!p && !d) return fixedVal || '[Exemplo de Valor]';
    switch (sourceId) {
      case 'clinicName': return p?.clinicName || 'Clínica Exemplo';
      case 'ownerName': return p?.ownerName || 'Dr. Proprietário';
      case 'cnpj': return p?.cnpj || '00.000.000/0001-00';
      case 'location': return p?.location || 'Brasília - DF';
      case 'fullAddress': return p?.fullAddress || p?.location || 'Endereço da Clínica';
      case 'clinicInstagram': return p?.clinicInstagram || '@instagram';
      case 'site': return p?.site || 'https://site.com.br';
      case 'termoPesquisado': return (p as any)?.keyword || d?.termoPesquisado || 'dentista';
      case 'nomesConcorrentes': return d?.concorrentes && d.concorrentes.length > 0 ? d.concorrentes.map((c: any) => c.nome).join(', ') : 'Odonto Premier - Dentista Lago Sul, Blanc Odontologia e Conic Odontologia';
      case 'posicaoGeral': return d?.posicaoGeral ? `${d.posicaoGeral}ª posição` : '7ª posição';
      case 'pontosPresenca': return d?.pontosPresenca ? `${d.pontosPresenca} pontos do mapa` : '19 pontos do mapa';
      case 'percentResultados': return d?.solvPercent ? `${d.solvPercent}%` : '38,78%';
      case 'posicaoForaTop20': return '20+';
      case 'notaGeral': return d?.notaGeral ? `${d.notaGeral}/100` : '65/100';
      case 'gmnRating': return p?.gmnRating ? `${p.gmnRating} ★` : '4.8 ★';
      case 'gmnReviewsCount': return p?.gmnReviewsCount ? `${p.gmnReviewsCount} avaliações` : '150 avaliações';
      case 'scoreGoogle': return d?.placar?.google ? `${d.placar.google}/100` : '21/100';
      case 'scoreReputacao': return d?.placar?.reputacao ? `${d.placar.reputacao}/100` : '92/100';
      case 'scoreInstagram': return d?.placar?.instagram ? `${d.placar.instagram}/100` : '75/100';
      case 'scoreSite': return d?.placar?.site ? `${d.placar.site}/100` : '83/100';
      case 'scoreAds': return d?.placar?.ads ? `${d.placar.ads}/100` : '100/100';
      case 'velocidade': return d?.site?.velocidade ? `${d.site.velocidade}/100` : '83/100';
      case 'seo': return d?.site?.seo !== undefined ? `${d.site.seo}/100` : '90/100';
      case 'dinheiroConservador': return 'R$ 15.000 / mês';
      case 'dinheiroModerado': return 'R$ 30.000 / mês';
      case 'dinheiroAgressivo': return 'R$ 45.000 / mês';
      case 'planoAcao': return d?.planoAcao ? d.planoAcao.map((item: any, i: number) => `${i+1}. ${item.titulo}`).join('\n') : 'Plano de Ação de 30 dias';
      case 'resumoIA': return d?.resumo1 ? `1. ${d.resumo1}\n2. ${d.resumo2}\n3. ${d.resumo3}` : 'Resumo Executivo da IA';
      case 'customText': return fixedVal || 'Valor Personalizado';
      default: return fixedVal || '[Valor Mapeado]';
    }
  };

  const allTags = [
    ...DEFAULT_VARIABLE_TAGS.map(t => ({ ...t, isCustom: false })),
    ...customTags.map(t => ({
      code: t.code,
      category: t.category,
      description: t.description,
      isCustom: true,
      exampleValue: (p: any, d: any) => resolveSourceValue(t.sourceId || 'customText', p, d, t.fixedValue)
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

  const handleDeleteCustomTag = (codeToDelete: string) => {
    Swal.fire({
      title: 'Excluir Tag?',
      text: `Deseja remover a tag personalizada ${codeToDelete}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const updated = customTags.filter(t => t.code !== codeToDelete);
        setCustomTags(updated);
        localStorage.setItem('custom_crm_variables', JSON.stringify(updated));
        Swal.fire('Excluída!', `A tag ${codeToDelete} foi removida com sucesso.`, 'success');
      }
    });
  };

  const handleSourceSelectChange = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    const preset = MAPPING_SOURCE_PRESETS.find(p => p.id === sourceId);
    if (preset) {
      setNewTagCode(preset.defaultCode);
      setNewTagDesc(preset.desc);
    }
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagCode.trim()) {
      Swal.fire('Atenção', 'Digite o nome do código da tag (ex: {{NOME_CLINICA_NOVO}}).', 'warning');
      return;
    }

    let codeFormatted = newTagCode.trim();
    if (!codeFormatted.startsWith('{{')) codeFormatted = `{{${codeFormatted}`;
    if (!codeFormatted.endsWith('}}')) codeFormatted = `${codeFormatted}}`;
    codeFormatted = codeFormatted.toUpperCase().replace(/\s+/g, '_');

    const preset = MAPPING_SOURCE_PRESETS.find(p => p.id === selectedSourceId);
    const category = (preset?.category || 'Geral & Empresa') as VariableTag['category'];

    const newCustomTag = {
      code: codeFormatted,
      category,
      description: newTagDesc.trim() || preset?.desc || 'Variável personalizada',
      sourceId: selectedSourceId,
      fixedValue: customFixedValue
    };

    const updated = [...customTags, newCustomTag];
    setCustomTags(updated);
    localStorage.setItem('custom_crm_variables', JSON.stringify(updated));

    // Copia a tag gerada imediatamente para a área de transferência
    navigator.clipboard.writeText(codeFormatted);
    setCopiedCode(codeFormatted);
    setTimeout(() => setCopiedCode(null), 2000);

    setNewTagCode('');
    setNewTagDesc('');
    setCustomFixedValue('');
    setShowAddForm(false);

    Swal.fire({
      icon: 'success',
      title: 'Mapeamento Criado e Copiado!',
      text: `A tag ${codeFormatted} foi criada e copiada para a área de transferência!`,
      timer: 2000,
      showConfirmButton: false
    });
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <div className="bg-[#0f111e] border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-[#16192b] shrink-0">
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
        <div className="p-6 border-b border-gray-800/80 bg-[#121424] space-y-4 shrink-0 overflow-x-hidden">
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
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shrink-0 cursor-pointer"
            >
              <Plus size={16} />
              <span>Indicar Novo Mapeamento</span>
            </button>
          </div>

          {/* Form para adicionar novo mapeamento interativo */}
          {showAddForm && (
            <form onSubmit={handleAddCustomTag} className="bg-[#181b30] p-5 rounded-2xl border border-indigo-500/40 space-y-4 animate-fadeIn shadow-xl">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={14} /> Selecionar e Mapear Campo / Variável
                </h4>
                <span className="text-[10px] text-gray-400">Escolha o trecho/campo e atribua uma Tag dinâmica</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Seleção do Campo/Dado a Mapear */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">
                    Qual dado você deseja mapear? *
                  </label>
                  <select
                    value={selectedSourceId}
                    onChange={(e) => handleSourceSelectChange(e.target.value)}
                    className="w-full bg-[#090a12] border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-indigo-500 font-semibold"
                  >
                    {MAPPING_SOURCE_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label} ({preset.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nome do Código da Tag */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">
                    Código da Tag Gerada *
                  </label>
                  <input
                    type="text"
                    value={newTagCode}
                    onChange={(e) => setNewTagCode(e.target.value)}
                    placeholder="Ex: {{NOME_PROPRIETARIO_CUSTOM}}"
                    className="w-full bg-[#090a12] border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-indigo-300 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Descrição */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-300 mb-1">
                    Descrição da Variável
                  </label>
                  <input
                    type="text"
                    value={newTagDesc}
                    onChange={(e) => setNewTagDesc(e.target.value)}
                    placeholder="Descrição do que esta variável representa"
                    className="w-full bg-[#090a12] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                {/* Se for valor customizado */}
                {selectedSourceId === 'customText' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-300 mb-1">
                      Valor Fixo Personalizado
                    </label>
                    <input
                      type="text"
                      value={customFixedValue}
                      onChange={(e) => setCustomFixedValue(e.target.value)}
                      placeholder="Digite o texto/valor que será inserido"
                      className="w-full bg-[#090a12] border border-gray-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-300 mb-1">
                      Preview do Valor no Diagnóstico
                    </label>
                    <div className="bg-[#090a12] border border-gray-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono truncate">
                      {resolveSourceValue(selectedSourceId, selectedProspect, diagnosticData, customFixedValue)}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-gray-800/60">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer active:scale-95"
                >
                  Salvar Mapeamento
                </button>
              </div>
            </form>
          )}

          {/* Category Tabs (Flex Wrap Limpo sem Rolagem Horrível) */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-[#181b30] text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-gray-800/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body / Variable Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#0d0f19] overflow-x-hidden">
          {filteredTags.map((tag, idx) => {
            const sampleVal = tag.exampleValue(selectedProspect, diagnosticData);
            const isCopied = copiedCode === tag.code;

            return (
              <div
                key={idx}
                className="bg-[#151829] hover:bg-[#1a1e33] border border-gray-800/80 hover:border-indigo-500/40 p-4 rounded-2xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group w-full min-w-0 overflow-hidden"
              >
                <div className="space-y-2 flex-1 min-w-0 w-full overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-indigo-400 bg-indigo-950/70 px-3 py-1 rounded-xl border border-indigo-500/30 break-all">
                      {tag.code}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-400 shrink-0">
                      {tag.category}
                    </span>
                    {tag.isCustom && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
                        <Sparkles size={10} /> Criada por Você
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-300 font-medium break-words">{tag.description}</p>

                  {/* Live Sample Preview with proper multi-line text wrapping */}
                  <div className="text-xs bg-[#090a12] p-3 rounded-xl border border-gray-800/90 font-mono flex flex-col gap-1 w-full min-w-0 overflow-hidden">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Valor Exemplo:</span>
                    <div className="text-emerald-400 font-mono text-xs break-words whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                      {sampleVal || '[Não preenchido nesta clínica]'}
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Copiar Tag + Deletar (se for customizada) */}
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                  <button
                    onClick={() => handleCopy(tag.code)}
                    className={`flex-1 md:flex-initial px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                        : 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30'
                    }`}
                  >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isCopied ? 'Copiado!' : 'Copiar Tag'}
                  </button>

                  {tag.isCustom && (
                    <button
                      onClick={() => handleDeleteCustomTag(tag.code)}
                      className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 transition-all cursor-pointer shrink-0"
                      title="Excluir Tag Customizada"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
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
        <div className="p-4 border-t border-gray-800 bg-[#16192b] flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>Escreva as tags dentro do texto da proposta (ex: <code className="text-indigo-400 font-mono">{"{{NOME_CLINICA}}"}</code>).</span>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-xl font-bold transition-all cursor-pointer"
          >
            Fechar Mapeamento
          </button>
        </div>

      </div>
    </div>
  );
};
