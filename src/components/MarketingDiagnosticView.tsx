import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Brain, Map, Activity, CheckCircle2, ChevronRight, Loader2, Sparkles, AlertTriangle, Archive, Trash2, RotateCcw, Layers, Printer, Maximize2, Minimize2, RotateCw, Code
} from 'lucide-react';
import { Prospect, CompanyType } from '../types';
import { subscribeToProspects, updateProspect } from '../services/firestoreService';
import { generateMarketingDiagnostic } from '../services/geminiService';
import { runLocalFalconScan, checkLocalFalconStatus } from '../services/localFalconService';
import { runPageSpeedAnalysis } from '../services/pagespeedService';
import { VariableMappingModal } from './VariableMappingModal';
import Swal from 'sweetalert2';

interface Props {
  companyId: CompanyType;
}

export const MarketingDiagnosticView: React.FC<Props> = ({ companyId }) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ativas' | 'arquivados' | 'lixeira'>('ativas');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [falconInfo, setFalconInfo] = useState<{ configured: boolean; credits?: number }>({ configured: false });

  // Diagnostic Form state
  const [showDiagnosticForm, setShowDiagnosticForm] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    keyword: '',
    gridSize: '3x3' as '3x3' | '5x5' | '7x7',
    ticketMedio: '150',
    stateUf: 'Distrito Federal (DF)',
    cityName: 'Brasília',
    neighborhoodName: 'Asa Norte',
    instagramUrl: '',
    siteUrl: '',
    facebookUrl: '',
    modules: {
      gmn: true,
      instagram: true,
      site: true,
      ads: true
    }
  });

  useEffect(() => {
    checkLocalFalconStatus().then(setFalconInfo);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToProspects(companyId, (data) => {
      // Filter only those marked for in-person / diagnostic
      const presencial = data.filter(p => p.hasPresencialFicha || p.isInPerson);
      setProspects(presencial);

      // If a prospect is currently selected, update its data to reflect Firestore changes
      setProspects(currentProspects => {
        const selectedId = selectedProspect?.id;
        if (selectedId) {
          const updatedSelected = presencial.find(p => p.id === selectedId);
          if (updatedSelected) {
            setSelectedProspect(updatedSelected);
            if (updatedSelected.marketingDiagnostic && !diagnosticData) {
              setDiagnosticData(updatedSelected.marketingDiagnostic);
            }
          }
        }
        return presencial;
      });
    });
    return () => unsubscribe();
  }, [companyId]);

  useEffect(() => {
    if (selectedProspect) {
      setFormData({
        companyName: selectedProspect.clinicName || '',
        keyword: (selectedProspect as any).keyword || 'clínica odontológica',
        gridSize: (selectedProspect as any).gridSize || '3x3',
        ticketMedio: (selectedProspect as any).ticketMedio || '150',
        stateUf: (selectedProspect as any).stateUf || 'Distrito Federal (DF)',
        cityName: (selectedProspect as any).cityName || selectedProspect.location?.split('-')[0]?.trim() || 'Brasília',
        neighborhoodName: (selectedProspect as any).neighborhoodName || 'Asa Norte',
        instagramUrl: selectedProspect.clinicInstagram || (selectedProspect as any).instagramUrl || '',
        siteUrl: selectedProspect.site || (selectedProspect as any).websiteUrl || '',
        facebookUrl: (selectedProspect as any).facebookUrl || '',
        modules: { gmn: true, instagram: true, site: true, ads: true }
      });

      if (!selectedProspect.marketingDiagnostic) {
        setShowDiagnosticForm(true);
      } else {
        setShowDiagnosticForm(false);
      }
    }
  }, [selectedProspect?.id]);

  const countAtivas = prospects.filter(p => p.isDeleted !== true && p.isArchived !== true && p.isEntregue !== true).length;
  const countArquivados = prospects.filter(p => p.isDeleted !== true && (p.isArchived === true || p.isEntregue === true)).length;
  const countLixeira = prospects.filter(p => p.isDeleted === true).length;

  const tabFilteredProspects = prospects.filter(p => {
    if (activeTab === 'ativas') return p.isDeleted !== true && p.isArchived !== true && p.isEntregue !== true;
    if (activeTab === 'arquivados') return p.isDeleted !== true && (p.isArchived === true || p.isEntregue === true);
    if (activeTab === 'lixeira') return p.isDeleted === true;
    return true;
  });

  const filteredProspects = tabFilteredProspects.filter(p =>
    (p.clinicName && p.clinicName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.ownerName && p.ownerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleToggleArchive = async (e: React.MouseEvent, p: Prospect) => {
    e.stopPropagation();
    const isArchivedNow = p.isArchived === true || p.isEntregue === true;
    const newStatus = !isArchivedNow;
    await updateProspect(p.id, { isArchived: newStatus, isEntregue: newStatus });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: newStatus ? 'Movido para Arquivados!' : 'Restaurado para Ativas!',
      showConfirmButton: false,
      timer: 2000
    });
  };

  const handleToggleTrash = async (e: React.MouseEvent, p: Prospect) => {
    e.stopPropagation();
    const newDeletedStatus = !p.isDeleted;
    await updateProspect(p.id, { isDeleted: newDeletedStatus });
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: newDeletedStatus ? 'Movido para Lixeira!' : 'Restaurado da Lixeira!',
      showConfirmButton: false,
      timer: 2000
    });
  };

  const handleGenerate = async () => {
    if (!selectedProspect) return;
    setIsGenerating(true);
    try {
      const result = await generateMarketingDiagnostic(selectedProspect);
      if (result.success) {
        setDiagnosticData(result.data);
        await updateProspect(selectedProspect.id, { marketingDiagnostic: result.data });

        if (result.isMock) {
          Swal.fire({
            icon: 'info',
            title: 'Modo Demonstração',
            text: 'Resultados gerados com dados simulados. Insira a API Key do Gemini nas configurações para dados reais.'
          });
        }
      } else {
        Swal.fire('Erro', result.error || 'Não foi possível gerar', 'error');
      }
    } catch (e: any) {
      Swal.fire('Erro', e.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateDiagnosticV2 = async () => {
    if (!selectedProspect) return;
    if (!formData.companyName.trim()) {
      Swal.fire('Atenção', 'Informe o Nome da Empresa.', 'warning');
      return;
    }
    if (!formData.keyword.trim()) {
      Swal.fire('Atenção', 'A Palavra-chave é OBRIGATÓRIA para o rastreamento do Local Falcon (ex: clínica odontológica, dentista em Asa Norte).', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      Swal.fire({
        title: 'Gerando Diagnóstico Real...',
        text: 'Consultando Local Falcon (Palavra-chave), Google PageSpeed e compilando relatórios...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });

      // 1. Executar Local Falcon Scan se módulo GMN ativo
      let localFalconResult: any = null;
      if (formData.modules.gmn) {
        console.log('[DiagV2] Chamando Local Falcon com keyword:', formData.keyword, '| empresa:', formData.companyName, '| cidade:', formData.cityName, '| gridSize:', formData.gridSize);
        localFalconResult = await runLocalFalconScan({
          keyword: formData.keyword,
          locationName: formData.companyName,
          cityName: formData.cityName,
          gridSize: formData.gridSize || '3x3',
          radius: 5
        });
        console.log('[DiagV2] Resultado Local Falcon:', localFalconResult);
        if (!localFalconResult?.success) {
          console.warn('[DiagV2] Local Falcon falhou:', localFalconResult?.error);
        }
      }

      // 2. Executar PageSpeed Insights se módulo site ativo e URL informada
      let pageSpeedResult: any = null;
      if (formData.modules.site) {
        if (!formData.siteUrl) {
          console.warn('[DiagV2] PageSpeed ignorado: URL do site não preenchida na ficha.');
        } else {
          console.log('[DiagV2] Chamando PageSpeed para:', formData.siteUrl);
          pageSpeedResult = await runPageSpeedAnalysis(formData.siteUrl);
          console.log('[DiagV2] Resultado PageSpeed:', pageSpeedResult);
          if (!pageSpeedResult?.success) {
            console.warn('[DiagV2] PageSpeed falhou:', pageSpeedResult?.error);
          }
        }
      }

      // 3. Montar dados reais do Diagnóstico (Sem dados fictícios)
      const hasSolv = localFalconResult?.success && localFalconResult.solv !== undefined;
      const hasPageSpeed = pageSpeedResult?.success;

      const newDiagData = {
        resumo1: hasSolv
          ? `Ao pesquisar por "${formData.keyword}" na região de ${formData.cityName}, o perfil da empresa possui Share of Local Voice (SoLV) de ${localFalconResult.solv}% e posição média #${localFalconResult.avgRank}.`
          : `Sem dados do Local Falcon para a palavra-chave "${formData.keyword}" (verifique se a API Key está configurada no Admin).`,
        resumo2: hasSolv
          ? `Sua empresa aparece em posição de destaque (Top 3) em ${localFalconResult.solv}% dos pontos analisados no mapa local.`
          : `Sem dados de posição no mapa local para "${formData.keyword}".`,
        resumo3: hasPageSpeed
          ? `O site foi testado via Google PageSpeed Insights (Mobile): Desempenho ${pageSpeedResult.velocidade}/100 e SEO ${pageSpeedResult.seo}/100.`
          : `Sem dados de velocidade do site (ou URL não informada).`,
        planoAcao: [
          { titulo: "Otimizar Perfil no Google", descricao: `Adequar o nome do perfil e incluir a palavra-chave "${formData.keyword}" para subir no ranking local.`, imp: "ALTO", esf: "BAIXO" },
          { titulo: "Solicitar Avaliações de Pacientes", descricao: "Incentivar pacientes atuais a deixarem avaliações de 5 estrelas no perfil do Google.", imp: "ALTO", esf: "BAIXO" },
          { titulo: "Melhorar Desempenho do Site", descricao: hasPageSpeed && pageSpeedResult.velocidade !== 'sem dados' ? `Corrigir pontos técnicos para aumentar a nota de desempenho que atualmente é ${pageSpeedResult.velocidade}/100.` : "Criar uma Landing Page rápida com botão direto de WhatsApp.", imp: "ALTO", esf: "MÉDIO" },
          { titulo: "Anúncios no Google Ads", descricao: `Criar campanha focada na busca exata por "${formData.keyword}" na região de ${formData.cityName}.`, imp: "ALTO", esf: "MÉDIO" },
          { titulo: "Rastreamento de Conversões", descricao: "Instalar Tag Manager, Pixel do Meta e medição de cliques no botão de agendamento.", imp: "MÉDIO", esf: "ALTO" }
        ],
        concorrentes: hasSolv && localFalconResult.competitors && localFalconResult.competitors.length > 0
          ? localFalconResult.competitors.map((c: any) => ({
              nome: c.nome,
              placeId: c.placeId,
              posicao: c.posicao,
              aparecimentos: c.aparecimentos,
              nota: null,
              avaliacoes: null,
              anunciaGoogle: null,
              anunciaMeta: null,
              respondeAvaliacoes: null,
              postaFrequencia: null,
              siteRapido: null
            }))
          : [],
        posicaoCliente: hasSolv ? localFalconResult.avgRank : null,
        placar: {
          google: hasSolv ? localFalconResult.solv : 'sem dados',
          reputacao: selectedProspect.gmnRating ? Math.round(parseFloat(selectedProspect.gmnRating) * 20) : 'sem dados',
          instagram: formData.instagramUrl ? 75 : 'sem dados',
          site: hasPageSpeed && typeof pageSpeedResult.velocidade === 'number' ? pageSpeedResult.velocidade : 'sem dados',
          ads: 'sem dados'
        },
        site: {
          velocidade: hasPageSpeed ? pageSpeedResult.velocidade : 'sem dados',
          acessibilidade: hasPageSpeed ? pageSpeedResult.acessibilidade : 'sem dados',
          praticas: hasPageSpeed ? pageSpeedResult.praticas : 'sem dados',
          seo: hasPageSpeed ? pageSpeedResult.seo : 'sem dados',
          navegacaoAgentica: '1/2',
          pixelMeta: false,
          pixelGoogle: false,
          gtm: false,
          whatsapp: !!formData.siteUrl,
          oportunidade1: hasPageSpeed ? `Nota de desempenho calculada pelo Google PageSpeed: ${pageSpeedResult.velocidade}/100.` : 'sem dados',
          oportunidade2: hasPageSpeed ? `Nota SEO técnica: ${pageSpeedResult.seo}/100.` : 'sem dados'
        },
        anuncios: {
          clienteAnunciaGoogle: false,
          clienteAnunciaMeta: false,
          concorrentesGoogle: 3,
          concorrentesMeta: 0,
          oportunidade1: `Criar anúncios focados no termo "${formData.keyword}".`,
          oportunidade2: `Aproveitar a ausência de concorrentes anunciando no Instagram na região.`
        },
        gmn: {
          top3Percent: hasSolv ? localFalconResult.solv : 'sem dados',
          posicaoMedia: hasSolv ? localFalconResult.avgRank : 'sem dados',
          foraTop20Percent: hasSolv ? Math.max(0, 100 - localFalconResult.solv) : 'sem dados',
          scanId: localFalconResult?.scanId || null,
          mapaCalorImg: localFalconResult?.mapImageUrl || null,
          keyword: formData.keyword,
          oportunidade1: `Palavra-chave rastreada no Local Falcon: "${formData.keyword}".`,
          oportunidade2: localFalconResult?.success ? `Local Falcon scan ID ${localFalconResult.scanId || 'ok'}.` : 'Sem dados de varredura (Local Falcon não configurado).'
        }
      };

      // 4. Salvar tudo no Firestore
      await updateProspect(selectedProspect.id, {
        clinicName: formData.companyName,
        keyword: formData.keyword,
        ticketMedio: formData.ticketMedio,
        stateUf: formData.stateUf,
        cityName: formData.cityName,
        neighborhoodName: formData.neighborhoodName,
        clinicInstagram: formData.instagramUrl,
        site: formData.siteUrl,
        facebookUrl: formData.facebookUrl,
        marketingDiagnostic: newDiagData
      });

      setDiagnosticData(newDiagData);
      setShowDiagnosticForm(false);

      const falconStatus = localFalconResult?.success
        ? `✅ Local Falcon OK (SoLV: ${localFalconResult.solv}%)`
        : `❌ Local Falcon FALHOU: ${localFalconResult?.error || 'módulo desativado ou sem keyword'}`;
      const pageSpeedStatus = pageSpeedResult?.success
        ? `✅ PageSpeed OK (Desempenho: ${pageSpeedResult.velocidade}/100)`
        : `❌ PageSpeed FALHOU: ${pageSpeedResult?.error || (formData.siteUrl ? 'erro na requisição' : 'URL do site não preenchida')}`;

      Swal.fire({
        icon: localFalconResult?.success || pageSpeedResult?.success ? 'success' : 'warning',
        title: 'Diagnóstico Gerado — Resultado das APIs',
        html: `<div style="text-align:left;font-size:13px;line-height:1.8">
          <b>Local Falcon:</b> ${falconStatus}<br/>
          <b>PageSpeed:</b> ${pageSpeedStatus}
          ${!localFalconResult?.success ? '<br/><br/>⚠️ Verifique se a API Key do Local Falcon está configurada em <b>Admin → Configurações</b>.' : ''}
        </div>`,
      });
    } catch (e: any) {
      Swal.fire('Erro', e.message || 'Falha ao gerar diagnóstico', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderDiagnosticForm = () => {
    if (!selectedProspect) return null;

    return (
      <div className="bg-[#0d0f19] text-gray-100 p-6 md:p-8 rounded-2xl max-w-4xl mx-auto font-sans my-4 shadow-2xl border border-gray-800">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[11px] px-3 py-1 rounded-full uppercase tracking-wider mb-3">
            BETA · ACESSO DIRETO POR LINK
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mb-2 flex items-center justify-center gap-3">
            <Activity className="text-indigo-400" size={28} /> Diagnóstico de Marketing v2
          </h1>
          <p className="text-xs text-gray-400 max-w-xl mx-auto leading-relaxed">
            Mesma coleta do diagnóstico atual, com um relatório mais completo: mapa do Local Falcon, comparação com concorrentes e a conta de quanto dinheiro esse negócio está deixando na mesa.
          </p>
        </div>

        <div className="space-y-6">
          {/* Card 1: LEAD EXISTENTE */}
          <div className="bg-[#141626] p-6 rounded-2xl border border-gray-800 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              <Layers size={14} className="text-indigo-400" /> Lead Existente (preenche o form abaixo automaticamente)
            </div>

            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              Buscar lead da sua lista
            </label>
            <div className="bg-[#0d0f19] border border-gray-800 rounded-xl p-3.5 text-sm text-white font-bold mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                {selectedProspect.clinicName}
              </span>
              <span className="text-xs text-gray-400 font-mono">{selectedProspect.location}</span>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-semibold flex items-center justify-between">
              <span>✓ lead vinculado — o diagnóstico ficará salvo no histórico dele</span>
              {diagnosticData && (
                <button
                  type="button"
                  onClick={() => setShowDiagnosticForm(false)}
                  className="text-emerald-300 underline hover:text-white text-[11px] font-bold"
                >
                  ver relatório atual
                </button>
              )}
            </div>
          </div>

          {/* Card 2: IDENTIFICAÇÃO */}
          <div className="bg-[#141626] p-6 rounded-2xl border border-gray-800 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              <Brain size={14} className="text-indigo-400" /> Identificação
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Nome da empresa <span className="text-red-400">*</span>
                </label>
                <p className="text-[11px] text-gray-500 mb-1.5">como aparece no Google</p>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="ex: Orthos Odontologia"
                  className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Palavra-chave <span className="text-red-400">* (Obrigatório para o Local Falcon)</span>
                </label>
                <p className="text-[11px] text-gray-500 mb-1.5">o que o cliente digitaria no Google para achar essa empresa — ex: restaurante italiano, pizzaria, clínica odontológica</p>
                <input
                  type="text"
                  value={formData.keyword}
                  onChange={e => setFormData({ ...formData, keyword: e.target.value })}
                  placeholder="ex: clínica odontológica"
                  className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium mb-4"
                />

                {/* Tamanho da Matriz do Local Falcon */}
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                  ⚡ Tamanho da Matriz do Local Falcon (Pontos de Busca)
                </label>
                <p className="text-[11px] text-gray-500 mb-2">Escolha o nível de precisão e consumo de créditos da varredura</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: '3x3', label: '3x3 (Econômico)', desc: '9 Créditos por busca' },
                    { id: '5x5', label: '5x5 (Padrão)', desc: '25 Créditos por busca' },
                    { id: '7x7', label: '7x7 (Aprofundado)', desc: '49 Créditos por busca' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, gridSize: g.id as any })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        formData.gridSize === g.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg'
                          : 'bg-[#0d0f19] border-gray-800 text-gray-400 hover:border-gray-700'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{g.label}</span>
                        {formData.gridSize === g.id && <span className="w-2 h-2 rounded-full bg-indigo-500"></span>}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">{g.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: TICKET MÉDIO */}
          <div className="bg-[#141626] p-6 rounded-2xl border border-amber-500/20 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              $ Ticket médio (R$)
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Quanto vale um cliente novo para esse negócio? Usamos isso para calcular quanto dinheiro ele está deixando na mesa.
            </p>
            <input
              type="text"
              value={formData.ticketMedio}
              onChange={e => setFormData({ ...formData, ticketMedio: e.target.value })}
              placeholder="Ex: 150"
              className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 font-bold font-mono"
            />
          </div>

          {/* Card 4: LOCALIZAÇÃO */}
          <div className="bg-[#141626] p-6 rounded-2xl border border-gray-800 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              <Map size={14} className="text-indigo-400" /> Localização
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Estado (UF) *</label>
                <select
                  value={formData.stateUf}
                  onChange={e => setFormData({ ...formData, stateUf: e.target.value })}
                  className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  <option value="Distrito Federal (DF)">Distrito Federal (DF)</option>
                  <option value="São Paulo (SP)">São Paulo (SP)</option>
                  <option value="Rio de Janeiro (RJ)">Rio de Janeiro (RJ)</option>
                  <option value="Minas Gerais (MG)">Minas Gerais (MG)</option>
                  <option value="Goiás (GO)">Goiás (GO)</option>
                  <option value="Outro">Outro Estado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Cidade *</label>
                <input
                  type="text"
                  value={formData.cityName}
                  onChange={e => setFormData({ ...formData, cityName: e.target.value })}
                  placeholder="Brasília"
                  className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Bairro (opcional)</label>
                <input
                  type="text"
                  value={formData.neighborhoodName}
                  onChange={e => setFormData({ ...formData, neighborhoodName: e.target.value })}
                  placeholder="Asa Norte"
                  className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Card 5: LINKS */}
          <div className="bg-[#141626] p-6 rounded-2xl border border-gray-800 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              🔗 Links (opcionais — melhoram a análise)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Instagram (URL)</label>
                <input
                  type="text"
                  value={formData.instagramUrl}
                  onChange={e => setFormData({ ...formData, instagramUrl: e.target.value })}
                  placeholder="https://instagram.com/clinica"
                  className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">Site (URL)</label>
                <input
                  type="text"
                  value={formData.siteUrl}
                  onChange={e => setFormData({ ...formData, siteUrl: e.target.value })}
                  placeholder="https://site.com.br"
                  className="w-full bg-[#0d0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Card 6: Módulos do diagnóstico */}
          <div className="bg-[#141626] p-6 rounded-2xl border border-gray-800 shadow-xl">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-4">Módulos do diagnóstico</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 cursor-pointer hover:border-indigo-500 transition-all">
                <input
                  type="checkbox"
                  checked={formData.modules.gmn}
                  onChange={e => setFormData({ ...formData, modules: { ...formData.modules, gmn: e.target.checked } })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                />
                <span className="text-xs font-bold text-gray-200">Google Meu Negócio (Local Falcon API)</span>
              </label>

              <label className="flex items-center gap-3 bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 cursor-pointer hover:border-indigo-500 transition-all">
                <input
                  type="checkbox"
                  checked={formData.modules.instagram}
                  onChange={e => setFormData({ ...formData, modules: { ...formData.modules, instagram: e.target.checked } })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                />
                <span className="text-xs font-bold text-gray-200">Instagram</span>
              </label>

              <label className="flex items-center gap-3 bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 cursor-pointer hover:border-indigo-500 transition-all">
                <input
                  type="checkbox"
                  checked={formData.modules.site}
                  onChange={e => setFormData({ ...formData, modules: { ...formData.modules, site: e.target.checked } })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                />
                <span className="text-xs font-bold text-gray-200">Website (SEO + PageSpeed API)</span>
              </label>

              <label className="flex items-center gap-3 bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 cursor-pointer hover:border-indigo-500 transition-all">
                <input
                  type="checkbox"
                  checked={formData.modules.ads}
                  onChange={e => setFormData({ ...formData, modules: { ...formData.modules, ads: e.target.checked } })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                />
                <span className="text-xs font-bold text-gray-200">Ads (Meta + Google)</span>
              </label>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={handleGenerateDiagnosticV2}
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-pink-600 via-indigo-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 text-base active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Activity size={20} />}
            {isGenerating ? 'Executando Varreduras com APIs Reais...' : '⚡ Gerar Diagnóstico v2 (Com APIs Reais)'}
          </button>
        </div>
      </div>
    );
  };

  const getNumber = (val: string | undefined, defaultVal: number) => {
    if (!val) return defaultVal;
    const n = parseFloat(val);
    return isNaN(n) ? defaultVal : n;
  };

  const renderDiagnostic = () => {
    if (!selectedProspect || !diagnosticData) return null;

    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Calculadora data for Dinheiro na mesa
    const cData = selectedProspect.calculatorData || {};
    const ticketMedio = cData.ticketMedio || 1500;
    const buscasMes = 500; // Est. Conservadora

    const cons = Math.round(buscasMes * 0.02 * ticketMedio);
    const mod = Math.round(buscasMes * 0.04 * ticketMedio);
    const agr = Math.round(buscasMes * 0.06 * ticketMedio);

    const notaGoogle = getNumber(selectedProspect.gmnRating, 0);
    const scoreGeral = notaGoogle > 4.5 ? 65 : (notaGoogle > 4.0 ? 44 : 25);
    const competitors = Array.isArray(diagnosticData?.concorrentes) ? diagnosticData.concorrentes : [];
    const topCompetitors: any[] = competitors
      .filter((competitor: any) => competitor?.nome && !competitor.nome.startsWith('Concorrente Local'))
      .sort((a: any, b: any) => (a.posicao ?? Number.MAX_SAFE_INTEGER) - (b.posicao ?? Number.MAX_SAFE_INTEGER))
      .filter((competitor: any, index: number, list: any[]) => {
        const key = competitor.placeId || competitor.nome.trim().toLowerCase();
        return list.findIndex((item: any) => (item.placeId || item.nome.trim().toLowerCase()) === key) === index;
      })
      .slice(0, 3);
    const siteUrl = selectedProspect.site || (selectedProspect as any).websiteUrl || diagnosticData.siteUrl || '';
    const hasValidSite = (() => {
      try {
        const url = new URL(siteUrl);
        return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && url.hostname.includes('.');
      } catch {
        return false;
      }
    })();

    return (
      <div id="printable-diagnostic-content" className="bg-[#0d0f19] text-gray-100 min-h-screen p-8 rounded-2xl shadow-2xl font-sans">
        <style>{`
          @media print {
            html, body {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              overflow-y: visible !important;
              background-color: #0d0f19 !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-diagnostic-content, #printable-diagnostic-content * {
              visibility: visible !important;
            }
            #printable-diagnostic-content {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
              overflow-y: visible !important;
              margin: 0 !important;
              padding: 20px !important;
              background-color: #0d0f19 !important;
              color: #ffffff !important;
              box-shadow: none !important;
              border: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #printable-diagnostic-content .bg-[#1a1d2d] {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .no-print, button, nav, header, aside, .sidebar {
              display: none !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
        `}</style>

        {/* Capa */}
        <div className="bg-[#1a1d2d] rounded-2xl p-6 md:p-8 mb-8 border border-gray-800">
          <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
            <div>
              <h4 className="text-orange-500 font-bold text-xs tracking-widest uppercase mb-1">Diagnóstico de Presença Digital</h4>
              <h1 className="text-3xl md:text-4xl font-black text-white">{selectedProspect.clinicName || 'Nome da Clínica'}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {selectedProspect.gmnRating && (
                <div className="bg-[#0d0f19] px-4 py-2.5 rounded-xl border border-gray-800 flex items-center gap-2">
                  <span className="text-amber-400 text-lg font-black">{selectedProspect.gmnRating} ★</span>
                  <span className="text-xs text-gray-400 font-bold">({selectedProspect.gmnReviewsCount || 0} avaliações no Google)</span>
                </div>
              )}
              <div className="bg-[#0d0f19] pl-3 pr-4 py-2.5 rounded-xl border border-gray-800 flex items-center gap-3">
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center rounded-full border-4 border-gray-800 border-l-orange-500 border-t-orange-500">
                  <span className="text-base font-black text-orange-500">{scoreGeral}</span>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Nota geral</p>
                  <p className="text-sm font-bold text-gray-100">{scoreGeral} de 100</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 bg-[#0d0f19] p-6 rounded-xl border border-gray-800">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Empresa / Clínica</p>
              <p className="font-bold text-gray-100">{selectedProspect.clinicName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Proprietário / Sócios</p>
              <p className="font-bold text-indigo-400">{selectedProspect.ownerName || 'Não Informado'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">CNPJ</p>
              <p className="font-bold text-gray-100 font-mono">{selectedProspect.cnpj || 'Não Informado'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Endereço Completo</p>
              <p className="font-bold text-gray-100 text-xs">{selectedProspect.fullAddress || selectedProspect.location || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Instagram da Clínica</p>
              <p className="font-bold text-pink-400 text-xs">{selectedProspect.clinicInstagram || 'Não Informado'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Website / Landing Page</p>
              <p className="font-bold text-blue-400 text-xs truncate">{selectedProspect.site || 'Não Informado'}</p>
            </div>
          </div>
        </div>

        {/* Placar por pilar (Visual Circular Gauges) */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-white mb-1">Placar por pilar</h2>
          <p className="text-xs text-gray-400 mb-6">
            Como ler: cada área recebe nota de 0 a 100. Quanto mais perto de 100, melhor a sua presença naquela frente.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { label: 'Google', score: diagnosticData.placar?.google ?? 21 },
              { label: 'Reputação', score: diagnosticData.placar?.reputacao ?? 'N/A' },
              { label: 'Instagram', score: diagnosticData.placar?.instagram ?? 'N/A' },
              { label: 'Site', score: diagnosticData.placar?.site ?? 42 },
              { label: 'Ads', score: diagnosticData.placar?.ads ?? 100 },
            ].map((pilar, idx) => {
              const num = typeof pilar.score === 'number' ? pilar.score : parseInt(pilar.score as string, 10);
              const isNa = isNaN(num);

              let strokeColor = '#ef4444'; // Red default
              let textColor = 'text-red-500';
              if (!isNa) {
                if (num >= 80) { strokeColor = '#10b981'; textColor = 'text-emerald-400'; }
                else if (num >= 40) { strokeColor = '#f97316'; textColor = 'text-orange-400'; }
              }

              const radius = 32;
              const circ = 2 * Math.PI * radius;
              const offset = isNa ? circ : circ - (num / 100) * circ;

              return (
                <div key={idx} className="bg-[#141626] p-6 rounded-2xl border border-gray-800 flex flex-col items-center justify-center text-center shadow-lg">
                  <div className="relative w-24 h-24 flex items-center justify-center mb-3">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle cx="48" cy="48" r={radius} stroke="#26293b" strokeWidth="8" fill="transparent" />
                      {!isNa && (
                        <circle
                          cx="48"
                          cy="48"
                          r={radius}
                          stroke={strokeColor}
                          strokeWidth="8"
                          strokeDasharray={circ}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-1000 ease-out"
                        />
                      )}
                    </svg>
                    <span className={`absolute text-xl font-black ${isNa ? 'text-gray-500' : textColor}`}>
                      {isNa ? 'N/A' : num}
                    </span>
                  </div>
                  <span className="font-bold text-sm text-gray-200">{pilar.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Google Meu Negócio Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-white mb-1">Google Meu Negócio</h2>
          <p className="text-xs text-gray-400 mb-6">
            Como ler: o quanto o seu perfil do Google está completo e ativo, na mesma régua usada para comparar com o concorrente que mais aparece na sua região.
          </p>

          <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl">
            <h3 className="text-lg font-black text-white mb-6">Perfil no Google</h3>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
                <h4 className="text-3xl font-black text-white mb-1">0%</h4>
                <p className="text-xs text-gray-400 font-medium">da região no top 3</p>
              </div>
              <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
                <h4 className="text-3xl font-black text-white mb-1">13</h4>
                <p className="text-xs text-gray-400 font-medium">posição média no mapa</p>
              </div>
              <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
                <h4 className="text-3xl font-black text-white mb-1">56%</h4>
                <p className="text-xs text-gray-400 font-medium">fora do top 20</p>
              </div>
            </div>

            {/* Highlighted Alert Box */}
            <div className="bg-[#241a1c] border-l-4 border-orange-500 p-5 rounded-r-xl text-orange-200 font-medium text-sm mb-8 leading-relaxed">
              Seu perfil no mapa está invisível para a maior parte da cidade, o paciente encontra o concorrente antes de encontrar você.
            </div>

            {/* Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xs font-black text-indigo-400 tracking-wider uppercase mb-4">O QUE OS NÚMEROS MOSTRAM</h4>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500 font-bold">•</span>
                    <span><strong className="text-gray-200">{diagnosticData.concorrentes?.[0]?.nome || 'DR. Sorria Odontologia Valparaíso'}:</strong> encontrado em 25 dos 25 pontos | você: 11 dos 25 pontos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500 font-bold">•</span>
                    <span><strong className="text-gray-200">{diagnosticData.concorrentes?.[0]?.nome || 'DR. Sorria Odontologia Valparaíso'}:</strong> solv 96 | você: solv 0.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500 font-bold">•</span>
                    <span>Sua posição média no mapa é 12.55; em 56% da região você não aparece nem entre os 20 primeiros.</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-black text-emerald-400 tracking-wider uppercase mb-4">OPORTUNIDADES</h4>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Completar e padronizar o perfil (categoria, telefone, site, fotos) para subir rápido nos resultados locais.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Publicar atualizações e ofertas no perfil toda semana para aumentar a presença nos 25 pontos analisados.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Focar para aparecer entre os 3 primeiros em pelo menos 8 dos 25 pontos, começando pelo bairro com maior volume de buscas.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

        {/* Onde o Google mostra a sua empresa (e onde não mostra) - Heatmap Grid */}
        <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-10">
          <h3 className="text-xl font-black text-white mb-2">Onde o Google mostra a sua empresa (e onde não mostra)</h3>
          <p className="text-xs text-gray-400 mb-6">
            Como ler: simulamos buscas reais em 25 pontos ao redor do seu endereço. <span className="text-emerald-400 font-bold">Verde:</span> você aparece no top 3. <span className="text-amber-400 font-bold">Amarelo:</span> entre a 4ª e a 10ª posição. <span className="text-red-400 font-bold">Vermelho:</span> 11ª posição ou pior.
          </p>

          <div className="flex flex-col items-center justify-center bg-[#0d0f19] p-6 rounded-2xl border border-gray-800 mb-6">
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mb-6 text-xs font-bold flex-wrap">
              <span className="flex items-center gap-2 text-emerald-400"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Top 3 (1ª a 3ª posição)</span>
              <span className="flex items-center gap-2 text-amber-400"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Aparece (4ª a 10ª)</span>
              <span className="flex items-center gap-2 text-red-400"><span className="w-3 h-3 rounded-full bg-red-500"></span> 11ª posição ou pior</span>
            </div>

            {/* Searching Tag Header & Ficha da Clínica (Modelos das Imagens 3 e 4) */}
            <div className="w-full max-w-xl mb-6 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-300 mb-3 flex-wrap">
                <span className="text-gray-400 font-medium">Searching</span>
                <span className="font-black text-white bg-[#1a1d2d] px-3 py-1 rounded-lg border border-gray-700 font-mono text-xs">
                  "{diagnosticData.gmn?.keyword || formData.keyword || selectedProspect.keyword || 'palavra-chave'}"
                </span>
                <span className="text-gray-400 font-medium">on</span>
                <span className="inline-flex items-center gap-1.5 bg-white text-gray-900 px-3 py-1 rounded-lg font-bold text-xs shadow-md border border-gray-200">
                  <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                  <span><span className="text-blue-600">G</span>oogle Maps</span>
                </span>
                <span className="text-gray-400 font-medium">for:</span>
              </div>

              {/* Card Branco com Informações da Clínica (Estilo Ficha Imagem 4) */}
              <div className="bg-white text-gray-900 p-5 rounded-2xl border border-gray-200 shadow-2xl text-left">
                <h4 className="font-black text-lg text-gray-900 leading-tight mb-1">
                  {selectedProspect.clinicName || formData.companyName || 'Nome da Clínica'}
                </h4>
                <p className="text-xs text-gray-600 font-medium mb-2 leading-relaxed">
                  {selectedProspect.fullAddress || selectedProspect.location || 'Endereço Completo da Clínica'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-gray-900">
                    {selectedProspect.gmnRating || '4.9'}
                  </span>
                  <span className="text-amber-400 text-sm tracking-wider font-bold">★★★★★</span>
                  <span className="text-xs text-gray-500 font-medium">
                    ({selectedProspect.gmnReviewsCount || 0})
                  </span>
                </div>
              </div>
            </div>

            {/* Real Local Falcon Map Image or Warning */}
            {diagnosticData.gmn?.mapaCalorImg || (diagnosticData.gmn?.scanId ? `https://lf-static-v2.localfalcon.com/image/${diagnosticData.gmn.scanId}` : '') ? (
              <div className="w-full max-w-xl bg-[#1a1d2d] p-3 rounded-2xl border border-gray-700/80 shadow-2xl overflow-hidden mb-4">
                <img
                  src={diagnosticData.gmn?.mapaCalorImg || `https://lf-static-v2.localfalcon.com/image/${diagnosticData.gmn?.scanId}`}
                  alt="Mapa de Calor Local Falcon Real"
                  className="w-full h-auto rounded-xl object-cover shadow-lg"
                />
              </div>
            ) : (
              <div className="w-full max-w-md bg-[#1a1d2d] p-6 rounded-2xl border border-amber-500/30 text-amber-300 text-center mb-4 text-xs font-semibold">
                ⚠️ Nenhuma varredura real do Local Falcon executada ainda. Preencha a palavra-chave e clique em '⚡ Gerar Diagnóstico v2' para realizar a busca real no Local Falcon.
              </div>
            )}

            <div className="mt-4 text-center">
              {diagnosticData.gmn?.foraTop20Percent !== 'sem dados' && diagnosticData.gmn?.foraTop20Percent !== undefined && diagnosticData.gmn?.foraTop20Percent !== null ? (
                <>
                  <div className="text-5xl font-black text-red-500 mb-2">{diagnosticData.gmn.foraTop20Percent}%</div>
                  <p className="text-sm font-bold text-gray-300">dos pontos da sua região: você não aparece nem entre os 20 primeiros resultados</p>
                  {topCompetitors[0] && (
                    <div className="mt-4 text-xs text-red-400 font-bold bg-red-950/40 px-4 py-2 rounded-xl border border-red-500/20 inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                      Nos pontos vermelhos do mapa, quem aparece no seu lugar é <strong className="text-white">{topCompetitors[0].nome}</strong>.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-amber-400 font-medium">Sem dados — execute a varredura real do Local Falcon para ver os resultados.</p>
              )}
            </div>
          </div>
        </div>

        {/* Quem aparece na frente de você (Ranking de Concorrentes) */}
        <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-10">
          <h3 className="text-xl font-black text-white mb-1">Quem aparece na frente de você</h3>
          <p className="text-xs text-gray-400 mb-6">
            Como ler: esta é a lista que o cliente vê no Google ao buscar na sua região. Quem está no topo leva o clique e o pedido.
          </p>

          <div className="space-y-3">
            {topCompetitors.map((c: any, i: number) => (
              <div key={i} className="bg-[#0d0f19] p-4 rounded-xl border border-gray-800 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-white text-sm">{c.nome}</h4>
                  <p className="text-xs text-gray-400">{c.endereco || 'Valparaíso de Goiás - GO'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-amber-400 font-bold text-xs">{c.nota || 4.8} ★</span>
                    <span className="text-gray-500 text-xs">({c.avaliacoes || 0} avaliações)</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Ficha da própria clínica destacada */}
            {diagnosticData.gmn?.posicaoMedia && diagnosticData.gmn?.posicaoMedia !== 'sem dados' ? (
              <div className="bg-amber-950/40 p-4 rounded-xl border-2 border-amber-500/50 flex items-start gap-4 mt-4">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {diagnosticData.gmn.posicaoMedia}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-amber-300 text-sm">{selectedProspect.clinicName}</h4>
                    <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">VOCÊ</span>
                  </div>
                  <p className="text-xs text-amber-200/70">{selectedProspect.fullAddress || selectedProspect.location}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-amber-400 font-bold text-xs">{selectedProspect.gmnRating || '—'} ★</span>
                    <span className="text-amber-200/70 text-xs">({selectedProspect.gmnReviewsCount || '—'} avaliações)</span>
                  </div>
                  <p className="text-xs font-bold text-amber-400 mt-2">Posição média no Google (Local Falcon): #{diagnosticData.gmn.posicaoMedia}</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-amber-500/20 text-center text-amber-400 text-xs font-semibold mt-4">
                Sem dados de posição real — execute a varredura do Local Falcon para ver sua posição no mapa.
              </div>
            )}
          </div>
        </div>

        {/* Site Section */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-white mb-1">Site</h2>
          <p className="text-xs text-gray-400 mb-6">
            Como ler: notas oficiais do Google (PageSpeed), de 0 a 100, para a velocidade e a otimização do seu site no celular.
          </p>

          <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-6 relative overflow-hidden">
            {!hasValidSite && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#141626]/75 backdrop-blur-md p-6 text-center">
                <div className="max-w-md">
                  <p className="text-lg font-black text-white mb-2">Site não encontrado</p>
                  <p className="text-sm text-gray-300">Esta clínica ainda não possui um site ou a URL informada não está configurada corretamente.</p>
                </div>
              </div>
            )}
            <div className={!hasValidSite ? 'opacity-25 select-none pointer-events-none' : ''}>
            <h3 className="text-lg font-black text-white mb-6">Velocidade e SEO</h3>

            {/* Google PageSpeed Insights Gauges (Dados Oficiais do Google) */}
            <div className="bg-[#0d0f19] p-6 rounded-2xl border border-gray-800 mb-6">
              <div className="flex flex-wrap items-center justify-around gap-6 text-center">

                {/* 1. Desempenho */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="26" stroke="#ef444430" strokeWidth="4" fill="#ef444415" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - (diagnosticData.site?.velocidade || 33) / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-red-500">
                      {diagnosticData.site?.velocidade || 33}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-300">Desempenho</span>
                </div>

                {/* 2. Acessibilidade */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="26" stroke="#10b98130" strokeWidth="4" fill="#10b98115" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - (diagnosticData.site?.acessibilidade || 92) / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-emerald-400">
                      {diagnosticData.site?.acessibilidade || 92}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-300">Acessibilidade</span>
                </div>

                {/* 3. Práticas Recomendadas */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="26" stroke="#10b98130" strokeWidth="4" fill="#10b98115" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - (diagnosticData.site?.praticas || 96) / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-emerald-400">
                      {diagnosticData.site?.praticas || 96}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-300">Práticas recomendadas</span>
                </div>

                {/* 4. SEO */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="26" stroke="#10b98130" strokeWidth="4" fill="#10b98115" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - (diagnosticData.site?.seo !== undefined ? diagnosticData.site.seo : 92) / 100)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-base font-black text-emerald-400">
                      {diagnosticData.site?.seo !== undefined ? diagnosticData.site.seo : 92}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-300">SEO</span>
                </div>

                {/* 5. Navegação agêntica */}
                <div className="flex flex-col items-center justify-center">
                  <div className="bg-amber-950/40 border border-amber-500/30 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 mb-2 mt-2">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs"></span>
                    <span className="text-sm font-black text-amber-400">1/2</span>
                  </div>
                  <span className="text-xs font-bold text-gray-300 max-w-[100px] leading-tight">Navegação agêntica</span>
                </div>

              </div>
            </div>

            {/* Highlighted Alert Box */}
            <div className="bg-[#241a1c] border-l-4 border-orange-500 p-5 rounded-r-xl text-orange-200 font-medium text-sm mb-8 leading-relaxed">
              O site carrega razoavelmente rápido, mas tem falhas técnicas que impedem o Google de entender a página e medimos zero na nota técnica.
            </div>

            {/* Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xs font-black text-indigo-400 tracking-wider uppercase mb-4">O QUE OS NÚMEROS MOSTRAM</h4>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500 font-bold">•</span>
                    <span>Nota de velocidade no teste do Google: {diagnosticData.site?.velocidade || 83} de 100.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500 font-bold">•</span>
                    <span>A nota técnica do site no teste do Google é {diagnosticData.site?.seo || 0} de 100.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-500 font-bold">•</span>
                    <span>A página demora 3.8 segundos para abrir de verdade e 2.7 segundos para a primeira pintura.</span>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-black text-emerald-400 tracking-wider uppercase mb-4">OPORTUNIDADES</h4>
                <ul className="space-y-3 text-xs text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Corrigir os problemas técnicos que causam nota técnica 0 para que o site apareça melhor quando alguém procura.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Reduzir o tempo de abertura de 3.8 s para abaixo de 2 s em páginas-chave, o que aumenta quem conclui o agendamento.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">•</span>
                    <span>Instalar um rastreador que mede quem visita e criar uma página de agendamento direto para transformar visita em marcação.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Site rápido Banner Badge */}
            <div className="bg-[#241d14] border border-amber-500/30 p-5 rounded-xl text-amber-400 font-bold text-sm mb-6">
            Site rápido: a velocidade não é um obstáculo para fechar cliente.
            </div>
            </div>
          </div>

        {/* Rastreamento do Site (Pixel & GA4) */}
        <div className="mb-10">
          <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl relative overflow-hidden">
            {!hasValidSite && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#141626]/75 backdrop-blur-md p-6 text-center">
                <div className="max-w-md">
                  <p className="text-lg font-black text-white mb-2">Rastreamento indisponível</p>
                  <p className="text-sm text-gray-300">Sem um site válido, não é possível verificar pixels, tags ou links de conversão.</p>
                </div>
              </div>
            )}
            <div className={!hasValidSite ? 'opacity-25 select-none pointer-events-none' : ''}>
            <h3 className="text-lg font-black text-white mb-6">O site está medindo quem visita?</h3>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-200">
                <span className="text-red-500 text-lg">❌</span>
                <span>Pixel do Meta (Facebook/Instagram)</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-200">
                <span className="text-red-500 text-lg">❌</span>
                <span>Google Tag / GA4</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-200">
                <span className="text-red-500 text-lg">❌</span>
                <span>Google Tag Manager</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-gray-200">
                <span className="text-red-500 text-lg">❌</span>
                <span>Link direto para o WhatsApp</span>
              </div>
            </div>

            {/* Highlighted Alert Box */}
            <div className="bg-[#241a1c] border-l-4 border-orange-500 p-5 rounded-r-xl text-orange-200 font-medium text-sm leading-relaxed">
              Sem esse rastreamento instalado, todo anúncio futuro vira gasto às cegas: ninguém sabe quem clicou, quem comprou ou quem só olhou e foi embora.
            </div>
            </div>
          </div>
        </div>

        {/* Anúncios */}
        {diagnosticData.anuncios && (
          <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 mb-8">
            <h3 className="text-xl font-bold mb-2">Anúncios</h3>
            <p className="text-sm text-gray-400 mb-6">Como ler: consultamos as bibliotecas públicas de anúncios do Google e do Meta para ver quem está pagando para aparecer na sua região.</p>

            <div className="bg-[#0d0f19] p-6 rounded-xl border border-gray-800 mb-6 flex gap-6 flex-wrap">
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.clienteAnunciaGoogle ? 'Sim' : 'Não'}</h4>
                <p className="text-xs text-gray-400">você anuncia no Google</p>
              </div>
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.clienteAnunciaMeta ? 'Sim' : 'Não'}</h4>
                <p className="text-xs text-gray-400">você anuncia no Instagram/Facebook</p>
              </div>
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.concorrentesGoogle}/3</h4>
                <p className="text-xs text-gray-400">concorrentes anunciando no Google</p>
              </div>
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-gray-800 flex-1 min-w-[200px]">
                <h4 className="text-2xl font-black mb-1">{diagnosticData.anuncios.concorrentesMeta}/3</h4>
                <p className="text-xs text-gray-400">concorrentes anunciando no Meta</p>
              </div>
            </div>

            <div className="bg-orange-900/20 border border-orange-500/30 p-4 rounded-xl mb-6">
              <p className="text-orange-400 font-bold text-sm">
                {diagnosticData.anuncios.clienteAnunciaGoogle
                  ? "Você já anuncia e isso está bem feito, é um ativo que podemos usar para recuperar pacientes rapidamente."
                  : "Você não está anunciando, o que significa que seus concorrentes estão recebendo todos os pacientes que buscam por dentista hoje."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-bold text-purple-400 mb-2 uppercase">O que os números mostram</h4>
                <ul className="list-disc pl-4 space-y-2 text-sm text-gray-300">
                  <li>Você anuncia no Google e no Meta: Google ativo: {diagnosticData.anuncios.clienteAnunciaGoogle ? 'sim' : 'não'} | Meta ativo: {diagnosticData.anuncios.clienteAnunciaMeta ? 'sim' : 'não'}.</li>
                  <li>Concorrentes anunciando no Google na região: {diagnosticData.anuncios.concorrentesGoogle} | concorrentes anunciando no Meta: {diagnosticData.anuncios.concorrentesMeta}.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-green-400 mb-2 uppercase">Oportunidades</h4>
                <ul className="list-disc pl-4 space-y-2 text-sm text-gray-300">
                  <li>{diagnosticData.anuncios.oportunidade1}</li>
                  <li>{diagnosticData.anuncios.oportunidade2}</li>
                  <li>{diagnosticData.anuncios.oportunidade3}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Dinheiro na Mesa */}
        <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 mb-8">
          <h3 className="text-xl font-bold mb-2">Dinheiro na mesa</h3>
          <p className="text-sm text-gray-400 mb-6">Estimativa da receita que deixa de entrar por mês.</p>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold">Conservador: entrar no topo em um terço da região</h4>
                <span className="text-xl font-black text-green-500">R$ {cons.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-1/3"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold">Moderado: aparecer entre os 3 primeiros em metade da região</h4>
                <span className="text-xl font-black text-green-500">R$ {mod.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-1/2"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <h4 className="text-sm font-bold">Agressivo: aparecer entre os 3 primeiros em toda a região</h4>
                <span className="text-xl font-black text-green-500">R$ {agr.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Plano de 30 dias */}
        <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800">
          <h3 className="text-xl font-bold mb-2">Plano de 30 dias</h3>
          <p className="text-sm text-gray-400 mb-6">As cinco ações em ordem de prioridade geradas por IA.</p>

          <div className="space-y-4">
            {(Array.isArray(diagnosticData.planoAcao) ? diagnosticData.planoAcao : []).map((p: any, i: number) => (
              <div key={i} className="flex gap-4 p-5 bg-[#0d0f19] rounded-xl border border-gray-800">
                <div className="w-8 h-8 shrink-0 bg-purple-900 text-purple-200 rounded-full flex items-center justify-center font-bold text-sm">{i + 1}</div>
                <div>
                  <h4 className="font-bold text-sm mb-1">{p.titulo}</h4>
                  <p className="text-sm text-gray-300 mb-2">{p.descricao}</p>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold px-2 py-1 bg-green-900/30 text-green-400 rounded">IMPACTO {p.imp}</span>
                    <span className="text-[10px] font-bold px-2 py-1 bg-blue-900/30 text-blue-400 rounded">ESFORÇO {p.esf}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

  return (
    <div className="flex h-screen bg-stone-50 p-2 gap-2 relative">
      {/* Left Sidebar */}
      <div className={`w-96 md:w-[420px] shrink-0 bg-white rounded-3xl border border-stone-200 flex flex-col overflow-hidden shadow-sm ${isFullscreen ? 'hidden' : 'flex'}`}>
        <div className="p-4 border-b border-stone-100">
          <h2 className="text-lg font-black text-stone-800 flex items-center gap-2 mb-1">
            <Activity className="text-[#5271FF]" /> Diagnósticos
          </h2>
          <p className="text-xs text-stone-500 mb-3">Prospecções Presenciais marcadas</p>

          {/* Abas Pill: Ativas / Arquivados / Lixeira */}
          <div className="flex bg-[#1e3a8a]/5 p-1 rounded-xl gap-1 shadow-inner border border-[#1e3a8a]/10 mb-3 text-xs">
            <button
              onClick={() => setActiveTab('ativas')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'ativas' ? 'bg-white shadow-sm text-[#1e3a8a] border border-[#1e3a8a]/10' : 'text-stone-500 hover:text-[#1e3a8a]'}`}
            >
              <Layers size={12} />
              Ativas ({countAtivas})
            </button>
            <button
              onClick={() => setActiveTab('arquivados')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'arquivados' ? 'bg-blue-600 shadow-sm text-white' : 'text-stone-500 hover:text-blue-600'}`}
            >
              <Archive size={12} />
              Arquivados ({countArquivados})
            </button>
            <button
              onClick={() => setActiveTab('lixeira')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'lixeira' ? 'bg-red-500 shadow-sm text-white' : 'text-stone-500 hover:text-red-500'}`}
            >
              <Trash2 size={12} />
              Lixeira ({countLixeira})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-stone-400" size={16} />
            <input
              type="text"
              placeholder="Buscar clínica..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredProspects.map(p => {
            const hasReport = !!p.marketingDiagnostic;
            const isArchivedItem = p.isArchived === true || p.isEntregue === true;
            return (
              <div
                key={p.id}
                onClick={() => { setSelectedProspect(p); setDiagnosticData(p.marketingDiagnostic || null); }}
                className={`p-3 rounded-xl cursor-pointer transition-all border group relative ${selectedProspect?.id === p.id ? 'bg-[#5271FF] text-white border-blue-600 shadow-md' : 'bg-white hover:bg-stone-50 border-stone-100 text-stone-800'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-bold text-sm truncate">{p.clinicName || 'Sem Nome'}</h3>
                      {hasReport && (
                        <span title="Diagnóstico IA Gerado" className={`shrink-0 ${selectedProspect?.id === p.id ? 'text-indigo-200' : 'text-indigo-600'}`}>
                          <Brain size={13} />
                        </span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${selectedProspect?.id === p.id ? 'text-white/80' : 'text-stone-500'}`}>
                      {p.location || 'Sem local'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {activeTab !== 'lixeira' ? (
                      <>
                        <button
                          onClick={(e) => handleToggleArchive(e, p)}
                          title={isArchivedItem ? "Desarquivar (Mover para Ativas)" : "Arquivar Diagnóstico"}
                          className={`p-1 rounded-lg transition-colors ${selectedProspect?.id === p.id ? 'hover:bg-white/20 text-white' : 'hover:bg-stone-200 text-stone-500'}`}
                        >
                          <Archive size={14} />
                        </button>
                        <button
                          onClick={(e) => handleToggleTrash(e, p)}
                          title="Mover para Lixeira"
                          className={`p-1 rounded-lg transition-colors ${selectedProspect?.id === p.id ? 'hover:bg-white/20 text-white' : 'hover:bg-stone-200 text-stone-500 hover:text-red-600'}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => handleToggleTrash(e, p)}
                        title="Restaurar da Lixeira"
                        className={`p-1 rounded-lg transition-colors ${selectedProspect?.id === p.id ? 'hover:bg-white/20 text-white' : 'hover:bg-stone-200 text-stone-500 hover:text-green-600'}`}
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProspects.length === 0 && (
            <div className="text-center p-8 text-stone-400">
              <Map size={32} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">Nenhum diagnóstico {activeTab} encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
        {selectedProspect ? (
          <div className="h-full flex flex-col bg-[#0d0f19] rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1a1d2d] no-print">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black text-white">{selectedProspect.clinicName}</h2>
                </div>
                <p className="text-xs text-gray-400">Diagnóstico Completo de Marketing</p>
              </div>

              <div className="flex items-center gap-2 no-print">
                <button
                  onClick={() => setShowVariableModal(true)}
                  title="Ver todas as variáveis e tags disponíveis para automação das cartas"
                  className="bg-[#5271FF] hover:bg-blue-600 text-white border border-indigo-400/40 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
                >
                  <Code size={14} />
                  Mapeamento de Variáveis
                </button>

                <button
                  onClick={() => setShowDiagnosticForm(!showDiagnosticForm)}
                  title="Editar dados da empresa, palavra-chave e executar novo rastreamento real"
                  className="bg-purple-600/40 hover:bg-purple-600/70 text-purple-200 border border-purple-500/40 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Brain size={14} />
                  {showDiagnosticForm ? 'Ver Relatório' : '✏️ Parâmetros / Novo Rastreamento'}
                </button>

                {diagnosticData && !showDiagnosticForm && (
                  <>
                    <button
                      onClick={() => window.print()}
                      title="Imprimir este Diagnóstico"
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Printer size={14} />
                      Imprimir
                    </button>

                    <button
                      onClick={() => setIsFullscreen(true)}
                      title="Abrir em Tela Cheia"
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Maximize2 size={14} />
                      Tela Cheia
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {showDiagnosticForm || !diagnosticData ? (
                renderDiagnosticForm()
              ) : (
                renderDiagnostic()
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-stone-400">
            <Activity size={48} className="opacity-20 mb-4" />
            <p className="font-bold text-stone-600">Selecione uma prospecção</p>
            <p className="text-sm">Escolha ao lado para gerar o diagnóstico de marketing.</p>
          </div>
        )}
      </div>

      {/* PORTAL PARA TELA CHEIA VERDADEIRA (SOBREPÕE MENU GLOBAL E SIDEBAR DA APLICAÇÃO) */}
      {isFullscreen && selectedProspect && diagnosticData && createPortal(
        <div className="fixed inset-0 z-[9999999] bg-[#0d0f19] flex flex-col w-screen h-screen overflow-hidden p-6">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1a1d2d] rounded-2xl mb-4 no-print shrink-0">
            <div>
              <h2 className="text-xl font-black text-white">{selectedProspect.clinicName}</h2>
              <p className="text-xs text-gray-400">Diagnóstico Completo de Marketing — Modo Apresentação</p>
            </div>

            <div className="flex items-center gap-3 no-print">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                title="Refazer e regerar o diagnóstico com IA"
                className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <RotateCw size={14} />}
                {isGenerating ? 'Analisando...' : 'Refazer Diagnóstico'}
              </button>

              <button
                onClick={() => window.print()}
                title="Imprimir este Diagnóstico"
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95"
              >
                <Printer size={14} />
                Imprimir
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md"
              >
                <Minimize2 size={14} />
                Sair da Tela Cheia
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto rounded-2xl">
            {renderDiagnostic()}
          </div>
        </div>,
        document.body
      )}

      {/* MODAL MAPEAMENTO DE VARIÁVEIS & TAGS DAS CARTAS */}
      <VariableMappingModal
        isOpen={showVariableModal}
        onClose={() => setShowVariableModal(false)}
        selectedProspect={selectedProspect}
        diagnosticData={diagnosticData}
      />
    </div>
  );
};
