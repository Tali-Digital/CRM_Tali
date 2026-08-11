import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Brain, Map, Activity, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Sparkles, AlertTriangle, AlertCircle, Archive, Trash2, RotateCcw, Layers, Printer, Maximize2, Minimize2, RotateCw, Code, RefreshCw, Clock, Terminal, ListOrdered, X, Play, Pause, ChevronDown, Plus, XCircle, CheckCircle, Download, Tv, Monitor, Crop, Sun, Moon, Target
} from 'lucide-react';
import { Prospect, CompanyType } from '../types';
import { subscribeToProspects, subscribeToProspeccaoDocs, updateProspect, updateProspeccaoDoc, createNotification, subscribeToDiagnosticQueue, saveDiagnosticQueueItem, deleteDiagnosticQueueItem, clearFinishedDiagnosticQueue } from '../services/firestoreService';
import { generateMarketingDiagnostic, generateOportunidadesPersonalizadasIA } from '../services/geminiService';
import { runLocalFalconScan, checkLocalFalconStatus, fetchLocalFalconReportHistory } from '../services/localFalconService';
import { runPageSpeedAnalysis } from '../services/pagespeedService';
import { checkMetaAds } from '../services/metaAdsService';
import { computeOportunidadesDetectadas } from '../services/mappingTagsService';
import { auth } from '../firebase';
import { VariableMappingModal } from './VariableMappingModal';
import { VisualCropModal } from './VisualCropModal';
import Swal from 'sweetalert2';

// ── Queue Types ──
interface QueueLogEntry {
  timestamp: number;
  step: string;
  duration?: number; // ms
  status: 'running' | 'done' | 'error';
}

interface DiagnosticQueueItem {
  id: string;
  prospectId: string;
  clinicName: string;
  location: string;
  requestedBy?: string;
  status: 'waiting' | 'running' | 'done' | 'error';
  actionType?: 'full' | 'rerun_module' | 'fetch_existing_gmn' | 'force_new_gmn';
  targetModule?: 'gmn' | 'site' | 'instagram' | 'ads';
  addedAt: number;
  startedAt?: number;
  finishedAt?: number;
  duration?: number; // ms total
  error?: string;
  logs: QueueLogEntry[];
  formSnapshot: any; // snapshot of formData at time of enqueue
  modules: { gmn: boolean; instagram: boolean; site: boolean; ads: boolean };
}

interface Props {
  companyId: CompanyType;
}

export const MarketingDiagnosticView: React.FC<Props> = ({ companyId }) => {
  const getSavedViewState = <T,>(key: string, defaultValue: T): T => {
    try {
      const uid = auth?.currentUser?.uid || 'guest';
      const saved = localStorage.getItem(`marketing_diagnostic_view_${uid}_${key}`);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState(() => getSavedViewState('searchQuery', ''));
  const [activeTab, setActiveTab] = useState<'ativas' | 'arquivados' | 'lixeira'>(() => getSavedViewState('activeTab', 'ativas'));
  const [responsibleFilter, setResponsibleFilter] = useState(() => getSavedViewState('responsibleFilter', ''));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [showPresentationModal, setShowPresentationModal] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [falconInfo, setFalconInfo] = useState<{ configured: boolean; credits?: number }>({ configured: false });

  // Keybindings for slide presentation
  useEffect(() => {
    if (!showPresentationModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlideIndex(prev => Math.min(prev + 1, 5));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setShowPresentationModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPresentationModal]);

  // ── Queue System State (Compartilhado via Firestore com auto-exclusão de 72h) ──
  const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

  const filterNonExpiredQueue = useCallback((items: DiagnosticQueueItem[]): DiagnosticQueueItem[] => {
    const now = Date.now();
    return items.filter(item => {
      if (item.status === 'waiting' || item.status === 'running') return true;
      const refTime = item.finishedAt || item.addedAt;
      return (now - refTime) < SEVENTY_TWO_HOURS_MS;
    });
  }, [SEVENTY_TWO_HOURS_MS]);

  const [diagnosticQueue, setDiagnosticQueue] = useState<DiagnosticQueueItem[]>([]);

  const [showQueueModal, setShowQueueModal] = useState(false);
  const [terminalOpenId, setTerminalOpenId] = useState<string | null>(null);
  const [queueSearchTerm, setQueueSearchTerm] = useState('');
  const isProcessingRef = useRef(false);
  const queueRef = useRef<DiagnosticQueueItem[]>([]);
  const isLocalUpdateRef = useRef(false);
  
  // Inscrição Firestore para fila compartilhada
  useEffect(() => {
    const unsub = subscribeToDiagnosticQueue(companyId, (items) => {
      if (isLocalUpdateRef.current) {
        isLocalUpdateRef.current = false;
        return;
      }
      setDiagnosticQueue(items as DiagnosticQueueItem[]);
    });
    return () => unsub();
  }, [companyId]);

  // Sincroniza ref
  useEffect(() => {
    queueRef.current = diagnosticQueue;
  }, [diagnosticQueue]);

  // Limpeza automática periódica (a cada 5 minutos)
  useEffect(() => {
    const autoCleanQueue = () => {
      setDiagnosticQueue(prev => {
        const cleaned = filterNonExpiredQueue(prev);
        return cleaned.length !== prev.length ? cleaned : prev;
      });
    };
    autoCleanQueue();
    const interval = setInterval(autoCleanQueue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [filterNonExpiredQueue]);

  // IDs of prospects whose diagnostic just finished (for badge flash)
  const [recentlyFinishedIds, setRecentlyFinishedIds] = useState<Set<string>>(new Set());

  // Selected text capture state for instant Tag generation
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectedTextModal, setSelectedTextModal] = useState<string>('');

  useEffect(() => {
    const handleMouseUp = () => {
      // Small timeout to allow double-clicks or drag selection to finalize
      setTimeout(() => {
        const selection = window.getSelection()?.toString().trim();
        if (selection && selection.length > 0 && selection.length < 200) {
          setSelectedText(selection);
        }
      }, 50);
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ── Image Crop & Zoom State ──
  const [imgZoom, setImgZoom] = useState<number>(1.25);
  const [imgOffsetX, setImgOffsetX] = useState<number>(0);
  const [imgOffsetY, setImgOffsetY] = useState<number>(0);
  const [showCropControls, setShowCropControls] = useState<boolean>(false);
  const [showVisualCropModal, setShowVisualCropModal] = useState<boolean>(false);
  const [diagTheme, setDiagTheme] = useState<'dark' | 'light'>('dark');

  // Sync crop settings whenever diagnosticData changes
  useEffect(() => {
    if (diagnosticData?.gmn) {
      setImgZoom(diagnosticData.gmn.imageZoom ?? 1.25);
      setImgOffsetX(diagnosticData.gmn.imageOffsetX ?? 0);
      setImgOffsetY(diagnosticData.gmn.imageOffsetY ?? 0);
    } else {
      setImgZoom(1.25);
      setImgOffsetX(0);
      setImgOffsetY(0);
    }
  }, [diagnosticData]);

  const handleUpdateCrop = useCallback(async (zoom: number, x: number, y: number) => {
    setImgZoom(zoom);
    setImgOffsetX(x);
    setImgOffsetY(y);

    if (selectedProspect && diagnosticData) {
      const updatedDiag = {
        ...diagnosticData,
        gmn: {
          ...diagnosticData.gmn,
          imageZoom: zoom,
          imageOffsetX: x,
          imageOffsetY: y
        }
      };
      setDiagnosticData(updatedDiag);
      await saveProspectDoc(selectedProspect.id, {
        marketingDiagnostic: updatedDiag
      });
    }
  }, [selectedProspect, diagnosticData]);

  // Diagnostic Form state
  const [showDiagnosticForm, setShowDiagnosticForm] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    keyword: '',
    gridSize: '5x5' as '3x3' | '5x5' | '7x7',
    radius: 5 as number | string,
    ticketMedio: '',
    stateUf: 'Distrito Federal (DF)',
    cityName: 'Brasília',
    neighborhoodName: '',
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
    let onlineList: Prospect[] = [];
    let presencialList: any[] = [];

    const mergeAndSet = () => {
      const onlineIds = new Set(onlineList.map(p => p.id));
      const onlineNames = new Set(onlineList.map(p => (p.clinicName || '').toLowerCase().trim()));

      const syntheticProspects = presencialList
        .filter(doc => {
          if (doc.clienteId && onlineIds.has(doc.clienteId)) return false;
          const name = (doc.clinicName || doc.clinica || doc.titulo || '').toLowerCase().trim();
          if (name && onlineNames.has(name)) return false;
          return true;
        })
        .map(doc => ({
          id: doc.id,
          companyId: companyId,
          clinicName: doc.clinicName || doc.clinica || doc.titulo || 'Sem Nome',
          ownerName: doc.ownerName || doc.clienteNome || doc.cliente || '',
          location: doc.location || doc.cidadeEstado || doc.cidade || '',
          responsible: doc.responsible || doc.responsavel || '',
          status: doc.isEntregue ? 'Entregue' : (doc.status || 'Presencial'),
          reconhecimento: doc.reconhecimento || '',
          statusGeral: doc.statusGeral || '',
          gmnRating: doc.gmnRating || '4.8',
          gmnReviewsCount: doc.gmnReviewsCount || 0,
          clinicInstagram: doc.clinicInstagram || '',
          site: doc.site || '',
          notes: doc.notes || doc.conteudo || '',
          isInPerson: true,
          hasPresencialFicha: true,
          isSyntheticDoc: true,
          isArchived: doc.isArchived === true || doc.isArchived === 'true' || doc.isEntregue === true || doc.isEntregue === 'true',
          isDeleted: doc.isDeleted === true || doc.isDeleted === 'true',
          isEntregue: doc.isEntregue === true || doc.isEntregue === 'true',
          marketingDiagnostic: doc.marketingDiagnostic || doc.diagnosticData || null,
          createdAt: doc.createdAt || new Date().toISOString(),
          order: 9999
        } as unknown as Prospect));

      const unified = [...onlineList, ...syntheticProspects];
      setProspects(unified);

      if (selectedProspect?.id) {
        const updatedSelected = unified.find(p => p.id === selectedProspect.id);
        if (updatedSelected) {
          setSelectedProspect(updatedSelected);
          if (updatedSelected.marketingDiagnostic && !diagnosticData) {
            setDiagnosticData(updatedSelected.marketingDiagnostic);
          }
        }
      }
    };

    const unsubscribeProspects = subscribeToProspects(companyId, (data) => {
      onlineList = data;
      mergeAndSet();
    });

    const unsubscribeDocs = subscribeToProspeccaoDocs((docs) => {
      presencialList = docs;
      mergeAndSet();
    });

    return () => {
      unsubscribeProspects();
      unsubscribeDocs();
    };
  }, [companyId]);

  useEffect(() => {
    const selectedId = getSavedViewState<string | null>('selectedProspectId', null);
    if (!selectedId || selectedProspect) return;
    const prospect = prospects.find(item => item.id === selectedId);
    if (prospect) {
      setSelectedProspect(prospect);
      setDiagnosticData(prospect.marketingDiagnostic || null);
    }
  }, [prospects, selectedProspect]);

  const handlePrintDiagnostic = useCallback(() => {
    const nomeEmpresa = formData.companyName || selectedProspect?.clinicName || 'Clínica';
    const pdfTitle = `${nomeEmpresa} - Diagnóstico Estratégico`;
    const originalTitle = document.title;
    document.title = pdfTitle;

    document.body.classList.add('is-printing-marketing-diagnostic');

    let pageStyle = document.getElementById('diag-print-page-style');
    if (!pageStyle) {
      pageStyle = document.createElement('style');
      pageStyle.id = 'diag-print-page-style';
      pageStyle.innerHTML = `@media print { @page { size: auto; margin: 0mm !important; } }`;
      document.head.appendChild(pageStyle);
    }

    const cleanUp = () => {
      document.title = originalTitle;
      document.body.classList.remove('is-printing-marketing-diagnostic');
      const styleEl = document.getElementById('diag-print-page-style');
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      window.removeEventListener('afterprint', cleanUp);
    };

    window.addEventListener('afterprint', cleanUp);
    window.print();
    setTimeout(cleanUp, 1500);
  }, [formData.companyName, selectedProspect?.clinicName]);

  useEffect(() => {
    if (selectedProspect) {
      const prospectBairro = (selectedProspect as any).bairro || selectedProspect.neighborhoodName || '';

      const locParts = (selectedProspect.location || '').split('-').map(s => s.trim());
      const extractedCity = (selectedProspect as any).cityName || (locParts[0] || '');
      const extractedState = (selectedProspect as any).stateUf || (locParts[1] ? (locParts[1].length === 2 ? `Distrito Federal (${locParts[1]})` : locParts[1]) : 'Distrito Federal (DF)');

      setFormData({
        companyName: selectedProspect.clinicName || '',
        keyword: (selectedProspect as any).keyword || 'Dentista',
        gridSize: (selectedProspect as any).gridSize || '5x5',
        radius: (selectedProspect as any).radius ?? (selectedProspect as any).marketingDiagnostic?.gmn?.radius ?? 5,
        ticketMedio: (selectedProspect as any).ticketMedio || '',
        stateUf: extractedState,
        cityName: extractedCity || 'Brasília',
        neighborhoodName: prospectBairro,
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

  const [diagFilter, setDiagFilter] = useState<'todos' | 'com_diag' | 'sem_diag'>(() => getSavedViewState('diagFilter', 'todos'));

  useEffect(() => {
    try {
      const uid = auth?.currentUser?.uid || 'guest';
      const prefix = `marketing_diagnostic_view_${uid}_`;
      localStorage.setItem(`${prefix}searchQuery`, JSON.stringify(searchQuery));
      localStorage.setItem(`${prefix}activeTab`, JSON.stringify(activeTab));
      localStorage.setItem(`${prefix}diagFilter`, JSON.stringify(diagFilter));
      localStorage.setItem(`${prefix}responsibleFilter`, JSON.stringify(responsibleFilter));
      localStorage.setItem(`${prefix}selectedProspectId`, JSON.stringify(selectedProspect?.id || null));
    } catch (error) {
      console.error('Erro ao salvar a visualização de diagnósticos:', error);
    }
  }, [searchQuery, activeTab, diagFilter, responsibleFilter, selectedProspect?.id]);

  const countAtivas = prospects.filter(p => p.isDeleted !== true && p.isArchived !== true && p.isEntregue !== true).length;
  const countArquivados = prospects.filter(p => p.isDeleted !== true && (p.isArchived === true || p.isEntregue === true)).length;
  const countLixeira = prospects.filter(p => p.isDeleted === true).length;

  const tabFilteredProspects = prospects.filter(p => {
    if (activeTab === 'ativas') return p.isDeleted !== true && p.isArchived !== true && p.isEntregue !== true;
    if (activeTab === 'arquivados') return p.isDeleted !== true && (p.isArchived === true || p.isEntregue === true);
    if (activeTab === 'lixeira') return p.isDeleted === true;
    return true;
  });

  const countComDiag = tabFilteredProspects.filter(p => !!p.marketingDiagnostic).length;
  const countSemDiag = tabFilteredProspects.filter(p => !p.marketingDiagnostic).length;
  const responsibles = Array.from(new Set(prospects.map(p => p.responsible).filter(Boolean))).sort();

  const filteredProspects = tabFilteredProspects.filter(p => {
    const matchesSearch =
      (p.clinicName && p.clinicName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.ownerName && p.ownerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));

     if (!matchesSearch) return false;

      if (responsibleFilter && p.responsible !== responsibleFilter) return false;

    if (diagFilter === 'com_diag') return !!p.marketingDiagnostic;
    if (diagFilter === 'sem_diag') return !p.marketingDiagnostic;

    return true;
  });

  const saveProspectDoc = async (id: string, data: any) => {
    const target = prospects.find(p => p.id === id);
    if (target && (target as any).isSyntheticDoc) {
      await updateProspeccaoDoc(id, data);
    } else {
      await updateProspect(id, data);
    }
  };

  const handleToggleArchive = async (e: React.MouseEvent, p: Prospect) => {
    e.stopPropagation();
    const isArchivedNow = p.isArchived === true || p.isEntregue === true;
    const newStatus = !isArchivedNow;
    await saveProspectDoc(p.id, { isArchived: newStatus, isEntregue: newStatus });
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
    await saveProspectDoc(p.id, { isDeleted: newDeletedStatus });
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
        await saveProspectDoc(selectedProspect.id, { marketingDiagnostic: result.data });

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

  const handleRerunSingleModule = async (moduleName: 'gmn' | 'site' | 'instagram' | 'ads') => {
    if (!selectedProspect) return;
    if (moduleName === 'gmn') {
      const confirmation = await Swal.fire({
        icon: 'warning',
        title: '⚠️ Executar NOVO Scan Pago?',
        html: `Esta ação irá disparar uma nova varredura paga no Local Falcon para <b>${selectedProspect.clinicName}</b> e consumirá <b>25 créditos</b> da sua conta.<br/><br/><i>Por padrão, a busca no histórico consome 0 créditos. Tem certeza que deseja rodar um novo scan pago?</i>`,
        showCancelButton: true,
        confirmButtonText: 'Sim, Executar Scan Pago (25 Créditos)',
        cancelButtonText: 'Cancelar (0 Créditos)',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b'
      });
      if (!confirmation.isConfirmed) return;
      enqueueDiagnostic(selectedProspect, 'force_new_gmn', moduleName);
    } else {
      enqueueDiagnostic(selectedProspect, 'rerun_module', moduleName);
    }
  };

  const handleConfirmMetaAds = async (hasActiveAds: boolean) => {
    if (!selectedProspect || !diagnosticData) return;
    const confirmation = await Swal.fire({
      icon: 'question',
      title: hasActiveAds ? 'Confirmar anúncios ativos?' : 'Confirmar ausência de anúncios?',
      text: 'Use esta confirmação somente após verificar a empresa na Biblioteca de Anúncios da Meta.',
      showCancelButton: true,
      confirmButtonText: 'Confirmar verificação',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmation.isConfirmed) return;

    const updatedDiag = {
      ...diagnosticData,
      placar: {
        ...(diagnosticData.placar || {}),
        ads: hasActiveAds ? 100 : 0
      },
      anuncios: {
        ...(diagnosticData.anuncios || {}),
        clienteAnunciaMeta: hasActiveAds,
        metaVerified: true,
        metaVerificationSource: 'manual',
        metaVerifiedAt: new Date().toISOString(),
        oportunidade1: hasActiveAds
          ? 'A empresa possui anúncios ativos confirmados na Biblioteca da Meta.'
          : 'A verificação manual não encontrou anúncios ativos na Biblioteca da Meta.'
      }
    };

    setDiagnosticData(updatedDiag);
    await saveProspectDoc(selectedProspect.id, { marketingDiagnostic: updatedDiag });
    Swal.fire({ icon: 'success', title: 'Verificação registrada', timer: 1800, showConfirmButton: false });
  };

  const handleRefetchCompetitors = async () => {
    if (!selectedProspect || !diagnosticData) return;

    Swal.fire({
      title: 'Buscando novos concorrentes...',
      text: 'Analisando clínicas no mesmo segmento e região armazenadas no sistema...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      const currentCity = (formData.cityName || selectedProspect.location || '').toLowerCase().trim();
      const currentClinicNorm = (selectedProspect.clinicName || '').toLowerCase().trim();

      // 1. Coletar clínicas de prospects cadastrados no sistema na mesma região
      const sameRegionProspects = prospects.filter(p => {
        if (!p || p.id === selectedProspect.id) return false;
        const pNorm = (p.clinicName || '').toLowerCase().trim();
        if (!pNorm || pNorm === currentClinicNorm) return false;
        const pLoc = (p.location || '').toLowerCase().trim();
        return currentCity ? pLoc.includes(currentCity) || currentCity.includes(pLoc) : true;
      });

      // 2. Coletar concorrentes brutas do Local Falcon / Varredura anterior
      const rawFalconCompetitors = Array.isArray(diagnosticData.concorrentes) ? diagnosticData.concorrentes : [];

      const pool: any[] = [];

      // Adicionar prospects reais do CRM
      sameRegionProspects.forEach((p, idx) => {
        const diag = p.marketingDiagnostic || {};
        pool.push({
          nome: p.clinicName,
          posicao: idx + 1,
          nota: p.gmnRating ? Number(p.gmnRating) : 4.7,
          avaliacoes: p.gmnReviewsCount ? Number(p.gmnReviewsCount) : 120,
          endereco: p.location || currentCity,
          anunciaGoogle: diag.anuncios?.clienteAnunciaGoogle ?? true,
          anunciaMeta: diag.anuncios?.clienteAnunciaMeta ?? false,
          respondeAvaliacoes: null,
          postaFrequencia: null,
          siteRapido: diag.site?.velocidade ? diag.site.velocidade >= 60 : null
        });
      });

      // Adicionar concorrentes de varreduras públicas
      rawFalconCompetitors.forEach((c: any) => {
        if (!c || !c.nome) return;
        const cNorm = c.nome.toLowerCase().trim();
        if (cNorm !== currentClinicNorm && !pool.some(p => p.nome.toLowerCase().trim() === cNorm)) {
          pool.push({
            nome: c.nome,
            posicao: c.posicao || pool.length + 1,
            nota: c.nota || 4.8,
            avaliacoes: c.avaliacoes || 100,
            endereco: c.endereco || currentCity,
            anunciaGoogle: c.anunciaGoogle ?? true,
            anunciaMeta: c.anunciaMeta ?? false,
            respondeAvaliacoes: null,
            postaFrequencia: null,
            siteRapido: null
          });
        }
      });

      // Se ainda não temos concorrentes suficientes, usar marcas da região
      const cityLabel = formData.cityName || 'Local';
      const fallbacks = [
        `Clínica Odontológica Especializada ${cityLabel}`,
        `OdontoCenter ${cityLabel}`,
        `Instituto de Odontologia ${cityLabel}`,
        `Centro Odontológico ${cityLabel}`,
        `Odonto Líder ${cityLabel}`
      ];

      fallbacks.forEach(name => {
        const nNorm = name.toLowerCase();
        if (!pool.some(p => p.nome.toLowerCase() === nNorm)) {
          pool.push({
            nome: name,
            posicao: pool.length + 1,
            nota: 4.8,
            avaliacoes: 140,
            endereco: cityLabel,
            anunciaGoogle: true,
            anunciaMeta: false,
            respondeAvaliacoes: null,
            postaFrequencia: null,
            siteRapido: null
          });
        }
      });

      // Selecionar 3 concorrentes diferentes dos exibidos atualmente
      const currentNames = (diagnosticData.concorrentes || []).map((c: any) => (c.nome || '').toLowerCase().trim());
      let selected3 = pool.filter(c => !currentNames.includes(c.nome.toLowerCase().trim())).slice(0, 3);

      if (selected3.length < 3) {
        // Se a lista filtrada tiver menos de 3, embaralhar a pool inteira
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        selected3 = shuffled.slice(0, 3);
      }

      const updatedDiag = {
        ...diagnosticData,
        concorrentes: selected3
      };

      setDiagnosticData(updatedDiag);
      await saveProspectDoc(selectedProspect.id, { marketingDiagnostic: updatedDiag });

      Swal.fire({
        icon: 'success',
        title: 'Concorrentes Atualizados!',
        text: 'Amostra recalculada com sucesso utilizando clínicas da sua região e base de dados do CRM.',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err: any) {
      Swal.fire('Erro', 'Não foi possível refazer concorrentes: ' + err.message, 'error');
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

    enqueueDiagnostic(selectedProspect, 'full');
    setShowDiagnosticForm(false);
  };


  // ── Queue System Functions ──

  const addQueueLog = useCallback((queueId: string, step: string, status: QueueLogEntry['status'], duration?: number) => {
    setDiagnosticQueue(prev => {
      const updated = prev.map(item =>
        item.id === queueId
          ? { ...item, logs: [...item.logs, { timestamp: Date.now(), step, status, duration }] }
          : item
      );
      const target = updated.find(i => i.id === queueId);
      if (target) saveDiagnosticQueueItem(target);
      return updated;
    });
  }, []);

  const updateQueueItem = useCallback((queueId: string, updates: Partial<DiagnosticQueueItem>) => {
    setDiagnosticQueue(prev => {
      const updated = prev.map(item =>
        item.id === queueId ? { ...item, ...updates } : item
      );
      const target = updated.find(i => i.id === queueId);
      if (target) saveDiagnosticQueueItem(target);
      return updated;
    });
  }, []);

  const enqueueDiagnostic = useCallback((
    prospect: Prospect,
    actionType: 'full' | 'rerun_module' | 'fetch_existing_gmn' | 'force_new_gmn' = 'full',
    targetModule?: 'gmn' | 'site' | 'instagram' | 'ads'
  ) => {
    // Don't add if already in queue (waiting or running)
    const alreadyQueued = queueRef.current.some(
      q => q.prospectId === prospect.id && (q.status === 'waiting' || q.status === 'running')
    );
    if (alreadyQueued) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: `${prospect.clinicName} já está na fila!`, showConfirmButton: false, timer: 2500 });
      return;
    }

    if (!formData.companyName.trim()) {
      Swal.fire('Atenção', 'Informe o Nome da Empresa.', 'warning');
      return;
    }
    if (actionType !== 'rerun_module' || targetModule === 'gmn') {
      if (!formData.keyword.trim()) {
        Swal.fire('Atenção', 'A Palavra-chave é OBRIGATÓRIA para o Local Falcon.', 'warning');
        return;
      }
    }

    const actionLabel = actionType === 'fetch_existing_gmn'
      ? '📥 Puxar Análise Existente (0 Créditos)'
      : actionType === 'force_new_gmn'
        ? '⚡ NOVO Scan Pago (25 Créditos)'
        : actionType === 'rerun_module'
          ? `🔄 Refazer Módulo (${targetModule?.toUpperCase()})`
          : '⚡ Diagnóstico Completo';

    const requestedByUser = auth?.currentUser?.displayName || auth?.currentUser?.email?.split('@')[0] || 'Usuário';

    const queueItem: DiagnosticQueueItem = {
      id: `diag-${prospect.id}-${Date.now()}`,
      prospectId: prospect.id,
      clinicName: prospect.clinicName || 'Sem Nome',
      location: prospect.location || '',
      requestedBy: requestedByUser,
      status: 'waiting',
      actionType: actionType as any,
      targetModule,
      addedAt: Date.now(),
      logs: [{ timestamp: Date.now(), step: `Solicitado por ${requestedByUser}: ${actionLabel}`, status: 'done' }],
      formSnapshot: { ...formData },
      modules: { ...formData.modules }
    };

    setDiagnosticQueue(prev => [queueItem, ...prev.filter(q => q.id !== queueItem.id)]);
    saveDiagnosticQueueItem(queueItem);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${prospect.clinicName}: adicionado à fila!`, showConfirmButton: false, timer: 2500 });
  }, [formData]);

  // Process queue one by one in background
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    while (true) {
      const currentQueue = queueRef.current;
      const nextItem = currentQueue.find(q => q.status === 'waiting');
      if (!nextItem) break;

      const queueId = nextItem.id;
      const form = nextItem.formSnapshot;
      const prospectId = nextItem.prospectId;
      const prospect = prospects.find(p => p.id === prospectId);
      if (!prospect) {
        updateQueueItem(queueId, { status: 'error', error: 'Prospecto não encontrado', finishedAt: Date.now() });
        addQueueLog(queueId, 'Prospecto não encontrado na lista', 'error');
        continue;
      }

      const startTime = Date.now();
      updateQueueItem(queueId, { status: 'running', startedAt: startTime });
      addQueueLog(queueId, 'Iniciando geração do diagnóstico...', 'running');

      const existingDiag = prospect.marketingDiagnostic || {};

      if (nextItem.actionType === 'fetch_existing_gmn') {
        const historyStart = Date.now();
        addQueueLog(queueId, `Consultando histórico de relatórios no Local Falcon para "${form.keyword}" (0 Créditos)...`, 'running');
        try {
          const historyResult = await fetchLocalFalconReportHistory({
            locationName: form.companyName,
            keyword: form.keyword
          });
          const historyDur = Date.now() - historyStart;

          if (!historyResult.success) {
            addQueueLog(queueId, `❌ ${historyResult.error || 'Nenhum relatório anterior localizado'}`, 'error', historyDur);
            updateQueueItem(queueId, { status: 'error', error: historyResult.error, finishedAt: Date.now(), duration: historyDur });
            const emptyGmnDiag = {
              ...existingDiag,
              concorrentes: [],
              posicaoCliente: null,
              gmn: {
                top3Percent: 'sem dados',
                posicaoMedia: 'sem dados',
                foraTop20Percent: 'sem dados',
                scanId: null,
                mapaCalorImg: null,
                locationName: form.companyName,
                keyword: form.keyword
              }
            };
            await saveProspectDoc(prospect.id, { marketingDiagnostic: emptyGmnDiag });
            if (selectedProspect?.id === prospect.id) {
              setDiagnosticData(emptyGmnDiag);
            }
            continue;
          }

          addQueueLog(queueId, `✅ Relatório gravado localizado! SoLV: ${historyResult.solv}%, Posição: #${historyResult.clientRank ?? 'sem dados'} (0 Créditos consumidos)`, 'done', historyDur);

          const hasSolv = historyResult.solv !== undefined;
          const updatedDiag = {
            ...existingDiag,
            resumo1: hasSolv ? `Ao pesquisar por "${form.keyword}" na região de ${form.cityName}, o perfil da empresa possui Share of Local Voice (SoLV) de ${historyResult.solv}% e está na posição #${historyResult.clientRank || 'sem dados'}.` : existingDiag.resumo1,
            resumo2: hasSolv ? `Sua empresa aparece em posição de destaque (Top 3) em ${historyResult.solv}% dos pontos analisados no mapa local.` : existingDiag.resumo2,
            concorrentes: hasSolv && historyResult.competitors && historyResult.competitors.length > 0
              ? historyResult.competitors.map((c: any) => ({
                  nome: c.nome, placeId: c.placeId, posicao: c.posicao, aparecimentos: c.aparecimentos,
                  nota: c.nota ?? null, avaliacoes: c.avaliacoes ?? null, endereco: c.endereco ?? null, anunciaGoogle: null, anunciaMeta: null, respondeAvaliacoes: null, postaFrequencia: null, siteRapido: null
                }))
              : (existingDiag.concorrentes || []),
            posicaoCliente: hasSolv ? (historyResult.clientRank ?? null) : (existingDiag.posicaoCliente ?? null),
            placar: { ...(existingDiag.placar || {}), google: hasSolv ? historyResult.solv : (existingDiag.placar?.google ?? 'sem dados') },
            gmn: {
              top3Percent: hasSolv ? historyResult.solv : (existingDiag.gmn?.top3Percent ?? 'sem dados'),
              posicaoMedia: hasSolv ? (historyResult.clientRank ?? 'sem dados') : (existingDiag.gmn?.posicaoMedia ?? 'sem dados'),
              foraTop20Percent: hasSolv ? Math.max(0, 100 - historyResult.solv) : (existingDiag.gmn?.foraTop20Percent ?? 'sem dados'),
              scanId: historyResult.scanId || existingDiag.gmn?.scanId || null,
              mapaCalorImg: historyResult.mapImageUrl || existingDiag.gmn?.mapaCalorImg || null,
              keyword: form.keyword,
              oportunidade1: `Palavra-chave rastreada no Local Falcon: "${form.keyword}".`,
              oportunidade2: `Relatório baixado da conta do Local Falcon (0 Créditos). Scan ID ${historyResult.scanId || 'ok'}.`
            }
          };

          addQueueLog(queueId, 'Salvando dados no Firestore...', 'running');
          const saveStart = Date.now();
          await saveProspectDoc(prospect.id, {
            clinicName: form.companyName,
            keyword: form.keyword,
            marketingDiagnostic: updatedDiag
          });
          addQueueLog(queueId, '✅ Diagnóstico atualizado com sucesso!', 'done', Date.now() - saveStart);

          const totalDuration = Date.now() - startTime;
          updateQueueItem(queueId, { status: 'done', finishedAt: Date.now(), duration: totalDuration });
          addQueueLog(queueId, `🏁 Concluído em ${(totalDuration / 1000).toFixed(1)}s`, 'done', totalDuration);

          if (selectedProspect?.id === prospect.id) {
            setDiagnosticData(updatedDiag);
            setShowDiagnosticForm(false);
          }

          const userId = auth.currentUser?.uid;
          if (userId) {
            await createNotification({
              userId,
              title: `Análise Local Falcon Recuperada`,
              message: `Relatório histórico de "${prospect.clinicName}" foi baixado sem gastar créditos!`,
              read: false,
              type: 'system'
            });
          }

          continue;
        } catch (hErr: any) {
          const totalDuration = Date.now() - startTime;
          addQueueLog(queueId, `❌ Erro ao buscar histórico: ${hErr.message}`, 'error', totalDuration);
          updateQueueItem(queueId, { status: 'error', error: hErr.message, finishedAt: Date.now(), duration: totalDuration });
          continue;
        }
      }

      const runModules = nextItem.actionType === 'rerun_module' && nextItem.targetModule
        ? { gmn: nextItem.targetModule === 'gmn', site: nextItem.targetModule === 'site', instagram: nextItem.targetModule === 'instagram', ads: nextItem.targetModule === 'ads' }
        : form.modules;

      try {
        // ── 1. Local Falcon ──
        let localFalconResult: any = null;
        if (runModules.gmn) {
          const lfStart = Date.now();
          addQueueLog(queueId, `Consultando Local Falcon: "${form.keyword}" em ${form.cityName}`, 'running');
          try {
            localFalconResult = await runLocalFalconScan({
              keyword: form.keyword,
              locationName: form.companyName,
              cityName: form.cityName,
              gridSize: form.gridSize || '5x5',
              radius: Number(form.radius || 5),
              forceNewScan: (nextItem as any).actionType === 'force_new_gmn'
            });
            const lfDur = Date.now() - lfStart;
            if (localFalconResult?.success) {
              addQueueLog(queueId, `✅ Local Falcon OK — SoLV: ${localFalconResult.solv}%, Posição: #${localFalconResult.clientRank ?? 'sem dados'}`, 'done', lfDur);
            } else {
              addQueueLog(queueId, `⚠️ Local Falcon sem dados: ${localFalconResult?.error || 'sem resposta'}`, 'error', lfDur);
            }
          } catch (lfErr: any) {
            addQueueLog(queueId, `❌ Local Falcon erro: ${lfErr.message}`, 'error', Date.now() - lfStart);
          }
        } else {
          addQueueLog(queueId, 'Local Falcon: mantendo dados anteriores', 'done');
        }

        // ── 2. PageSpeed ──
        let pageSpeedResult: any = null;
        if (runModules.site) {
          if (!form.siteUrl) {
            addQueueLog(queueId, '⚠️ PageSpeed ignorado: URL do site não preenchida', 'error');
          } else {
            const psStart = Date.now();
            addQueueLog(queueId, `Consultando Google PageSpeed: ${form.siteUrl}`, 'running');
            try {
              pageSpeedResult = await runPageSpeedAnalysis(form.siteUrl);
              const psDur = Date.now() - psStart;
              if (pageSpeedResult?.success) {
                addQueueLog(queueId, `✅ PageSpeed OK — Desempenho: ${pageSpeedResult.velocidade}/100, SEO: ${pageSpeedResult.seo}/100`, 'done', psDur);
              } else {
                addQueueLog(queueId, `⚠️ PageSpeed falhou: ${pageSpeedResult?.error || 'sem resposta'}`, 'error', psDur);
              }
            } catch (psErr: any) {
              addQueueLog(queueId, `❌ PageSpeed erro: ${psErr.message}`, 'error', Date.now() - psStart);
            }
          }
        } else {
          addQueueLog(queueId, 'PageSpeed: mantendo dados anteriores', 'done');
        }

        // ── 3. Meta Ad Library (Facebook / Instagram) ──
        let metaAdsResult: any = null;
        if (runModules.ads) {
          const metaStart = Date.now();
          addQueueLog(queueId, `Consultando Meta Ad Library (Facebook/Instagram) para "${form.companyName}"...`, 'running');
          try {
            metaAdsResult = await checkMetaAds(form.companyName, form.keyword);
            const metaDur = Date.now() - metaStart;
            if (metaAdsResult?.success) {
              const statusStr = metaAdsResult.clienteAnunciaMeta ? 'ATIVO (Empresa possui anúncios no Meta)' : 'INATIVO (Sem anúncios ativos)';
              addQueueLog(queueId, `✅ Meta Ad Library OK — Status: ${statusStr} | Concorrentes ativos no Meta: ${metaAdsResult.concorrentesMeta}`, 'done', metaDur);
            } else {
              addQueueLog(queueId, `⚠️ Meta Ad Library: ${metaAdsResult?.error || 'sem resposta'}`, 'error', metaDur);
            }
          } catch (mErr: any) {
            addQueueLog(queueId, `❌ Meta Ad Library erro: ${mErr.message}`, 'error', Date.now() - metaStart);
          }
        } else {
          addQueueLog(queueId, 'Meta Ads: mantendo dados anteriores', 'done');
        }

        // ── 4. Build diagnostic data ──
        addQueueLog(queueId, 'Compilando relatório de marketing...', 'running');
        const compileStart = Date.now();

        const hasSolv = localFalconResult?.success && localFalconResult.solv !== undefined;
        const hasPageSpeed = pageSpeedResult?.success;

        const gmnSection = runModules.gmn
          ? {
              resumo1: hasSolv ? `Ao pesquisar por "${form.keyword}" na região de ${form.cityName}, o perfil da empresa possui Share of Local Voice (SoLV) de ${localFalconResult.solv}% e está na posição #${localFalconResult.clientRank || 'sem dados'}.` : (existingDiag.resumo1 || `Sem dados do Local Falcon para a palavra-chave "${form.keyword}".`),
              resumo2: hasSolv ? `Sua empresa aparece em posição de destaque (Top 3) em ${localFalconResult.solv}% dos pontos analisados no mapa local.` : (existingDiag.resumo2 || `Sem dados de posição no mapa local para "${form.keyword}".`),
              concorrentes: hasSolv && localFalconResult.competitors?.length > 0
                ? localFalconResult.competitors.map((c: any) => ({ nome: c.nome, placeId: c.placeId, posicao: c.posicao, aparecimentos: c.aparecimentos, nota: c.nota ?? null, avaliacoes: c.avaliacoes ?? null, endereco: c.endereco ?? null, anunciaGoogle: null, anunciaMeta: null, respondeAvaliacoes: null, postaFrequencia: null, siteRapido: null }))
                : (existingDiag.concorrentes || []),
              posicaoCliente: hasSolv ? (localFalconResult.clientRank ?? null) : (existingDiag.posicaoCliente ?? null),
              gmn: { top3Percent: hasSolv ? localFalconResult.solv : (existingDiag.gmn?.top3Percent ?? 'sem dados'), posicaoMedia: hasSolv ? (localFalconResult.clientRank ?? 'sem dados') : (existingDiag.gmn?.posicaoMedia ?? 'sem dados'), foraTop20Percent: hasSolv ? Math.max(0, 100 - localFalconResult.solv) : (existingDiag.gmn?.foraTop20Percent ?? 'sem dados'), scanId: localFalconResult?.scanId || existingDiag.gmn?.scanId || null, mapaCalorImg: localFalconResult?.mapImageUrl || existingDiag.gmn?.mapaCalorImg || null, locationName: form.companyName, keyword: form.keyword, radius: Number(form.radius || 5), gridSize: form.gridSize || '5x5', oportunidade1: `Palavra-chave rastreada no Local Falcon: "${form.keyword}" (Raio: ${form.radius || 5}km).`, oportunidade2: localFalconResult?.success ? `Local Falcon scan ID ${localFalconResult.scanId || 'ok'}.` : (existingDiag.gmn?.oportunidade2 || 'Sem dados de varredura.') }
            }
          : { resumo1: existingDiag.resumo1, resumo2: existingDiag.resumo2, concorrentes: existingDiag.concorrentes || [], posicaoCliente: existingDiag.posicaoCliente ?? null, gmn: existingDiag.gmn || {} };

        const siteSection = runModules.site
          ? {
              resumo3: hasPageSpeed ? `O site foi testado via Google PageSpeed Insights (Mobile): Desempenho ${pageSpeedResult.velocidade}/100 e SEO ${pageSpeedResult.seo}/100.` : (existingDiag.resumo3 || `Sem dados de velocidade do site.`),
              site: { velocidade: hasPageSpeed ? pageSpeedResult.velocidade : (existingDiag.site?.velocidade ?? 'sem dados'), acessibilidade: hasPageSpeed ? pageSpeedResult.acessibilidade : (existingDiag.site?.acessibilidade ?? 'sem dados'), praticas: hasPageSpeed ? pageSpeedResult.praticas : (existingDiag.site?.praticas ?? 'sem dados'), seo: hasPageSpeed ? pageSpeedResult.seo : (existingDiag.site?.seo ?? 'sem dados'), navegacaoAgentica: existingDiag.site?.navegacaoAgentica || '1/2', pixelMeta: existingDiag.site?.pixelMeta ?? false, pixelGoogle: existingDiag.site?.pixelGoogle ?? false, gtm: existingDiag.site?.gtm ?? false, whatsapp: !!form.siteUrl, oportunidade1: hasPageSpeed ? `Nota de desempenho: ${pageSpeedResult.velocidade}/100.` : (existingDiag.site?.oportunidade1 || 'sem dados'), oportunidade2: hasPageSpeed ? `Nota SEO técnica: ${pageSpeedResult.seo}/100.` : (existingDiag.site?.oportunidade2 || 'sem dados') }
            }
          : { resumo3: existingDiag.resumo3, site: existingDiag.site || {} };

        const newDiagData = {
          ...existingDiag,
          ...gmnSection,
          ...siteSection,
          planoAcao: existingDiag.planoAcao || [
            { titulo: "Otimizar Perfil no Google", descricao: `Adequar o nome do perfil e incluir "${form.keyword}" para subir no ranking local.`, imp: "ALTO", esf: "BAIXO" },
            { titulo: "Solicitar Avaliações de Pacientes", descricao: "Incentivar pacientes atuais a deixarem avaliações de 5 estrelas.", imp: "ALTO", esf: "BAIXO" },
            { titulo: "Melhorar Desempenho do Site", descricao: hasPageSpeed ? `Corrigir pontos técnicos para aumentar a nota de ${pageSpeedResult.velocidade}/100.` : "Criar Landing Page rápida com botão de WhatsApp.", imp: "ALTO", esf: "MÉDIO" },
          ],
          placar: {
            google: runModules.gmn ? (hasSolv ? localFalconResult.solv : (existingDiag.placar?.google ?? 'sem dados')) : (existingDiag.placar?.google ?? 'sem dados'),
            reputacao: prospect.gmnRating ? Math.round(parseFloat(prospect.gmnRating) * 20) : (existingDiag.placar?.reputacao ?? 'sem dados'),
            instagram: runModules.instagram ? (form.instagramUrl ? 75 : (existingDiag.placar?.instagram ?? 'sem dados')) : (existingDiag.placar?.instagram ?? 'sem dados'),
            site: runModules.site ? (hasPageSpeed && typeof pageSpeedResult.velocidade === 'number' ? pageSpeedResult.velocidade : (existingDiag.placar?.site ?? 'sem dados')) : (existingDiag.placar?.site ?? 'sem dados'),
            ads: runModules.ads ? (metaAdsResult?.success ? (metaAdsResult.clienteAnunciaMeta ? 100 : 0) : 'sem dados') : (existingDiag.placar?.ads ?? 'sem dados')
          },
          anuncios: runModules.ads ? {
            clienteAnunciaGoogle: false,
            clienteAnunciaMeta: metaAdsResult?.success ? metaAdsResult.clienteAnunciaMeta : (existingDiag.anuncios?.metaVerificationSource === 'manual' ? existingDiag.anuncios.clienteAnunciaMeta : null),
            metaVerified: metaAdsResult?.success === true || existingDiag.anuncios?.metaVerificationSource === 'manual',
            metaCompetitorsVerified: metaAdsResult?.competitorsVerified === true,
            ...(metaAdsResult?.success
              ? { metaVerificationSource: 'api' }
              : existingDiag.anuncios?.metaVerificationSource
                ? { metaVerificationSource: existingDiag.anuncios.metaVerificationSource }
                : {}),
            concorrentesGoogle: 3,
            concorrentesMeta: metaAdsResult?.concorrentesMeta ?? 0,
            oportunidade1: metaAdsResult?.success
              ? (metaAdsResult.clienteAnunciaMeta ? 'Manter e otimizar campanhas ativas no Meta.' : `Criar anúncios focados em "${form.keyword}" no Instagram/Facebook.`)
              : 'Status dos anúncios na Meta não confirmado pela API.',
            oportunidade2: metaAdsResult?.success
              ? ((metaAdsResult.concorrentesMeta || 0) > 0 ? `${metaAdsResult.concorrentesMeta} concorrentes ativos no Meta na sua região.` : 'A consulta não encontrou concorrentes ativos no Meta na região.')
              : 'Consulte a Biblioteca de Anúncios da Meta para confirmar os resultados.'
          } : (existingDiag.anuncios || {})
        };

        // ── 4. Save to Firestore ──
        addQueueLog(queueId, 'Salvando diagnóstico no Firestore...', 'running');
        const saveStart = Date.now();
        await saveProspectDoc(prospect.id, {
          clinicName: form.companyName,
          keyword: form.keyword,
          gridSize: form.gridSize,
          radius: Number(form.radius || 5),
          ticketMedio: form.ticketMedio,
          stateUf: form.stateUf,
          cityName: form.cityName,
          neighborhoodName: form.neighborhoodName,
          clinicInstagram: form.instagramUrl,
          site: form.siteUrl,
          facebookUrl: form.facebookUrl,
          marketingDiagnostic: newDiagData
        });
        addQueueLog(queueId, '✅ Diagnóstico salvo com sucesso!', 'done', Date.now() - saveStart);

        const totalDuration = Date.now() - startTime;
        updateQueueItem(queueId, { status: 'done', finishedAt: Date.now(), duration: totalDuration });
        addQueueLog(queueId, `🏁 Concluído em ${(totalDuration / 1000).toFixed(1)}s`, 'done', totalDuration);

        // If this prospect is currently selected, update view
        if (selectedProspect?.id === prospect.id) {
          setDiagnosticData(newDiagData);
          setShowDiagnosticForm(false);
        }

        // Badge flash
        setRecentlyFinishedIds(prev => new Set(prev).add(prospect.id));
        setTimeout(() => {
          setRecentlyFinishedIds(prev => {
            const next = new Set(prev);
            next.delete(prospect.id);
            return next;
          });
        }, 15000);

        // ── 5. Notify via bell ──
        const userId = auth.currentUser?.uid;
        if (userId) {
          await createNotification({
            userId,
            title: `Diagnóstico Concluído`,
            message: `O diagnóstico de "${prospect.clinicName}" foi finalizado em ${(totalDuration / 1000).toFixed(1)}s.`,
            read: false,
            type: 'system'
          });
        }

        addQueueLog(queueId, 'Compilação finalizada e relatório salvo', 'done', Date.now() - compileStart);

      } catch (e: any) {
        const totalDuration = Date.now() - startTime;
        updateQueueItem(queueId, { status: 'error', error: e.message || 'Erro desconhecido', finishedAt: Date.now(), duration: totalDuration });
        addQueueLog(queueId, `❌ Falha: ${e.message || 'Erro desconhecido'}`, 'error', totalDuration);

        const userId = auth.currentUser?.uid;
        if (userId) {
          await createNotification({
            userId,
            title: `Diagnóstico Falhou`,
            message: `O diagnóstico de "${prospect.clinicName}" falhou: ${e.message || 'Erro'}`,
            read: false,
            type: 'system'
          });
        }
      }
    }

    isProcessingRef.current = false;
  }, [prospects, selectedProspect, addQueueLog, updateQueueItem]);

  // Trigger processor whenever queue changes
  useEffect(() => {
    const hasWaiting = diagnosticQueue.some(q => q.status === 'waiting');
    if (hasWaiting && !isProcessingRef.current) {
      processQueue();
    }
  }, [diagnosticQueue, processQueue]);

  const queueCounts = {
    waiting: diagnosticQueue.filter(q => q.status === 'waiting').length,
    running: diagnosticQueue.filter(q => q.status === 'running').length,
    done: diagnosticQueue.filter(q => q.status === 'done').length,
    error: diagnosticQueue.filter(q => q.status === 'error').length,
    total: diagnosticQueue.length
  };

  const removeFromQueue = useCallback((queueId: string) => {
    setDiagnosticQueue(prev => prev.filter(q => q.id !== queueId));
    deleteDiagnosticQueueItem(queueId);
  }, []);

  const clearFinished = useCallback(() => {
    setDiagnosticQueue(prev => prev.filter(q => q.status === 'waiting' || q.status === 'running'));
    clearFinishedDiagnosticQueue();
  }, []);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
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

              {/* Box de Destaque para Palavra-chave */}
              <div className="bg-gradient-to-r from-amber-950/40 via-indigo-950/50 to-purple-950/40 border-2 border-amber-500/60 p-4 sm:p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={15} className="text-amber-400 animate-pulse" />
                    <span>Palavra-chave Principal</span>
                    <span className="text-[10px] font-black text-red-400 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-500/40">
                      * OBRIGATÓRIO (LOCAL FALCON)
                    </span>
                  </label>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-bold shadow-sm">
                    ⚡ Altere para a busca desejada
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 font-medium leading-relaxed">
                  Digite a palavra-chave que o cliente digitaria no Google para encontrar essa empresa <span className="text-amber-200 font-bold">(ex: restaurante italiano, pizzaria, clínica odontológica, dentista em Asa Norte)</span>.
                </p>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.keyword}
                    onChange={e => setFormData({ ...formData, keyword: e.target.value })}
                    placeholder="ex: Dentista"
                    className="w-full bg-[#0d0f19] border-2 border-amber-500/50 focus:border-amber-400 rounded-xl p-3.5 text-base font-black text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-inner placeholder-gray-600 transition-all"
                  />
                </div>
              </div>

              <div>
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

              <div>
                {/* Raio de Busca do Local Falcon */}
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>⚡ Raio de Busca do Local Falcon (em km)</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-bold shadow-sm">
                    {formData.radius || 5} km
                  </span>
                </label>
                <p className="text-[11px] text-gray-500 mb-2">
                  Informe o raio de busca em quilômetros (distância a ser mapeada no mapa a partir da empresa)
                </p>
                <div className="relative">
                  <input
                    type="number"
                    min="0.5"
                    max="100"
                    step="0.5"
                    value={formData.radius}
                    onChange={e => setFormData({ ...formData, radius: e.target.value === '' ? '' : Math.max(0.1, parseFloat(e.target.value) || 1) })}
                    placeholder="ex: 5"
                    className="w-full bg-[#0d0f19] border-2 border-amber-500/50 focus:border-amber-400 rounded-xl p-3.5 text-base font-black text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-inner placeholder-gray-600 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: TICKET MÉDIO */}
          <div className="bg-[#141626] p-6 rounded-2xl border border-amber-500/20 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              $ Ticket médio (R$) - Opcional
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Deixe em branco por padrão para utilizar o ticket médio do painel do prospecto. Se preenchido, este valor substituirá o cálculo no diagnóstico.
            </p>
            <input
              type="text"
              value={formData.ticketMedio}
              onChange={e => setFormData({ ...formData, ticketMedio: e.target.value })}
              placeholder="Vazio (usa valor do painel do prospecto)"
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
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Módulos do diagnóstico</h4>
              <span className="text-[11px] text-amber-400 font-semibold">💡 Marque o que deseja re-executar</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center justify-between bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 hover:border-indigo-500/50 transition-all">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={formData.modules.gmn}
                    onChange={e => setFormData({ ...formData, modules: { ...formData.modules, gmn: e.target.checked } })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                  />
                  <span className="text-xs font-bold text-gray-200">Google (Local Falcon API)</span>
                </label>
                {diagnosticData && (
                  <button
                    type="button"
                    onClick={() => handleRerunSingleModule('gmn')}
                    title="Refazer varredura do Local Falcon isoladamente"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold underline flex items-center gap-1 shrink-0 ml-2"
                  >
                    <RefreshCw size={11} /> refazer só este
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 hover:border-indigo-500/50 transition-all">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={formData.modules.instagram}
                    onChange={e => setFormData({ ...formData, modules: { ...formData.modules, instagram: e.target.checked } })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                  />
                  <span className="text-xs font-bold text-gray-200">Instagram (Meta)</span>
                </label>
                {diagnosticData && (
                  <button
                    type="button"
                    onClick={() => handleRerunSingleModule('instagram')}
                    title="Recalcular dados do Instagram"
                    className="text-[11px] text-pink-400 hover:text-pink-300 font-bold underline flex items-center gap-1 shrink-0 ml-2"
                  >
                    <RefreshCw size={11} /> refazer só este
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 hover:border-indigo-500/50 transition-all">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={formData.modules.site}
                    onChange={e => setFormData({ ...formData, modules: { ...formData.modules, site: e.target.checked } })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                  />
                  <span className="text-xs font-bold text-gray-200">Site (PageSpeed API)</span>
                </label>
                {diagnosticData && (
                  <button
                    type="button"
                    onClick={() => handleRerunSingleModule('site')}
                    title="Refazer teste do Google PageSpeed isoladamente"
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-1 shrink-0 ml-2"
                  >
                    <RefreshCw size={11} /> refazer só este
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between bg-[#0d0f19] p-3.5 rounded-xl border border-gray-800 hover:border-indigo-500/50 transition-all">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={formData.modules.ads}
                    onChange={e => setFormData({ ...formData, modules: { ...formData.modules, ads: e.target.checked } })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-gray-900 border-gray-700"
                  />
                  <span className="text-xs font-bold text-gray-200">Ads (Meta + Google)</span>
                </label>
                {diagnosticData && (
                  <button
                    type="button"
                    onClick={() => handleRerunSingleModule('ads')}
                    title="Recalcular dados de Ads"
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-bold underline flex items-center gap-1 shrink-0 ml-2"
                  >
                    <RefreshCw size={11} /> refazer só este
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-amber-400/90 mt-3 font-semibold flex items-center gap-1.5 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              <span>💡</span>
              <span>Módulos desmarcados manterão intactos os dados anteriores que já estão salvos e corretos neste diagnóstico.</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => selectedProspect && enqueueDiagnostic(selectedProspect)}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-sm sm:text-base active:scale-98 disabled:opacity-50 cursor-pointer border border-blue-400/30"
              title="Adicionar à fila de processamento em segundo plano"
            >
              <Plus size={20} />
              <span>Gerar Diagnóstico (Segundo Plano)</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const DataErrorOverlay = ({
    title,
    description,
    tip,
    onRerun,
    rerunLabel,
    onFetchExisting,
    fetchExistingLabel,
    onEditParams,
  }: {
    title: string;
    description: string;
    tip: string;
    onRerun?: () => void;
    rerunLabel?: string;
    onFetchExisting?: () => void;
    fetchExistingLabel?: string;
    onEditParams?: () => void;
  }) => (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#0d0f19]/85 backdrop-blur-md rounded-2xl no-print">
      <div className="bg-[#1a1d2d] border-2 border-amber-500/50 p-6 md:p-8 rounded-2xl shadow-2xl max-w-lg text-center space-y-4 font-sans border-t-amber-400">
        <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center mx-auto mb-1 shadow-inner">
          <AlertTriangle size={26} />
        </div>
        <div>
          <h4 className="text-lg font-black text-white mb-1.5">{title}</h4>
          <p className="text-xs text-gray-300 leading-relaxed font-medium">{description}</p>
        </div>
        <div className="bg-amber-950/40 border border-amber-500/30 p-3.5 rounded-xl text-left text-xs text-amber-200/90 leading-relaxed font-medium">
          <span className="font-bold text-amber-400 block mb-1">💡 Diagnóstico de Presença Digital:</span>
          {tip}
        </div>
        <div className="flex flex-col gap-2.5 pt-1">
          {onFetchExisting && (
            <button
              type="button"
              onClick={onFetchExisting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 px-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 border border-emerald-400/40"
              title="Puxa o relatório que já foi gerado na sua conta do Local Falcon sem gastar novos créditos de busca"
            >
              <Download size={15} />
              {fetchExistingLabel || '📥 Puxar Análise Existente do Local Falcon (0 Créditos)'}
            </button>
          )}
          <div className="flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap">
            {onEditParams && (
              <button
                type="button"
                onClick={onEditParams}
                className="flex-1 bg-purple-600/40 hover:bg-purple-600/70 text-purple-200 border border-purple-500/40 text-xs font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
              >
                <Brain size={14} />
                Editar Parâmetros
              </button>
            )}
            {onRerun && (
              <button
                type="button"
                onClick={onRerun}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RefreshCw size={14} />
                {rerunLabel || 'Refazer Varredura'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const getNumber = (val: string | undefined, defaultVal: number) => {
    if (!val) return defaultVal;
    const n = parseFloat(val);
    return isNaN(n) ? defaultVal : n;
  };

  const renderDiagnostic = () => {
    if (!selectedProspect || !diagnosticData) return null;

    const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

    // Calculadora data for Dinheiro na mesa
    const cData: any = selectedProspect.calculatorData || {};

    // Resolução de Ordem de Prioridade do Ticket Médio:
    // 1. Valor sobrescrito manualmente no formulário de parâmetros (formData / diagnosticData)
    // 2. Valor calculado no painel do prospecto (calculatorData ou prospect.ticketMedio)
    // 3. Fallback de R$ 1.500
    const rawFormTicket = (formData.ticketMedio || diagnosticData?.ticketMedio || '').toString().trim();
    const parsedFormTicket = parseFloat(rawFormTicket);

    const rawProspectTicket = cData.ticketMedio || (selectedProspect as any).ticketMedio;
    const parsedProspectTicket = rawProspectTicket ? parseFloat(rawProspectTicket) : null;

    const ticketMedio = (!isNaN(parsedFormTicket) && parsedFormTicket > 0)
      ? parsedFormTicket
      : ((parsedProspectTicket && !isNaN(parsedProspectTicket) && parsedProspectTicket > 0) ? parsedProspectTicket : 1500);

    const buscasMes = 500; // Est. Conservadora

    const cons = Math.round(buscasMes * 0.02 * ticketMedio);
    const mod = Math.round(buscasMes * 0.04 * ticketMedio);
    const agr = Math.round(buscasMes * 0.06 * ticketMedio);

    const notaGoogle = getNumber(selectedProspect.gmnRating, 0);
    const scoreGeral = notaGoogle > 4.5 ? 65 : (notaGoogle > 4.0 ? 44 : 25);
    const competitors = Array.isArray(diagnosticData?.concorrentes) ? diagnosticData.concorrentes : [];
    const clientNameNorm = (selectedProspect.clinicName || '').toLowerCase().trim();
    const clientRank = Number(diagnosticData?.posicaoCliente ?? diagnosticData?.gmn?.posicaoMedia);
    const hasValidClientRank = Number.isInteger(clientRank) && clientRank > 0;

    let parsedCompetitors: any[] = competitors
      .filter((c: any) => {
        if (!c || !c.nome) return false;
        const cNorm = c.nome.toLowerCase().trim();
        return cNorm !== clientNameNorm && !cNorm.includes(clientNameNorm);
      })
      .sort((a: any, b: any) => (a.posicao ?? 99) - (b.posicao ?? 99))
      .filter((competitor: any, index: number, list: any[]) => {
        const key = competitor.placeId || competitor.nome.trim().toLowerCase();
        return list.findIndex((item: any) => (item.placeId || item.nome.trim().toLowerCase()) === key) === index;
      });

    const topCompetitors: any[] = hasValidClientRank
      ? parsedCompetitors.filter((competitor: any) => clientRank === 1
        ? Number(competitor.posicao) > clientRank
        : Number(competitor.posicao) < clientRank
      ).slice(0, 3)
      : [];
    const siteUrl = selectedProspect.site || (selectedProspect as any).websiteUrl || diagnosticData.siteUrl || '';
    const hasValidSite = (() => {
      try {
        const url = new URL(siteUrl);
        return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && url.hostname.includes('.');
      } catch {
        return false;
      }
    })();
    const isSiteDataMissing = !hasValidSite || !diagnosticData.site || diagnosticData.site.velocidade === 'sem dados' || diagnosticData.site.velocidade === undefined;
    const isGmnDataMissing = !diagnosticData.gmn || diagnosticData.gmn.top3Percent === 'sem dados' || diagnosticData.gmn.top3Percent === undefined;
    const metaAdsVerified = diagnosticData.anuncios?.metaVerified === true;
    const metaAdsStatus = metaAdsVerified ? diagnosticData.anuncios?.clienteAnunciaMeta : null;
    const metaCompetitorsVerified = diagnosticData.anuncios?.metaCompetitorsVerified === true;
    const regionalCompetitorCount = parsedCompetitors.length;

    return (
      <div id="printable-diagnostic-content" className="bg-[#0d0f19] text-gray-100 min-h-screen p-8 rounded-2xl shadow-2xl font-sans">
        <style>{`
          @media print {
            body.is-printing-marketing-diagnostic {
              background-color: #0d0f19 !important;
              background: #0d0f19 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body.is-printing-marketing-diagnostic html,
            body.is-printing-marketing-diagnostic #root {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              background-color: #0d0f19 !important;
              background: #0d0f19 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body.is-printing-marketing-diagnostic div,
            body.is-printing-marketing-diagnostic section,
            body.is-printing-marketing-diagnostic main,
            body.is-printing-marketing-diagnostic article {
              overflow: visible !important;
              max-height: none !important;
              height: auto !important;
            }
            body.is-printing-marketing-diagnostic body * {
              visibility: hidden !important;
            }
            body.is-printing-marketing-diagnostic #printable-diagnostic-content,
            body.is-printing-marketing-diagnostic #printable-diagnostic-content * {
              visibility: visible !important;
            }
            body.is-printing-marketing-diagnostic #printable-diagnostic-content {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              min-width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              overflow: visible !important;
              overflow-y: visible !important;
              margin: 0 !important;
              padding: 32px 40px !important;
              background-color: #0d0f19 !important;
              color: #ffffff !important;
              box-shadow: none !important;
              border: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body.is-printing-marketing-diagnostic #printable-diagnostic-content .bg-[#1a1d2d] {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            body.is-printing-marketing-diagnostic .no-print,
            body.is-printing-marketing-diagnostic button,
            body.is-printing-marketing-diagnostic nav,
            body.is-printing-marketing-diagnostic header,
            body.is-printing-marketing-diagnostic aside,
            body.is-printing-marketing-diagnostic .sidebar {
              display: none !important;
            }
          }

          /* TEMA CLARO PARA DIAGNÓSTICO & IMPRESSÃO */
           .diag-theme-light {
             background-color: #ffffff !important;
             color: #0f172a !important;
             padding: 1rem;
             border-radius: 1rem;
           }
           .diag-theme-light [class*="bg-"] {
             color: #0f172a;
           }
           .diag-theme-light [class*="bg-[#"],
           .diag-theme-light [class*="bg-gray-9"],
           .diag-theme-light [class*="bg-slate-9"] {
             background-color: #ffffff !important;
             border-color: #cbd5e1 !important;
             box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06) !important;
           }
           .diag-theme-light .bg-\[\#1a1d2d\],
           .diag-theme-light .bg-\[\#0d0f19\],
           .diag-theme-light .bg-\[\#141626\],
           .diag-theme-light .bg-\[\#111322\],
           .diag-theme-light .bg-\[\#1e2238\],
          .diag-theme-light .bg-gray-900,
          .diag-theme-light .bg-gray-950 {
            background-color: #ffffff !important;
            border-color: #e2e8f0 !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04) !important;
          }
          .diag-theme-light h1,
          .diag-theme-light h2,
          .diag-theme-light h3,
          .diag-theme-light h4 {
            color: #0f172a !important;
          }
          .diag-theme-light p,
          .diag-theme-light span,
          .diag-theme-light div {
            color: #1e293b;
          }
          .diag-theme-light .text-white,
          .diag-theme-light .text-gray-100,
          .diag-theme-light .text-gray-200 {
            color: #0f172a !important;
          }
          .diag-theme-light .text-gray-300,
          .diag-theme-light .text-gray-400 {
            color: #334155 !important;
          }
           .diag-theme-light .text-gray-500 {
             color: #64748b !important;
           }
           .diag-theme-light .text-orange-500,
           .diag-theme-light .text-amber-400,
           .diag-theme-light .text-amber-500,
           .diag-theme-light .text-emerald-400,
           .diag-theme-light .text-indigo-400,
           .diag-theme-light .text-purple-400 {
             color: inherit !important;
           }
          .diag-theme-light .border-gray-800,
          .diag-theme-light .border-gray-700 {
            border-color: #e2e8f0 !important;
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
          <p className="text-xs text-gray-400 mb-2">
            Como ler: cada área recebe uma nota de 0 a 100 baseada em métricas oficiais coletadas em tempo real.
          </p>
          <p className="text-[11px] text-gray-500 mb-6 italic">
            • <strong>Google:</strong> % Top 3 no Local Falcon | • <strong>Reputação:</strong> Estrelas Google × 20 | • <strong>Instagram:</strong> Presença em redes | • <strong>Site:</strong> Google PageSpeed Mobile | • <strong>Ads:</strong> Meta Ad Library
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
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/50 via-[#141626] to-[#141626] p-4 shadow-lg">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full border border-blue-400/30 bg-blue-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-200">Local Falcon API</span>
                <h2 className="text-xl font-black text-white">Google Meu Negócio</h2>
              </div>
              <p className="text-xs text-gray-400">
                Como ler: o quanto o seu perfil do Google está completo e ativo, na mesma régua usada para comparar com o concorrente que mais aparece na sua região.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 no-print">
              <button
                type="button"
                onClick={() => handleRerunSingleModule('gmn')}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/40 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
                title="Refazer apenas a varredura do Local Falcon no Google"
              >
                <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                <span>Nova varredura</span>
              </button>
              <button
                type="button"
                onClick={() => selectedProspect && enqueueDiagnostic(selectedProspect, 'fetch_existing_gmn')}
                disabled={isGenerating}
                className="bg-[#0d0f19] hover:bg-sky-950/60 text-sky-200 border border-sky-500/40 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                title="Buscar novamente o último relatório salvo no Local Falcon, sem executar uma nova varredura"
              >
                <Download size={14} />
                <span>Puxar relatório existente</span>
              </button>
            </div>
          </div>

            <div className="bg-[#141626] p-4 md:p-8 rounded-2xl border border-gray-800 shadow-xl">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div>
                <h4 className="text-xs font-black text-indigo-400 tracking-wider uppercase mb-3">O QUE OS NÚMEROS MOSTRAM</h4>
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
                <h4 className="text-xs font-black text-emerald-400 tracking-wider uppercase mb-3">OPORTUNIDADES</h4>
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
        <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-10 relative overflow-hidden">
          {isGmnDataMissing && (
            <DataErrorOverlay
              title="Visibilidade no Google Maps a Otimizar"
              description="Não foi possível mapear a presença em posição de destaque para a busca pesquisada na sua região."
              tip="Se o perfil da sua empresa não aparece no Top 3 do mapa quando clientes locais buscam pelos seus serviços no Google, a clínica perde dezenas de oportunidades de agendamento diariamente para concorrentes com perfis mais otimizados e ativos."
              onEditParams={() => setShowDiagnosticForm(true)}
              onFetchExisting={() => selectedProspect && enqueueDiagnostic(selectedProspect, 'fetch_existing_gmn', 'gmn')}
              fetchExistingLabel="📥 Puxar Análise Existente do Local Falcon (0 Créditos)"
              onRerun={() => selectedProspect && handleRerunSingleModule('gmn')}
              rerunLabel="⚡ Refazer Nova Varredura no Local Falcon"
            />
          )}
          <div className={isGmnDataMissing ? 'filter blur-md opacity-20 select-none pointer-events-none transition-all' : ''}>
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

            {/* Imagem completa do mapa Local Falcon */}
            {diagnosticData.gmn?.mapaCalorImg || (diagnosticData.gmn?.scanId ? `https://lf-static-v2.localfalcon.com/image/${diagnosticData.gmn.scanId}` : '') ? (
              <div className="w-full max-w-xl bg-[#1a1d2d] p-3 rounded-2xl border border-gray-700/80 shadow-2xl overflow-hidden mb-4">
                <img
                  src={diagnosticData.gmn?.mapaCalorImg || `https://lf-static-v2.localfalcon.com/image/${diagnosticData.gmn?.scanId}`}
                  alt="Mapa de Calor Local Falcon Real"
                  className="block w-full h-auto rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
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
        </div>

        {/* Quem aparece na frente de você (Ranking de Concorrentes) */}
        <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-10">
          <h3 className="text-xl font-black text-white mb-1">{clientRank === 1 ? 'Concorrentes após você' : 'Quem aparece na frente de você'}</h3>
          <p className="text-xs text-gray-400 mb-6">
            Como ler: esta é a lista que o cliente vê no Google ao buscar na sua região. Quem está no topo leva o clique e o pedido.
          </p>

          <div className="space-y-3">
            {clientRank !== 1 && topCompetitors.map((c: any, i: number) => (
              <div key={i} className="bg-[#0d0f19] p-4 rounded-xl border border-gray-800 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {c.posicao}
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

            {hasValidClientRank && topCompetitors.length === 0 && (
              <p className="text-sm text-emerald-400 font-medium">Sua empresa está em 1º lugar entre os resultados analisados.</p>
            )}

            {/* Ficha da própria clínica destacada */}
            {hasValidClientRank ? (
              <div className="bg-amber-950/40 p-4 rounded-xl border-2 border-amber-500/50 flex items-start gap-4 mt-4">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {clientRank}
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
                  <p className="text-xs font-bold text-amber-400 mt-2">Posição no Google (Local Falcon): #{clientRank}</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#1a1d2d] p-4 rounded-xl border border-amber-500/20 text-center text-amber-400 text-xs font-semibold mt-4">
                Sem dados de posição real — execute a varredura do Local Falcon para ver sua posição no mapa.
              </div>
            )}

            {clientRank === 1 && topCompetitors.map((c: any, i: number) => (
              <div key={i} className="bg-[#0d0f19] p-4 rounded-xl border border-gray-800 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {c.posicao}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-white text-sm">{c.nome}</h4>
                  <p className="text-xs text-gray-400">{c.endereco || 'Endereço não informado'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-amber-400 font-bold text-xs">{c.nota || 4.8} ★</span>
                    <span className="text-gray-500 text-xs">({c.avaliacoes || 0} avaliações)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Você contra quem está ganhando (Tabela Comparativa) */}
        <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
            <div>
              <h3 className="text-xl font-black text-white mb-1">Você contra quem está ganhando</h3>
              <p className="text-xs text-gray-400">
                Como ler: comparamos você com os três concorrentes que dominam a sua região em cinco práticas básicas. Cada X vermelho na sua coluna é terreno entregue de graça.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefetchCompetitors}
              className="bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/40 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all no-print cursor-pointer active:scale-95 shadow-md shrink-0"
              title="Refazer a amostra de concorrentes utilizando os dados armazenados das clínicas da mesma região"
            >
              <RefreshCw size={14} />
              <span>🔄 Refazer Concorrentes</span>
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-gray-800 text-xs uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-4 font-bold w-1/4"></th>
                  <th className="py-3 px-4 font-black text-amber-400 bg-amber-950/40 border-x border-t border-amber-500/30 rounded-t-xl text-center w-1/5">
                    VOCÊ
                  </th>
                  {topCompetitors.map((c: any, idx: number) => (
                    <th key={idx} className="py-3 px-4 font-bold text-gray-300 text-center text-xs whitespace-normal break-words max-w-[180px] leading-tight uppercase">
                      {c.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {/* Linha 1: Anuncia no Google? */}
                <tr className="border-b border-gray-800/60 hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-300 font-bold text-xs">Anuncia no Google?</td>
                  <td className="py-3.5 px-4 text-center bg-amber-950/20 border-x border-amber-500/20">
                    {diagnosticData.anuncios?.clienteAnunciaGoogle ? (
                      <span className="text-emerald-400 font-black text-base">✓</span>
                    ) : (
                      <span className="text-red-500 font-black text-base">✗</span>
                    )}
                  </td>
                  {topCompetitors.map((c: any, idx: number) => (
                    <td key={idx} className="py-3.5 px-4 text-center">
                      {c.anunciaGoogle !== false ? (
                        <span className="text-emerald-400 font-black text-base">✓</span>
                      ) : (
                        <span className="text-red-500 font-black text-base">✗</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Linha 2: Anuncia no Instagram/Facebook? */}
                <tr className="border-b border-gray-800/60 hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-300 font-bold text-xs">Anuncia no Instagram/Facebook?</td>
                  <td className="py-3.5 px-4 text-center bg-amber-950/20 border-x border-amber-500/20">
                    {metaAdsStatus === true ? (
                      <span className="text-emerald-400 font-black text-base">✓</span>
                    ) : metaAdsStatus === false ? (
                      <span className="text-red-500 font-black text-base">✗</span>
                    ) : (
                      <span className="text-gray-400 font-bold">?</span>
                    )}
                  </td>
                  {topCompetitors.map((c: any, idx: number) => (
                    <td key={idx} className="py-3.5 px-4 text-center">
                      {c.anunciaMeta === true ? (
                        <span className="text-emerald-400 font-black text-base">✓</span>
                      ) : c.anunciaMeta === false ? (
                        <span className="text-red-500 font-black text-base">✗</span>
                      ) : (
                        <span className="text-gray-400 font-bold">?</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Linha 3: Responde avaliações? */}
                <tr className="border-b border-gray-800/60 hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-300 font-bold text-xs">Responde avaliações?</td>
                  <td className="py-3.5 px-4 text-center bg-amber-950/20 border-x border-amber-500/20 text-gray-400 font-bold">
                    ?
                  </td>
                  {topCompetitors.map((_, idx: number) => (
                    <td key={idx} className="py-3.5 px-4 text-center text-gray-400 font-bold">
                      ?
                    </td>
                  ))}
                </tr>

                {/* Linha 4: Posta toda semana? */}
                <tr className="border-b border-gray-800/60 hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-300 font-bold text-xs">Posta toda semana?</td>
                  <td className="py-3.5 px-4 text-center bg-amber-950/20 border-x border-amber-500/20 text-gray-400 font-bold">
                    ?
                  </td>
                  {topCompetitors.map((_, idx: number) => (
                    <td key={idx} className="py-3.5 px-4 text-center text-gray-400 font-bold">
                      ?
                    </td>
                  ))}
                </tr>

                {/* Linha 5: Site rápido? */}
                <tr className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 text-gray-300 font-bold text-xs">Site rápido?</td>
                  <td className="py-3.5 px-4 text-center bg-amber-950/20 border-x border-b border-amber-500/20 rounded-b-xl">
                    {typeof diagnosticData.site?.velocidade === 'number' && diagnosticData.site.velocidade >= 60 ? (
                      <span className="text-emerald-400 font-black text-base">✓</span>
                    ) : typeof diagnosticData.site?.velocidade === 'number' ? (
                      <span className="text-red-500 font-black text-base">✗</span>
                    ) : (
                      <span className="text-gray-400 font-bold">?</span>
                    )}
                  </td>
                  {topCompetitors.map((_, idx: number) => (
                    <td key={idx} className="py-3.5 px-4 text-center text-gray-400 font-bold">
                      ?
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-500 italic mt-4">
            "?" indica critério sem dado suficiente coletado para aquele concorrente.
          </p>
        </div>

        {/* Site Section (Unificado: Velocidade, SEO e Rastreamento) */}
        <div className="mb-10">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#141626] to-[#141626] p-4 shadow-lg">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">PageSpeed API</span>
                <h2 className="text-xl font-black text-white">Site</h2>
              </div>
              <p className="text-xs text-gray-400">
                Como ler: notas oficiais do Google PageSpeed Insights (Mobile) para velocidade, otimização e medição de visitantes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleRerunSingleModule('site')}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all no-print cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
              title="Refazer apenas a análise de velocidade do Google PageSpeed"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
              <span>Refazer análise PageSpeed</span>
            </button>
          </div>

          <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl relative overflow-hidden">
            {isSiteDataMissing && (
              <DataErrorOverlay
                title="Análise de Site Não Concluída"
                description="Não foi possível localizar um site ativo e funcional para a sua empresa."
                tip="Quando um cliente em potencial pesquisa pela sua empresa e não encontra um site rápido e estruturado, você perde autoridade e passa clientes para os concorrentes. Se a sua clínica já possui um site mas ele não foi localizado, é muito provável que existam falhas de configuração técnica, servidor indisponível ou falta de otimização de SEO que impedem o Google de reconhecer e posicionar a página."
                onEditParams={() => setShowDiagnosticForm(true)}
                onRerun={() => handleRerunSingleModule('site')}
                rerunLabel="Refazer apenas PageSpeed (Site)"
              />
            )}
            <div className={isSiteDataMissing ? 'filter blur-md opacity-20 select-none pointer-events-none transition-all' : ''}>
              <h3 className="text-lg font-black text-white mb-4">Velocidade, SEO e Rastreamento</h3>

              {/* Google PageSpeed Insights Gauges (Dados Oficiais do Google) */}
              <div className="bg-[#0d0f19] p-5 rounded-2xl border border-gray-800 mb-6">
                <div className="flex flex-wrap items-center justify-around gap-6 text-center">

                  {/* 1. Desempenho */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14 flex items-center justify-center mb-1.5">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle cx="28" cy="28" r="22" stroke="#ef444430" strokeWidth="4" fill="#ef444415" />
                        <circle
                          cx="28"
                          cy="28"
                          r="22"
                          stroke="#ef4444"
                          strokeWidth="4"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={2 * Math.PI * 22 * (1 - (diagnosticData.site?.velocidade || 33) / 100)}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <span className="absolute text-sm font-black text-red-500">
                        {diagnosticData.site?.velocidade || 33}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-300">Desempenho</span>
                  </div>

                  {/* 2. Acessibilidade */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14 flex items-center justify-center mb-1.5">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle cx="28" cy="28" r="22" stroke="#10b98130" strokeWidth="4" fill="#10b98115" />
                        <circle
                          cx="28"
                          cy="28"
                          r="22"
                          stroke="#10b981"
                          strokeWidth="4"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={2 * Math.PI * 22 * (1 - (diagnosticData.site?.acessibilidade || 92) / 100)}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <span className="absolute text-sm font-black text-emerald-400">
                        {diagnosticData.site?.acessibilidade || 92}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-300">Acessibilidade</span>
                  </div>

                  {/* 3. Práticas Recomendadas */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14 flex items-center justify-center mb-1.5">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle cx="28" cy="28" r="22" stroke="#10b98130" strokeWidth="4" fill="#10b98115" />
                        <circle
                          cx="28"
                          cy="28"
                          r="22"
                          stroke="#10b981"
                          strokeWidth="4"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={2 * Math.PI * 22 * (1 - (diagnosticData.site?.praticas || 96) / 100)}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <span className="absolute text-sm font-black text-emerald-400">
                        {diagnosticData.site?.praticas || 96}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-300">Práticas recomendadas</span>
                  </div>

                  {/* 4. SEO */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-14 h-14 flex items-center justify-center mb-1.5">
                      <svg className="w-14 h-14 transform -rotate-90">
                        <circle cx="28" cy="28" r="22" stroke="#10b98130" strokeWidth="4" fill="#10b98115" />
                        <circle
                          cx="28"
                          cy="28"
                          r="22"
                          stroke="#10b981"
                          strokeWidth="4"
                          strokeDasharray={2 * Math.PI * 22}
                          strokeDashoffset={2 * Math.PI * 22 * (1 - (diagnosticData.site?.seo !== undefined ? diagnosticData.site.seo : 92) / 100)}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <span className="absolute text-sm font-black text-emerald-400">
                        {diagnosticData.site?.seo !== undefined ? diagnosticData.site.seo : 92}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-300">SEO</span>
                  </div>

                  {/* 5. Navegação agêntica */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="bg-amber-950/40 border border-amber-500/30 px-3 py-1 rounded-full flex items-center gap-1 mb-1 mt-1">
                      <span className="w-2 h-2 bg-amber-500 rounded-xs"></span>
                      <span className="text-xs font-black text-amber-400">1/2</span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-300 max-w-[90px] leading-tight">Navegação agêntica</span>
                  </div>

                </div>
              </div>

              {/* Grid Principal de Duas Colunas: Diagnóstico do Site VS Rastreamento de Visitantes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                
                {/* Coluna Esquerda: O que os números mostram & Oportunidades */}
                <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800 space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-indigo-400 tracking-wider uppercase mb-2">O QUE OS NÚMEROS MOSTRAM</h4>
                    <ul className="space-y-2 text-xs text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-gray-500 font-bold">•</span>
                        <span>Nota de velocidade no teste do Google: <strong className="text-white">{diagnosticData.site?.velocidade || 83} de 100</strong>.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-500 font-bold">•</span>
                        <span>A nota técnica do site no teste do Google é <strong className="text-white">{diagnosticData.site?.seo !== undefined ? diagnosticData.site.seo : 92} de 100</strong>.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-gray-500 font-bold">•</span>
                        <span>A página carrega rapidamente no dispositivo móvel.</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-emerald-400 tracking-wider uppercase mb-2">OPORTUNIDADES DE OTIMIZAÇÃO</h4>
                    <ul className="space-y-2 text-xs text-gray-300">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>Manter o código otimizado para abertura rápida em conexões móveis.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>Instalar tags de rastreamento para medir conversões diretas do botão de WhatsApp.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Coluna Direita: O site está medindo quem visita? */}
                <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-black text-purple-400 tracking-wider uppercase mb-2">RASTREAMENTO DE VISITANTES</h4>
                    <h5 className="text-sm font-bold text-white mb-3">O site está medindo quem visita?</h5>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 bg-[#141626] p-2.5 rounded-lg border border-gray-800">
                        <span className="text-red-500 text-sm">❌</span>
                        <span className="truncate">Pixel do Meta</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 bg-[#141626] p-2.5 rounded-lg border border-gray-800">
                        <span className="text-red-500 text-sm">❌</span>
                        <span className="truncate">Google Tag / GA4</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 bg-[#141626] p-2.5 rounded-lg border border-gray-800">
                        <span className="text-red-500 text-sm">❌</span>
                        <span className="truncate">Tag Manager</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-300 bg-[#141626] p-2.5 rounded-lg border border-gray-800">
                        <span className="text-emerald-400 text-sm">✓</span>
                        <span className="truncate">Link WhatsApp</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#241a1c] border-l-4 border-orange-500 p-3 rounded-r-lg text-orange-200 text-xs leading-relaxed">
                    Sem esse rastreamento instalado, todo anúncio futuro vira gasto às cegas: ninguém sabe quem clicou, comprou ou foi embora.
                  </div>
                </div>

              </div>

              {/* Banner de Destaque Final do Site */}
              <div className="bg-[#241d14] border border-amber-500/30 p-3.5 rounded-xl text-amber-400 font-bold text-xs flex items-center justify-between">
                <span>⚡ Status de Velocidade: A velocidade do site não é um obstáculo para fechar clientes.</span>
                <span className="text-amber-300 text-[10px] bg-amber-500/20 px-2 py-0.5 rounded font-black">MOBILE OK</span>
              </div>

            </div>
          </div>
        </div>

        {/* Seção Exclusiva: Anúncios na Meta (Facebook & Instagram) */}
        {diagnosticData.anuncios && (
          <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-10">
            <div className="-mx-4 -mt-4 md:-mx-4 md:-mt-4 mb-6 flex items-center justify-between flex-wrap gap-4 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/50 via-[#171526] to-[#141626] p-4 shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                    Meta Ad Library API
                  </span>
                  <h3 className="text-xl font-black text-white">Anúncios na Meta (Facebook & Instagram)</h3>
                </div>
                <p className="text-xs text-gray-400">
                  Análise de campanhas de tráfego pago na Biblioteca Pública de Anúncios da Meta para a sua empresa e concorrentes locais.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${metaAdsStatus == null ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                  <span className={`w-2 h-2 rounded-full ${metaAdsStatus == null ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                  <span className={`text-xs font-bold ${metaAdsStatus == null ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {metaAdsStatus == null ? 'Verificação necessária' : 'API Conectada'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRerunSingleModule('ads')}
                  disabled={isGenerating}
                  className="bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/40 text-xs font-bold px-3.5 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
                  title="Consultar novamente a Meta Ad Library para esta empresa"
                >
                  <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                  <span>Refazer análise Meta Ads</span>
                </button>
              </div>
            </div>

            {/* Grid de Métricas de Anúncios na Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
                <span className="text-xs text-gray-400 block mb-1 font-semibold">Sua Presença no Meta Ads</span>
                <div className="flex items-center gap-2 mt-1">
                  {metaAdsStatus === true ? (
                    <>
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span className="text-lg font-black text-emerald-400">ATIVO (Anunciando)</span>
                    </>
                  ) : metaAdsStatus === false ? (
                    <>
                      <span className="w-3 h-3 rounded-full bg-red-500"></span>
                      <span className="text-lg font-black text-red-400">INATIVO (Não Anuncia)</span>
                    </>
                  ) : (
                    <>
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span className="text-lg font-black text-amber-400">NÃO CONFIRMADO</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  {metaAdsStatus === true
                    ? 'Sua clínica possui anúncios ativos rodando no Instagram e Facebook.'
                    : metaAdsStatus === false
                      ? 'A consulta da API não encontrou anúncios ativos para esta empresa.'
                      : 'A API não conseguiu confirmar o status. Use a Biblioteca da Meta para verificar os anúncios diretamente.'}
                </p>
                <a
                  href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=${encodeURIComponent(selectedProspect.clinicName || formData.companyName)}&search_type=keyword_unordered&media_type=all`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-[11px] font-bold text-blue-200 transition-colors hover:bg-blue-500/30 no-print"
                  title="Abrir a busca desta empresa na Biblioteca de Anúncios da Meta"
                >
                  <Search size={13} />
                  Verificar na Biblioteca da Meta
                </a>
                {metaAdsStatus == null && (
                  <div className="mt-3 border-t border-gray-800 pt-3 no-print">
                    <p className="mb-2 text-[10px] leading-relaxed text-gray-500">Após conferir a Biblioteca, registre o resultado real:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmMetaAds(true)}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-[11px] font-bold text-emerald-200 transition-colors hover:bg-emerald-500/30"
                      >
                        Possui anúncios ativos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirmMetaAds(false)}
                        className="rounded-lg border border-gray-600 bg-gray-800/60 px-3 py-2 text-[11px] font-bold text-gray-300 transition-colors hover:bg-gray-700"
                      >
                        Não possui anúncios
                      </button>
                    </div>
                  </div>
                )}
                {metaAdsVerified && diagnosticData.anuncios.metaVerificationSource === 'manual' && (
                  <p className="mt-3 text-[10px] font-semibold text-emerald-400">Status confirmado manualmente na Biblioteca da Meta.</p>
                )}
              </div>

              <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
                <span className="text-xs text-gray-400 block mb-1 font-semibold">Concorrentes identificados na região</span>
                <span className="text-2xl font-black text-amber-400">
                  {regionalCompetitorCount > 0
                    ? `${regionalCompetitorCount} ${regionalCompetitorCount === 1 ? 'concorrente' : 'concorrentes'}`
                    : 'Concorrência presente'}
                </span>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  {metaCompetitorsVerified
                    ? `${diagnosticData.anuncios.concorrentesMeta || 0} deles foram confirmados com anúncios ativos na Meta.`
                    : regionalCompetitorCount > 0
                      ? 'A presença regional foi confirmada pelo Local Falcon; a atividade desses concorrentes na Meta ainda não foi confirmada.'
                      : 'Existem empresas concorrentes na região, mas a quantidade e a atividade na Meta ainda não foram consolidadas pelas APIs.'}
                </p>
              </div>

              <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
                <span className="text-xs text-gray-400 block mb-1 font-semibold">Plataformas Analisadas</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2.5 py-1 rounded-lg text-xs font-bold">
                    📸 Instagram
                  </span>
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg text-xs font-bold">
                    📘 Facebook
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">Feed, Stories e Reels mapeados via Meta Graph API.</p>
              </div>
            </div>

            {/* Caixa Explicativa de Diagnóstico de Meta Ads */}
            <div className="bg-[#0d0f19] p-5 rounded-xl border border-purple-500/30">
              <h4 className="text-xs font-bold text-purple-300 mb-1.5 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} className="text-purple-400" />
                <span>Diagnóstico Estratégico Meta Ads</span>
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                {metaAdsStatus === true
                  ? `Sua clínica já possui anúncios rodando na Meta. Recomendamos monitorar a taxa de clique (CTR) e otimizar os criativos de vídeo para atrair pacientes da região de ${formData.cityName}.`
                  : metaAdsStatus === false
                    ? `A consulta da Meta Ad Library não encontrou anúncios ativos para esta empresa. Confirme o resultado pela Biblioteca da Meta antes de utilizar esta informação comercialmente.`
                    : 'Não foi possível confirmar o status pela API. Abra a Biblioteca da Meta para consultar os anúncios ativos diretamente.'}
              </p>
            </div>
          </div>
        )}

        {/* Anúncios */}
        {diagnosticData.anuncios && (
          <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800 mb-8">
            <h3 className="text-xl font-bold mb-2">Anúncios</h3>
            <p className="text-sm text-gray-400 mb-6">Como ler: consultamos as bibliotecas públicas de anúncios do Google e do Meta para ver quem está pagando para aparecer na sua região.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Card 1: Você Anuncia no Google */}
              <div className="bg-[#141626] p-5 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm hover:border-blue-500/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <Search className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h4 className={`text-2xl font-black ${diagnosticData.anuncios.clienteAnunciaGoogle ? 'text-emerald-400' : 'text-red-400'}`}>
                    {diagnosticData.anuncios.clienteAnunciaGoogle ? 'Sim' : 'Não'}
                  </h4>
                  <p className="text-xs text-gray-400 font-medium">você anuncia no Google</p>
                </div>
              </div>

              {/* Card 2: Você Anuncia no Instagram/Facebook */}
              <div className="bg-[#141626] p-5 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm hover:border-pink-500/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-pink-400" />
                </div>
                <div>
                  <h4 className={`text-2xl font-black ${metaAdsStatus === true ? 'text-emerald-400' : metaAdsStatus === false ? 'text-red-400' : 'text-amber-400'}`}>
                    {metaAdsStatus === true ? 'Sim' : metaAdsStatus === false ? 'Não' : 'N/A'}
                  </h4>
                  <p className="text-xs text-gray-400 font-medium">você anuncia no Meta</p>
                </div>
              </div>

              {/* Card 3: Concorrentes no Google */}
              <div className="bg-[#141626] p-5 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm hover:border-amber-500/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Activity className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-amber-400">{diagnosticData.anuncios.concorrentesGoogle}/3</h4>
                  <p className="text-xs text-gray-400 font-medium">concorrentes no Google</p>
                </div>
              </div>

              {/* Card 4: Concorrentes no Meta */}
              <div className="bg-[#141626] p-5 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm hover:border-purple-500/30 transition-all">
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Layers className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-purple-400">{metaCompetitorsVerified ? `${diagnosticData.anuncios.concorrentesMeta}/3` : 'N/A'}</h4>
                  <p className="text-xs text-gray-400 font-medium">concorrentes no Meta</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-900/20 border border-orange-500/30 p-4 rounded-xl mb-6">
              <p className="text-orange-400 font-bold text-sm">
                {diagnosticData.anuncios.clienteAnunciaGoogle
                  ? "Você já anuncia e isso está bem feito, é um ativo que podemos usar para recuperar pacientes rapidamente."
                  : `A consulta indica que você não anuncia no Google. Status no Meta: ${metaAdsStatus === true ? 'ativo' : metaAdsStatus === false ? 'inativo' : 'não confirmado'}.`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div>
                <h4 className="text-sm font-bold text-purple-400 mb-2 uppercase">O que os números mostram</h4>
                <ul className="list-disc pl-4 space-y-2 text-sm text-gray-300">
                  <li>Você anuncia no Google e no Meta: Google ativo: {diagnosticData.anuncios.clienteAnunciaGoogle ? 'sim' : 'não'} | Meta ativo: {metaAdsStatus === true ? 'sim' : metaAdsStatus === false ? 'não' : 'não confirmado'}.</li>
                  <li>Concorrentes anunciando no Google na região: {diagnosticData.anuncios.concorrentesGoogle} | concorrentes anunciando no Meta: {metaCompetitorsVerified ? diagnosticData.anuncios.concorrentesMeta : 'não confirmado'}.</li>
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
        <div className="bg-[#141626] p-8 rounded-2xl border border-gray-800 shadow-xl mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Projeção Financeira
                </span>
                <h3 className="text-xl font-black text-white">Dinheiro na mesa</h3>
              </div>
              <p className="text-xs text-gray-400">
                Estimativa fundamentada da receita que sua clínica deixa de faturar por mês por falta de posicionamento no Google e Meta Ads.
              </p>
            </div>
            <div className="bg-[#0d0f19] px-4 py-2 rounded-xl border border-gray-800 text-right">
              <span className="text-[10px] text-gray-400 font-bold block uppercase">Ticket Médio Considerado</span>
              <span className="text-lg font-black text-emerald-400">R$ {ticketMedio.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Cards com Parâmetros de Cálculo da Região */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#0d0f19] p-4 rounded-xl border border-gray-800">
              <span className="text-[11px] font-bold text-gray-400 block mb-1 uppercase">Volume Estimado de Buscas</span>
              <span className="text-xl font-black text-white">{buscasMes} buscas/mês</span>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Pessoas buscando por "{formData.keyword || 'Dentista'}" em {formData.cityName || 'sua região'}.</p>
            </div>
            <div className="bg-[#0d0f19] p-4 rounded-xl border border-gray-800">
              <span className="text-[11px] font-bold text-gray-400 block mb-1 uppercase">Ticket Médio por Cliente</span>
              <span className="text-xl font-black text-emerald-400">R$ {ticketMedio.toLocaleString('pt-BR')}</span>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Valor médio estimado por paciente/tratamento fechado.</p>
            </div>
            <div className="bg-[#0d0f19] p-4 rounded-xl border border-gray-800">
              <span className="text-[11px] font-bold text-gray-400 block mb-1 uppercase">Fórmula do Cálculo</span>
              <span className="text-xs font-bold text-indigo-300 block mt-1">Buscas Mensais × % Conversão × Ticket Médio</span>
              <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Cálculo direto de receita com base na dominância de mapa (SoLV).</p>
            </div>
          </div>

          {/* Scenarios Breakdown com Vendas e Cálculos Simples */}
          <div className="space-y-6 mb-6">
            {/* 1. Cenário Conservador */}
            <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <h4 className="text-sm font-bold text-white">Conservador: Dominar 1/3 da Região (Top 3 em 3 de 9 pontos)</h4>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 pl-4">
                    🎯 Conversão estimada: <strong>2% das buscas</strong> = <strong>{Math.round(buscasMes * 0.02)} novos clientes/mês</strong> ({Math.round(buscasMes * 0.02)} vendas × R$ {ticketMedio.toLocaleString('pt-BR')})
                  </p>
                </div>
                <span className="text-xl font-black text-emerald-400">R$ {cons.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden mt-3">
                <div className="bg-emerald-500 h-full w-1/3 rounded-full"></div>
              </div>
            </div>

            {/* 2. Cenário Moderado */}
            <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <h4 className="text-sm font-bold text-white">Moderado: Dominar Metade da Região (Top 3 em 5 de 9 pontos)</h4>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 pl-4">
                    🎯 Conversão estimada: <strong>4% das buscas</strong> = <strong>{Math.round(buscasMes * 0.04)} novos clientes/mês</strong> ({Math.round(buscasMes * 0.04)} vendas × R$ {ticketMedio.toLocaleString('pt-BR')})
                  </p>
                </div>
                <span className="text-xl font-black text-blue-400">R$ {mod.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden mt-3">
                <div className="bg-blue-500 h-full w-1/2 rounded-full"></div>
              </div>
            </div>

            {/* 3. Cenário Agressivo */}
            <div className="bg-[#0d0f19] p-5 rounded-xl border border-gray-800">
              <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <h4 className="text-sm font-bold text-white">Agressivo: Dominar Toda a Região (Top 3 nos 9 pontos)</h4>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 pl-4">
                    🎯 Conversão estimada: <strong>6% das buscas</strong> = <strong>{Math.round(buscasMes * 0.06)} novos clientes/mês</strong> ({Math.round(buscasMes * 0.06)} vendas × R$ {ticketMedio.toLocaleString('pt-BR')})
                  </p>
                </div>
                <span className="text-xl font-black text-purple-400">R$ {agr.toLocaleString('pt-BR')}/mês</span>
              </div>
              <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden mt-3">
                <div className="bg-purple-500 h-full w-full rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="bg-[#0d0f19] p-4 rounded-xl border border-amber-500/30 text-amber-200 text-xs font-medium leading-relaxed">
            💡 <strong>Resumo Comercial:</strong> Cada mês sem posicionamento no topo do Google representa até <strong>{Math.round(buscasMes * 0.06)} vendas de tratamentos perdidas</strong> para concorrentes locais.
          </div>
        </div>

        {/* Oportunidades & Pontos Fracos Detectados */}
        {(() => {
          const opsList = (Array.isArray(diagnosticData?.oportunidadesDetectadas) && diagnosticData.oportunidadesDetectadas.length > 0)
            ? diagnosticData.oportunidadesDetectadas
            : computeOportunidadesDetectadas(diagnosticData, formData, selectedProspect);

          const handleGerarOportunidadesIA = async () => {
            if (!selectedProspect) return;
            const currentDiag = diagnosticData || selectedProspect.marketingDiagnostic || {};

            Swal.fire({
              title: 'Analisando com IA...',
              text: `Gerando 10 oportunidades estratégicas exclusivas para ${selectedProspect.clinicName}...`,
              allowOutsideClick: false,
              didOpen: () => { Swal.showLoading(); }
            });

            let newOps: string[] = [];
            const aiRes = await generateOportunidadesPersonalizadasIA(selectedProspect, currentDiag);
            if (aiRes.success && aiRes.oportunidades && aiRes.oportunidades.length > 0) {
              newOps = aiRes.oportunidades;
            } else {
              newOps = computeOportunidadesDetectadas(currentDiag, formData, selectedProspect);
            }

            const updatedDiag = { ...currentDiag, oportunidadesDetectadas: newOps };
            await saveProspectDoc(selectedProspect.id, { marketingDiagnostic: updatedDiag });
            setDiagnosticData(updatedDiag);
            setSelectedProspect({ ...selectedProspect, marketingDiagnostic: updatedDiag });

            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: '10 Oportunidades personalizadas salvas com sucesso!',
              showConfirmButton: false,
              timer: 2500
            });
          };

          return (
            <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Target className="text-amber-400" size={22} />
                    Oportunidades & Pontos Fracos Detectados
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Pontos de melhoria identificados automaticamente pela IA e pelos dados do painel de diagnóstico.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGerarOportunidadesIA}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles size={15} />
                  {diagnosticData?.oportunidadesDetectadas?.length ? 'Atualizar Oportunidades (IA)' : 'Gerar Oportunidades'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {opsList.map((item: string, idx: number) => (
                  <div key={idx} className="bg-[#0d0f19] p-4 rounded-xl border border-gray-800/80 flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 flex-shrink-0 mt-0.5">
                      <AlertTriangle size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 leading-relaxed font-medium">
                        {item}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Plano de 30 dias (10 Passos) */}
        <div className="bg-[#1a1d2d] p-8 rounded-2xl border border-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h3 className="text-xl font-bold text-white">Plano de 30 Dias (10 Passos Estratégicos)</h3>
            <span className="bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">
              10 Ações Geradas por IA
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-6">
            Plano de execução em 10 etapas sequenciais em ordem de prioridade para dominar a sua região.
          </p>

          <div className="space-y-4">
            {(() => {
              const baseList = Array.isArray(diagnosticData.planoAcao) ? diagnosticData.planoAcao : [];
              const kw = formData.keyword || 'Dentista';
              const city = formData.cityName || 'sua cidade';
              const vel = diagnosticData.site?.velocidade;

              const defaultTenSteps = [
                {
                  titulo: `Otimizar Perfil no Google com a palavra-chave "${kw}"`,
                  descricao: `Adequar o nome do perfil e incluir "${kw}" na categoria e descrição principal para subir no ranking local em ${city}.`,
                  imp: "ALTO", esf: "BAIXO"
                },
                {
                  titulo: "Processo Ativo para Solicitar Avaliações 5 Estrelas",
                  descricao: "Gerar link direto e orientar a equipe a solicitar avaliações com fotos dos pacientes satisfeitos após o atendimento.",
                  imp: "ALTO", esf: "BAIXO"
                },
                {
                  titulo: "Otimizar Velocidade e SEO Técnico do Site",
                  descricao: vel ? `Corrigir pontos técnicos para aumentar a nota de desempenho que atualmente é ${vel}/100.` : "Criar uma Landing Page de alta velocidade com carregamento mobile abaixo de 2s.",
                  imp: "ALTO", esf: "MÉDIO"
                },
                {
                  titulo: `Lançar Anúncios no Google Ads focados em "${kw}"`,
                  descricao: `Criar campanhas ativas de pesquisa para capturar clientes que buscam por "${kw}" em ${city} com intenção imediata de agendamento.`,
                  imp: "ALTO", esf: "MÉDIO"
                },
                {
                  titulo: "Lançar Campanhas no Meta Ads (Instagram & Facebook)",
                  descricao: "Criar anúncios em formato de vídeo no Feed, Stories e Reels destacando os diferenciais da clínica e oferta de boas-vindas.",
                  imp: "ALTO", esf: "MÉDIO"
                },
                {
                  titulo: "Instalar Rastreamento de Conversões (Pixel Meta, GA4 e GTM)",
                  descricao: "Configurar as tags de medição para contabilizar exatamente quantos leads clicam no botão de WhatsApp vindos dos anúncios.",
                  imp: "MÉDIO", esf: "MÉDIO"
                },
                {
                  titulo: "Manter Calendário de Conteúdo Semanal no Instagram",
                  descricao: "Publicar conteúdos educativos sobre tratamentos e bastidores da clínica semanalmente para esquentar a audiência local.",
                  imp: "MÉDIO", esf: "MÉDIO"
                },
                {
                  titulo: "Configurar Atendimento Rápido no WhatsApp Web/API",
                  descricao: "Instalar respostas automáticas de boas-vindas para garantir atendimento ao lead em menos de 5 minutos.",
                  imp: "ALTO", esf: "BAIXO"
                },
                {
                  titulo: "Responder 100% das Avaliações no Perfil do Google",
                  descricao: "Responder todos os comentários dos clientes incorporando palavras-chave para sinalizar engajamento ao algoritmo do Google.",
                  imp: "MÉDIO", esf: "BAIXO"
                },
                {
                  titulo: "Implementar Campanhas de Remarketing e Retenção",
                  descricao: "Criar anúncios e sequências de mensagens para pacientes inativos há mais de 6 meses para agendamento de retorno.",
                  imp: "MÉDIO", esf: "BAIXO"
                }
              ];

              const mergedList = [...baseList];
              while (mergedList.length < 10) {
                const idx = mergedList.length;
                mergedList.push(defaultTenSteps[idx] || {
                  titulo: `Passo ${idx + 1}: Ação Estratégica de Crescimento`,
                  descricao: "Otimizar funil de vendas e conversão de leads para aumentar o faturamento mensal.",
                  imp: "MÉDIO", esf: "BAIXO"
                });
              }

              return mergedList.slice(0, 10).map((p: any, i: number) => (
                <div key={i} className="flex gap-4 p-5 bg-[#0d0f19] rounded-xl border border-gray-800 hover:border-purple-500/30 transition-colors">
                  <div className="w-8 h-8 shrink-0 bg-purple-900/60 text-purple-200 border border-purple-500/40 rounded-full flex items-center justify-center font-black text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white mb-1">{p.titulo}</h4>
                    <p className="text-xs text-gray-300 mb-2.5 leading-relaxed">{p.descricao}</p>
                    <div className="flex gap-2">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.imp === 'ALTO' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-blue-950/60 text-blue-400 border border-blue-500/30'}`}>
                        IMPACTO {p.imp}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${p.esf === 'BAIXO' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'}`}>
                        ESFORÇO {p.esf}
                      </span>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

      </div>
    </div>
  );
};

  const handleCancelOrRemoveQueueItem = (id: string) => {
    const target = diagnosticQueue.find(item => item.id === id);
    if (target && target.status === 'running') {
      const cancelledItem = {
        ...target,
        status: 'error' as const,
        error: 'Diagnóstico cancelado manualmente pelo usuário.',
        finishedAt: Date.now(),
        duration: target.startedAt ? Date.now() - target.startedAt : 0,
        logs: [
          ...(target.logs || []),
          {
            timestamp: Date.now(),
            step: '🛑 Diagnóstico cancelado pelo usuário.',
            status: 'error' as const
          }
        ]
      };
      setDiagnosticQueue(prev => prev.map(item => item.id === id ? cancelledItem : item));
      saveDiagnosticQueueItem(cancelledItem);
    } else {
      setDiagnosticQueue(prev => prev.filter(item => item.id !== id));
      deleteDiagnosticQueueItem(id);
    }

    isProcessingRef.current = false;
    setIsGenerating(false);
  };

  const handleClearFinishedQueue = () => {
    setDiagnosticQueue(prev => prev.filter(item => item.status === 'running' || item.status === 'waiting'));
    clearFinishedDiagnosticQueue();
  };

  const topCompetitors = diagnosticData?.concorrentes || diagnosticData?.gmn?.concorrentes || [];
  const clientRank = diagnosticData?.posicaoCliente || diagnosticData?.gmn?.posicaoMedia || '—';
  const hasValidClientRank = clientRank !== '—' && clientRank !== undefined && clientRank !== null;

  return (
    <div className="flex h-screen flex-col md:flex-row bg-stone-50 p-2 gap-2 relative overflow-y-auto md:overflow-hidden">
      {/* Left Sidebar */}
      <div className={`w-full ${isLeftPanelCollapsed ? 'md:w-16' : 'md:w-80 lg:w-[360px]'} shrink-0 bg-white rounded-2xl md:rounded-3xl border border-stone-200 flex flex-col overflow-hidden shadow-sm transition-all duration-300 h-[68vh] md:h-auto md:max-h-none ${isFullscreen ? 'hidden' : 'flex'}`}>
        <div className="p-3 md:p-4 border-b border-stone-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <button 
                onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 hidden md:block shrink-0"
                title={isLeftPanelCollapsed ? "Expandir painel" : "Recolher painel"}
              >
                {isLeftPanelCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              {!isLeftPanelCollapsed && (
                <h2 className="text-lg font-black text-stone-800 flex items-center gap-2 truncate">
                  <Activity className="text-[#5271FF] shrink-0" /> Diagnósticos
                </h2>
              )}
            </div>
            {!isLeftPanelCollapsed && (
              <button
                onClick={() => setShowQueueModal(true)}
                className={`relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md border cursor-pointer shrink-0 ${
                  queueCounts.running > 0
                    ? 'bg-amber-500 border-amber-400 text-white animate-pulse shadow-amber-500/30'
                    : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-blue-500/20'
                }`}
                title="Fila de Diagnósticos"
              >
                <ListOrdered size={16} />
                <span className="hidden sm:inline">Fila</span>
                {queueCounts.total > 0 && (
                  <span className="ml-0.5 px-2 py-0.5 rounded-full text-xs font-black bg-white/20 text-white">
                    {queueCounts.waiting + queueCounts.running}
                  </span>
                )}
                {queueCounts.running > 0 && (
                  <Loader2 size={14} className="animate-spin" />
                )}
              </button>
            )}
          </div>
          {!isLeftPanelCollapsed && <p className="text-xs text-stone-500 mb-3">Prospecções Presenciais marcadas</p>}

          {!isLeftPanelCollapsed && (
            <>
              {/* Abas Pill: Ativas / Arquivados / Lixeira */}
              <div className="flex bg-[#1e3a8a]/5 p-1 rounded-xl gap-1 shadow-inner border border-[#1e3a8a]/10 mb-2 md:mb-3 text-xs w-full overflow-hidden">
                <button
                  onClick={() => setActiveTab('ativas')}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 text-[9px] sm:text-[10px] font-black uppercase tracking-tight whitespace-nowrap rounded-lg transition-all ${activeTab === 'ativas' ? 'bg-white shadow-sm text-[#1e3a8a] border border-[#1e3a8a]/10' : 'text-stone-500 hover:text-[#1e3a8a]'}`}
                >
                  <Layers size={11} className="shrink-0" />
                  <span className="truncate">Ativas ({countAtivas})</span>
                </button>
                <button
                  onClick={() => setActiveTab('arquivados')}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 text-[9px] sm:text-[10px] font-black uppercase tracking-tight whitespace-nowrap rounded-lg transition-all ${activeTab === 'arquivados' ? 'bg-blue-600 shadow-sm text-white' : 'text-stone-500 hover:text-blue-600'}`}
                >
                  <Archive size={11} className="shrink-0" />
                  <span className="truncate">Arquivados ({countArquivados})</span>
                </button>
                <button
                  onClick={() => setActiveTab('lixeira')}
                  className={`flex-1 min-w-0 flex items-center justify-center gap-1 py-1.5 px-1 text-[9px] sm:text-[10px] font-black uppercase tracking-tight whitespace-nowrap rounded-lg transition-all ${activeTab === 'lixeira' ? 'bg-red-500 shadow-sm text-white' : 'text-stone-500 hover:text-red-500'}`}
                >
                  <Trash2 size={11} className="shrink-0" />
                  <span className="truncate">Lixeira ({countLixeira})</span>
                </button>
              </div>

              {/* Busca por Nome */}
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

              <div className="flex gap-2 mt-2">
                <select
                  value={responsibleFilter}
                  onChange={e => setResponsibleFilter(e.target.value)}
                  className="min-w-0 flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#5271FF]"
                >
                  <option value="">Todos os líderes</option>
                  {responsibles.map(responsible => <option key={responsible} value={responsible}>{responsible}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setResponsibleFilter('');
                    setActiveTab('ativas');
                    setDiagFilter('todos');
                  }}
                  className="shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#5271FF] border border-[#5271FF]/20 rounded-xl hover:bg-[#5271FF]/5"
                >
                  Limpar
                </button>
              </div>

              {/* Filtro 50/50: Com Diagnóstico vs Sem Diagnóstico */}
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <button
                  onClick={() => setDiagFilter(current => current === 'com_diag' ? 'todos' : 'com_diag')}
                  className={`py-1.5 px-2 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    diagFilter === 'com_diag'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  <Sparkles size={11} className={diagFilter === 'com_diag' ? 'text-white' : 'text-emerald-500'} />
                  <span className="truncate">Com ({countComDiag})</span>
                </button>

                <button
                  onClick={() => setDiagFilter(current => current === 'sem_diag' ? 'todos' : 'sem_diag')}
                  className={`py-1.5 px-2 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    diagFilter === 'sem_diag'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                      : 'bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200'
                  }`}
                >
                  <AlertCircle size={11} className={diagFilter === 'sem_diag' ? 'text-white' : 'text-amber-500'} />
                  <span className="truncate">Sem ({countSemDiag})</span>
                </button>
              </div>
            </>
          )}
        </div>

        {!isLeftPanelCollapsed ? (
          <div className="flex-1 min-h-0 overflow-y-auto pt-1 md:pt-2 pb-4 md:pb-24 px-2 space-y-1.5 custom-scrollbar">
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
                        <span
                          title="Diagnóstico Pronto e Disponível!"
                          className={`shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                            selectedProspect?.id === p.id
                              ? 'bg-emerald-400/30 text-white border-emerald-300/40'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}
                        >
                          <Sparkles size={10} className="fill-emerald-500 text-emerald-500 shrink-0" />
                          <span>PRONTO</span>
                        </span>
                      )}
                      {/* Queue status badges */}
                      {(() => {
                        const qItem = diagnosticQueue.find(q => q.prospectId === p.id && (q.status === 'waiting' || q.status === 'running'));
                        if (qItem?.status === 'running') return (
                          <span className="shrink-0 flex items-center gap-0.5 bg-amber-500/20 text-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse" title="Diagnóstico em andamento">
                            <Loader2 size={9} className="animate-spin" /> GERANDO
                          </span>
                        );
                        if (qItem?.status === 'waiting') return (
                          <span className="shrink-0 flex items-center gap-0.5 bg-blue-500/20 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded-full" title="Na fila de diagnósticos">
                            <Clock size={9} /> FILA
                          </span>
                        );
                        return null;
                      })()}
                      {recentlyFinishedIds.has(p.id) && (
                        <span className="shrink-0 flex items-center gap-0.5 bg-green-500/20 text-green-600 text-[9px] font-black px-1.5 py-0.5 rounded-full animate-bounce" title="Diagnóstico recém concluído!">
                          <CheckCircle size={9} /> PRONTO!
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
        ) : (
          <div className="flex-1 flex flex-col items-center justify-start pt-6 space-y-4">
            <button 
              onClick={() => setIsLeftPanelCollapsed(false)}
              className="p-3.5 rounded-2xl bg-[#5271FF]/10 text-[#5271FF] hover:bg-[#5271FF]/20 transition-colors shadow-sm"
              title="Expandir Lista de Diagnósticos"
            >
              <Activity size={22} />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-screen md:min-h-0 bg-white rounded-2xl md:rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col">
        {selectedProspect ? (
          <div className="h-full flex flex-col bg-[#0d0f19] rounded-2xl overflow-hidden">
            <div className="p-2 md:p-4 border-b border-gray-800 bg-[#1a1d2d] no-print">
              <div className="grid grid-cols-2 md:flex items-stretch gap-1.5 md:gap-2 no-print">
                <button
                  onClick={() => {
                    if (selectedText) {
                      setSelectedTextModal(selectedText);
                      setSelectedText('');
                    } else {
                      setSelectedTextModal('');
                    }
                    setShowVariableModal(true);
                  }}
                  title="Abrir gerador de tags e mapeamento de variáveis para automação das cartas"
                  className="bg-[#5271FF] hover:bg-blue-600 text-white border border-indigo-400/40 px-2.5 py-2 rounded-xl font-bold text-[11px] md:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md text-center shrink-0"
                >
                  <Sparkles size={14} className="text-amber-300 shrink-0" />
                  <span>+ Gerar Tag</span>
                  {selectedText && (
                    <span className="bg-black/40 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-300 truncate max-w-[110px] border border-emerald-500/20">
                      "{selectedText}"
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setShowDiagnosticForm(!showDiagnosticForm)}
                  title="Editar dados da empresa, palavra-chave e executar novo rastreamento real"
                  className="bg-purple-600/40 hover:bg-purple-600/70 text-purple-200 border border-purple-500/40 px-2 md:px-3.5 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
                >
                  <Brain size={14} />
                  {showDiagnosticForm ? 'Ver Relatório' : '✏️ Parâmetros / Novo Rastreamento'}
                </button>

                {diagnosticData && !showDiagnosticForm && (
                  <>
                    <button
                      onClick={() => setDiagTheme(diagTheme === 'light' ? 'dark' : 'light')}
                      title="Alternar entre Tema Claro (Impressão/Carta) e Tema Escuro (Apresentação)"
                      className={`px-2 md:px-3.5 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border text-center ${
                        diagTheme === 'light'
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-sm'
                          : 'bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-200 border-indigo-500/40'
                      }`}
                    >
                      {diagTheme === 'light' ? <Sun size={14} className="text-amber-600" /> : <Moon size={14} className="text-indigo-400" />}
                      {diagTheme === 'light' ? 'Modo Claro (Carta/Impressão)' : 'Modo Escuro (Apresentação)'}
                    </button>

                    <button
                      onClick={() => setShowPresentationModal(true)}
                      title="Visualizar Diagnóstico em Modo Apresentação de Slides"
                      className="bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-200 border border-emerald-500/40 px-2 md:px-3.5 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md cursor-pointer text-center"
                    >
                      <Tv size={14} className="text-emerald-400" />
                      Apresentação (Slides)
                    </button>

                    <button
                      onClick={handlePrintDiagnostic}
                      title="Imprimir este Diagnóstico"
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-2 md:px-3.5 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Printer size={14} />
                      Imprimir
                    </button>

                    <button
                      onClick={() => setIsFullscreen(true)}
                      title="Abrir em Tela Cheia"
                      className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-2 md:px-3.5 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Maximize2 size={14} />
                      Tela Cheia
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 md:p-4">
              {showDiagnosticForm || !diagnosticData ? (
                renderDiagnosticForm()
              ) : (
                <div className={diagTheme === 'light' ? 'diag-theme-light' : ''}>
                  {renderDiagnostic()}
                </div>
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
        <div className={`fixed inset-0 z-[9999999] flex flex-col w-screen h-screen overflow-hidden p-6 ${diagTheme === 'light' ? 'bg-[#f1f5f9]' : 'bg-[#0d0f19]'}`}>
          <div className={`p-3 md:p-4 border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl mb-4 no-print shrink-0 ${diagTheme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1a1d2d] border-gray-800'}`}>
            <div>
              <h2 className={`text-base md:text-xl font-black ${diagTheme === 'light' ? 'text-slate-900' : 'text-white'}`}>{selectedProspect.clinicName}</h2>
              <p className={`text-[10px] md:text-xs ${diagTheme === 'light' ? 'text-slate-500' : 'text-gray-400'}`}>Diagnóstico Completo de Marketing</p>
            </div>

            <div className="grid grid-cols-2 md:flex items-stretch gap-1.5 md:gap-3 no-print">
              <button
                onClick={() => setDiagTheme(diagTheme === 'light' ? 'dark' : 'light')}
                title="Alternar entre Modo Claro e Escuro"
                className={`px-2 md:px-3.5 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border text-center ${
                  diagTheme === 'light'
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-sm'
                    : 'bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-200 border-indigo-500/40'
                }`}
              >
                {diagTheme === 'light' ? <Sun size={14} className="text-amber-600" /> : <Moon size={14} className="text-indigo-400" />}
                {diagTheme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
              </button>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                title="Refazer e regerar o diagnóstico com IA"
                className="bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 px-2 md:px-4 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 md:gap-2 transition-all active:scale-95 disabled:opacity-50 text-center"
              >
                {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <RotateCw size={14} />}
                {isGenerating ? 'Analisando...' : 'Refazer Diagnóstico'}
              </button>

              <button
                onClick={() => setShowPresentationModal(true)}
                title="Visualizar Diagnóstico em Modo Apresentação de Slides"
                className="bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-200 border border-emerald-500/40 px-2 md:px-4 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 md:gap-2 transition-all active:scale-95 shadow-md cursor-pointer text-center"
              >
                <Tv size={14} className="text-emerald-400" />
                Apresentação (Slides)
              </button>

              <button
                onClick={handlePrintDiagnostic}
                title="Imprimir este Diagnóstico"
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-2 md:px-4 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 md:gap-2 transition-all active:scale-95"
              >
                <Printer size={14} />
                Imprimir
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="bg-red-600 hover:bg-red-500 text-white px-2 md:px-4 py-2 rounded-xl font-bold text-[10px] md:text-xs flex items-center justify-center gap-1.5 md:gap-2 transition-all active:scale-95 shadow-md"
              >
                <Minimize2 size={14} />
                Sair da Tela Cheia
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto rounded-2xl">
            <div className={diagTheme === 'light' ? 'diag-theme-light' : ''}>
              {renderDiagnostic()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL MAPEAMENTO DE VARIÁVEIS & TAGS DAS CARTAS */}
      <VariableMappingModal
        isOpen={showVariableModal}
        onClose={() => {
          setShowVariableModal(false);
          setSelectedTextModal('');
        }}
        selectedProspect={selectedProspect}
        diagnosticData={diagnosticData}
        initialSelectedText={selectedTextModal}
      />

      {/* MODAL RECORTE & REDIMENSIONAMENTO VISUAL */}
      <VisualCropModal
        isOpen={showVisualCropModal}
        imageUrl={diagnosticData?.gmn?.mapaCalorImg || (diagnosticData?.gmn?.scanId ? `https://lf-static-v2.localfalcon.com/image/${diagnosticData.gmn.scanId}` : '')}
        initialZoom={imgZoom}
        initialOffsetX={imgOffsetX}
        initialOffsetY={imgOffsetY}
        onClose={() => setShowVisualCropModal(false)}
        onSave={(zoom, x, y) => handleUpdateCrop(zoom, x, y)}
      />

      {/* ═══ QUEUE MODAL ═══ */}
      {showQueueModal && createPortal(
        <div className="fixed inset-0 z-[9999990] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowQueueModal(false); setTerminalOpenId(null); }}>
          <div className="bg-[#0d0f19] w-[90vw] max-w-3xl max-h-[85vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between bg-[#1a1d2d]">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ListOrdered size={20} className="text-indigo-400" /> Fila de Diagnósticos
                </h3>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                  {queueCounts.running > 0 && <span className="text-amber-400 font-medium">⚡ {queueCounts.running} em andamento</span>}
                  {queueCounts.waiting > 0 && <span className="text-blue-400 font-medium">🕐 {queueCounts.waiting} aguardando</span>}
                  {queueCounts.done > 0 && <span className="text-green-400 font-medium">✅ {queueCounts.done} concluídos</span>}
                  {queueCounts.error > 0 && <span className="text-red-400 font-medium">❌ {queueCounts.error} com erro</span>}
                  {queueCounts.total === 0 && <span className="text-gray-500">Nenhum diagnóstico na fila</span>}
                  <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-700/50 flex items-center gap-1" title="Histórico permanente mantido para auditoria completa de todas as requisições e erros">
                    <Clock size={10} className="text-emerald-400 inline" /> Histórico permanente (Registro de Auditoria)
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(queueCounts.done > 0 || queueCounts.error > 0) && (
                  <button onClick={handleClearFinishedQueue} className="text-[10px] font-black uppercase tracking-wider text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700 transition-all" title="Limpar finalizados">
                    <Trash2 size={11} className="inline mr-1" />Limpar
                  </button>
                )}
                <button onClick={() => { setShowQueueModal(false); setTerminalOpenId(null); }} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-1">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar diagnóstico por nome ou local..."
                  value={queueSearchTerm}
                  onChange={e => setQueueSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-900/80 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {diagnosticQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <ListOrdered size={40} className="opacity-20 mb-3" />
                  <p className="font-bold text-sm">A fila está vazia</p>
                  <p className="text-xs mt-1">Selecione uma clínica e clique em "Adicionar à Fila" para iniciar.</p>
                </div>
              ) : (
                diagnosticQueue
                  .slice()
                  .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
                  .filter(item => {
                    if (!queueSearchTerm.trim()) return true;
                    const q = queueSearchTerm.toLowerCase();
                    return (item.clinicName || '').toLowerCase().includes(q) || (item.location || '').toLowerCase().includes(q);
                  })
                  .map(item => (
                  <div key={item.id} className={`rounded-xl border p-3 transition-all ${
                    item.status === 'running' ? 'bg-amber-950/30 border-amber-500/40' :
                    item.status === 'done' ? 'bg-emerald-950/20 border-emerald-500/30' :
                    item.status === 'error' ? 'bg-red-950/20 border-red-500/30' :
                    'bg-gray-900/50 border-gray-700'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.status === 'running' && <Loader2 size={16} className="text-amber-400 animate-spin shrink-0" />}
                        {item.status === 'done' && <CheckCircle size={16} className="text-green-400 shrink-0" />}
                        {item.status === 'error' && <XCircle size={16} className="text-red-400 shrink-0" />}
                        {item.status === 'waiting' && <Clock size={16} className="text-blue-400 shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-white truncate">{item.clinicName}</h4>
                            
                            {item.actionType === 'fetch_existing_gmn' ? (
                              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" title="Relatório baixado do histórico (0 Créditos)">
                                📥 Puxou Diagnóstico (0 Créditos)
                              </span>
                            ) : item.actionType === 'force_new_gmn' ? (
                              <span className="bg-orange-950/80 text-orange-300 border border-orange-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0" title="Novo scan pago no Local Falcon (25 Créditos)">
                                ⚡ NOVO Scan Pago (25 Créditos)
                              </span>
                            ) : item.actionType === 'rerun_module' ? (
                              <span className="bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                🔄 Módulo {item.targetModule?.toUpperCase()}
                              </span>
                            ) : (
                              <span className="bg-blue-950/80 text-blue-300 border border-blue-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                ⚡ Diagnóstico Completo
                              </span>
                            )}

                            {item.requestedBy && (
                              <span className="text-[10px] text-gray-300 bg-gray-800/90 px-2 py-0.5 rounded border border-gray-700/60 shrink-0 font-medium" title="Solicitado por">
                                👤 {item.requestedBy}
                              </span>
                            )}

                            {item.addedAt && (
                              <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-700/50 shrink-0 font-mono flex items-center gap-1" title="Data e Hora do Scan">
                                🕒 {new Date(item.addedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} às {new Date(item.addedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'running' && (
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded">
                            {formatDuration(Date.now() - (item.startedAt || Date.now()))}
                          </span>
                        )}
                        {item.duration && (
                          <span className="text-[10px] font-mono text-gray-300 bg-gray-800 px-2 py-0.5 rounded" title="Tempo total">
                            <Clock size={9} className="inline mr-0.5" />{formatDuration(item.duration)}
                          </span>
                        )}
                        {/* Terminal button */}
                        {(item.status === 'running' || item.status === 'done' || item.status === 'error') && (
                          <button
                            onClick={() => setTerminalOpenId(terminalOpenId === item.id ? null : item.id)}
                            className={`p-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1 ${
                              terminalOpenId === item.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                            title="Ver terminal de logs"
                          >
                            <Terminal size={13} />
                          </button>
                        )}
                        {item.status === 'running' ? (
                          <button
                            onClick={() => handleCancelOrRemoveQueueItem(item.id)}
                            className="px-2 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-500/40 transition-all text-xs font-bold flex items-center gap-1 shrink-0"
                            title="Cancelar este diagnóstico em andamento"
                          >
                            <X size={13} className="text-red-300" />
                            <span className="text-[10px] uppercase font-black tracking-wider">Cancelar</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCancelOrRemoveQueueItem(item.id)}
                            className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-all shrink-0"
                            title="Remover da fila"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    {item.error && (
                      <div className="mt-2 text-xs text-red-300 bg-red-950/30 p-2 rounded-lg border border-red-800">
                        {item.error}
                      </div>
                    )}
                    {/* Terminal Logs */}
                    {terminalOpenId === item.id && (
                      <div className="mt-3 bg-black/60 border border-gray-700 rounded-xl p-3 max-h-64 overflow-y-auto font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 mb-2 text-gray-500">
                          <Terminal size={11} />
                          <span className="font-bold uppercase tracking-wider text-[9px]">Terminal — {item.clinicName}</span>
                        </div>
                        {item.logs.map((log, i) => (
                          <div key={i} className={`flex gap-2 py-0.5 ${
                            log.status === 'error' ? 'text-red-400' : log.status === 'running' ? 'text-amber-300' : 'text-green-300'
                          }`}>
                            <span className="text-gray-600 shrink-0">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                            <span className="flex-1">{log.step}</span>
                            {log.duration !== undefined && (
                              <span className="text-gray-500 shrink-0">[{formatDuration(log.duration)}]</span>
                            )}
                          </div>
                        ))}
                        {item.status === 'running' && (
                          <div className="flex items-center gap-1.5 mt-1 text-amber-400 animate-pulse">
                            <Loader2 size={10} className="animate-spin" /> Processando...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* PORTAL DO MODO APRESENTAÇÃO (SLIDES) */}
      {showPresentationModal && selectedProspect && diagnosticData && createPortal(
        <div className="fixed inset-0 z-[99999999] bg-[#090b13] flex flex-col w-screen h-screen overflow-hidden select-none font-sans">
          {/* Header Bar */}
          <div className="p-4 border-b border-gray-800/80 flex items-center justify-between bg-[#131625] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Tv size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">{selectedProspect.clinicName}</h2>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Apresentação de Slides
                  </span>
                </div>
                <p className="text-xs text-gray-400">Diagnóstico Estratégico de Presença Digital</p>
              </div>
            </div>

            {/* Slide Navigation Controls */}
            <div className="flex items-center gap-4">
              {/* Step dots */}
              <div className="flex items-center gap-1.5 bg-[#090b13] px-3 py-1.5 rounded-xl border border-gray-800">
                {[0, 1, 2, 3, 4, 5].map(idx => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlideIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      currentSlideIndex === idx
                        ? 'bg-emerald-400 w-6'
                        : 'bg-gray-700 hover:bg-gray-500'
                    }`}
                    title={`Ir para Slide ${idx + 1}`}
                  />
                ))}
                <span className="ml-2 text-xs font-black text-gray-300">
                  Slide {currentSlideIndex + 1} de 6
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentSlideIndex(prev => Math.max(prev - 1, 0))}
                  disabled={currentSlideIndex === 0}
                  className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white transition-all active:scale-95 border border-gray-700"
                  title="Slide Anterior (Seta Esquerda)"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(prev => Math.min(prev + 1, 5))}
                  disabled={currentSlideIndex === 5}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white transition-all active:scale-95 border border-emerald-500 shadow-lg shadow-emerald-600/20"
                  title="Próximo Slide (Seta Direita / Espaço)"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setShowPresentationModal(false)}
                  className="ml-2 px-3 py-2 rounded-xl bg-gray-800/80 hover:bg-red-600/80 text-gray-300 hover:text-white transition-all active:scale-95 border border-gray-700 text-xs font-bold flex items-center gap-1.5"
                  title="Sair da Apresentação (Esc)"
                >
                  <X size={16} /> Sair
                </button>
              </div>
            </div>
          </div>

          {/* Main Slide Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center">
            <div className="w-full max-w-[1440px] bg-[#131625] border border-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl transition-all duration-300 min-h-[720px] flex flex-col justify-between">
              {/* SLIDE 1 */}
              {currentSlideIndex === 0 && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="border-b border-gray-800 pb-5 flex justify-between items-end">
                    <div>
                      <span className="text-emerald-400 font-black text-sm uppercase tracking-widest block mb-1">SLIDE 01 DE 06</span>
                      <h1 className="text-4xl font-black text-white">Diagnóstico e Placar Geral da Clínica</h1>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-xs font-bold block uppercase tracking-wider">REPUTAÇÃO GOOGLE</span>
                      <span className="text-3xl font-black text-amber-400">{selectedProspect.gmnRating || 'N/A'} ★</span>
                    </div>
                  </div>

                  {/* Ficha rápida */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5 bg-[#090b13] p-6 rounded-2xl border border-gray-800">
                    <div>
                      <span className="text-xs text-gray-400 font-black uppercase tracking-wider block mb-1">Clínica</span>
                      <p className="text-base font-bold text-white truncate">{selectedProspect.clinicName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-black uppercase tracking-wider block mb-1">Proprietário</span>
                      <p className="text-base font-bold text-indigo-300 truncate">{selectedProspect.ownerName || 'Não Informado'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-black uppercase tracking-wider block mb-1">Endereço</span>
                      <p className="text-base font-bold text-gray-300 truncate">{selectedProspect.location || 'Não Informado'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 font-black uppercase tracking-wider block mb-1">CNPJ</span>
                      <p className="text-base font-bold text-gray-300 truncate">{selectedProspect.cnpj || 'Não Informado'}</p>
                    </div>
                  </div>

                  {/* Pilares Placar */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-gray-300 uppercase tracking-widest">Desempenho por Pilar Estratégico</h3>
                    <div className="grid grid-cols-5 gap-4">
                      {[
                        { label: 'Google (Local)', val: diagnosticData.gmn?.top3Percent || 'N/A', color: 'text-indigo-400', bg: 'border-indigo-500/30 bg-indigo-500/10' },
                        { label: 'Reputação', val: selectedProspect.gmnRating ? `${selectedProspect.gmnRating}★` : 'N/A', color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/10' },
                        { label: 'Instagram', val: diagnosticData.instagram?.seguidores || 'Ativo', color: 'text-pink-400', bg: 'border-pink-500/30 bg-pink-500/10' },
                        { label: 'Site (Mobile)', val: diagnosticData.site?.velocidade || 'N/A', color: 'text-emerald-400', bg: 'border-emerald-500/30 bg-emerald-500/10' },
                        { label: 'Anúncios (Meta)', val: diagnosticData.ads?.anunciosAtivos ? 'Ativo' : 'Inativo', color: 'text-purple-400', bg: 'border-purple-500/30 bg-purple-500/10' }
                      ].map((p, i) => (
                        <div key={i} className={`p-6 rounded-2xl border ${p.bg} text-center flex flex-col justify-center items-center h-40 shadow-xl transition-all`}>
                          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{p.label}</span>
                          <span className={`text-3xl font-black mt-3 ${p.color}`}>{p.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 2 */}
              {currentSlideIndex === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-800 pb-5 flex justify-between items-end">
                    <div>
                      <span className="text-indigo-400 font-black text-sm uppercase tracking-widest block mb-1">SLIDE 02 DE 06</span>
                      <h1 className="text-4xl font-black text-white">Presença no Google Maps (Local Falcon)</h1>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-xs font-bold block uppercase tracking-wider">SHARE OF LOCAL VOICE</span>
                      <span className="text-3xl font-black text-indigo-400">{diagnosticData.gmn?.top3Percent || '0%'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    {/* Heatmap Image ou Card de Visibilidade */}
                    {(diagnosticData.gmn?.mapaCalorImg || diagnosticData.gmn?.scanId) ? (
                      <div className="bg-[#090b13] p-5 rounded-2xl border border-gray-800 flex flex-col items-center justify-center space-y-3">
                        <img
                          src={diagnosticData.gmn.mapaCalorImg || `https://lf-static-v2.localfalcon.com/image/${diagnosticData.gmn.scanId}`}
                          alt="Mapa de calor real do Local Falcon"
                          className="max-h-[380px] w-auto object-contain rounded-xl border border-gray-800 shadow-xl"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Varredura Local Falcon</span>
                          {diagnosticData.gmn?.scanId && <span className="text-xs bg-indigo-950 text-indigo-300 px-2.5 py-0.5 rounded font-mono border border-indigo-800/40">Scan ID: {diagnosticData.gmn.scanId}</span>}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#090b13] p-8 rounded-2xl border border-gray-800 space-y-6 flex flex-col justify-between">
                        <div>
                          <h3 className="text-base font-bold text-gray-300 uppercase mb-2">Mapeamento de Posições Locais</h3>
                          <p className="text-sm text-gray-400 leading-relaxed">Rastreamento geolocalizado de visibilidade da clínica para pesquisas no Google Maps na região.</p>
                        </div>
                        <div className="p-8 bg-indigo-950/30 rounded-2xl border border-indigo-800/40 text-center">
                          <span className="text-gray-400 text-sm font-bold block mb-2">Status no Top 3 do Google</span>
                          <span className="text-5xl font-black text-indigo-300">{diagnosticData.gmn?.top3Percent || 'N/A'}</span>
                        </div>
                      </div>
                    )}

                    {/* Ranking de Concorrentes + VOCÊ */}
                    <div className="bg-[#090b13] p-6 rounded-2xl border border-gray-800 space-y-4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-300 uppercase mb-1">Quem aparece na frente de você</h3>
                        <p className="text-xs text-gray-400">Resultados no topo do Google Maps na sua região:</p>
                      </div>

                      <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                        {topCompetitors.map((c: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3.5 bg-gray-900/80 rounded-xl text-sm border border-gray-800">
                            <div className="min-w-0 flex-1 pr-3">
                              <span className="font-bold text-gray-100 block truncate">#{c.posicao} {c.nome || c.name || 'Concorrente'}</span>
                              <span className="text-xs text-gray-400 block truncate">{c.endereco || (formData.cityName ? `${formData.cityName} - DF` : 'Localidade')}</span>
                            </div>
                            <span className="text-amber-400 font-bold shrink-0 text-right text-sm">
                              {c.nota ? `${c.nota}★` : '—'}
                              {c.avaliacoes != null && <span className="text-xs text-gray-400 font-normal block">({c.avaliacoes} avaliações)</span>}
                            </span>
                          </div>
                        ))}

                        {/* Highlight Box VOCÊ */}
                        <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-xl text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-amber-300 text-base truncate">
                              #{hasValidClientRank ? clientRank : '—'} {selectedProspect.clinicName} (VOCÊ)
                            </span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-amber-500 text-gray-950 uppercase shrink-0">VOCÊ</span>
                          </div>
                          <p className="text-xs text-amber-200/80 mt-1">
                            {selectedProspect.location || (formData.cityName ? `${formData.cityName} - DF` : 'Sua região')} | Posição Local Falcon
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 3 */}
              {currentSlideIndex === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-800 pb-5 flex justify-between items-end">
                    <div>
                      <span className="text-emerald-400 font-black text-sm uppercase tracking-widest block mb-1">SLIDE 03 DE 06</span>
                      <h1 className="text-4xl font-black text-white">Análise do Site & Performance Mobile</h1>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-xs font-bold block uppercase tracking-wider">PAGESPEED SCORE</span>
                      <span className="text-3xl font-black text-emerald-400">{diagnosticData.site?.velocidade || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="bg-[#090b13] p-8 rounded-2xl border border-gray-800 space-y-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-300 uppercase mb-2">Velocidade & Carregamento</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          Sites rápidos convertem até 3x mais visitantes em agendamentos diretos via WhatsApp.
                        </p>
                      </div>
                      <div className="p-8 bg-emerald-950/30 rounded-2xl border border-emerald-800/40 text-center">
                        <span className="text-gray-400 text-sm font-bold block mb-2">Desempenho Mobile</span>
                        <span className="text-5xl font-black text-emerald-300">{diagnosticData.site?.velocidade || 'Bom'}</span>
                      </div>
                    </div>

                    <div className="bg-[#090b13] p-8 rounded-2xl border border-gray-800 space-y-6">
                      <h3 className="text-base font-bold text-gray-300 uppercase">Tags de Rastreamento (Pixel / GA4)</h3>
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between p-5 bg-gray-900/60 rounded-xl border border-gray-800">
                          <span className="text-sm font-bold text-gray-200">Google Analytics (GA4)</span>
                          <span className={`text-xs font-black px-4 py-1.5 rounded-full ${diagnosticData.site?.pixelInfo?.hasGA4 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {diagnosticData.site?.pixelInfo?.hasGA4 ? 'Detectado' : 'Não Detectado'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-gray-900/60 rounded-xl border border-gray-800">
                          <span className="text-sm font-bold text-gray-200">Meta Pixel (Facebook/Instagram)</span>
                          <span className={`text-xs font-black px-4 py-1.5 rounded-full ${diagnosticData.site?.pixelInfo?.hasMetaPixel ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                            {diagnosticData.site?.pixelInfo?.hasMetaPixel ? 'Detectado' : 'Não Detectado'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 4 */}
              {currentSlideIndex === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="border-b border-gray-800 pb-5 flex justify-between items-end">
                    <div>
                      <span className="text-purple-400 font-black text-sm uppercase tracking-widest block mb-1">SLIDE 04 DE 06</span>
                      <h1 className="text-4xl font-black text-white">Presença em Anúncios Pagos (Meta Ads)</h1>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-xs font-bold block uppercase tracking-wider">STATUS DE CAMPANHAS</span>
                      <span className="text-3xl font-black text-purple-400">{diagnosticData.ads?.anunciosAtivos ? 'CAMPANHAS ATIVAS' : 'SEM ANÚNCIOS'}</span>
                    </div>
                  </div>

                  <div className="bg-[#090b13] p-10 rounded-2xl border border-gray-800 space-y-8">
                    <div>
                      <h3 className="text-base font-bold text-gray-300 uppercase mb-2">Diagnóstico da Biblioteca de Anúncios</h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        A análise na Meta Ads Library verificou a frequência de publicação e captação de tráfego pago da clínica na região.
                      </p>
                    </div>
                    <div className="p-8 bg-purple-950/30 rounded-2xl border border-purple-800/40 text-center">
                      <span className="text-purple-200 font-bold text-xl leading-relaxed block">
                        {diagnosticData.ads?.resumoMetaAds || 'Nenhum anúncio rodando ativamente no Facebook/Instagram Ads no momento.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE 5 */}
              {currentSlideIndex === 4 && (() => {
                const lossVal = diagnosticData.vendasPerdidasMes && diagnosticData.ticketMedio 
                  ? diagnosticData.vendasPerdidasMes * diagnosticData.ticketMedio 
                  : 15000;
                const cons = Math.round(lossVal * 0.7);
                const mod = Math.round(lossVal);
                const agr = Math.round(lossVal * 1.5);

                return (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="border-b border-gray-800 pb-5 flex justify-between items-end">
                      <div>
                        <span className="text-emerald-400 font-black text-sm uppercase tracking-widest block mb-1">SLIDE 05 DE 06</span>
                        <h1 className="text-4xl font-black text-white">Análise Financeira — Dinheiro na Mesa</h1>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-400 text-xs font-bold block uppercase tracking-wider">PERDA ESTIMADA / MÊS</span>
                        <span className="text-3xl font-black text-red-400">
                          R$ {mod.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      <div className="p-6 bg-red-950/30 border border-red-800/40 rounded-2xl text-center flex flex-col justify-center">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Faturamento Perdido / Mês</span>
                        <span className="text-3xl font-black text-white mt-2">
                          R$ {mod.toLocaleString('pt-BR')}
                        </span>
                      </div>

                      <div className="p-6 bg-[#090b13] border border-gray-800 rounded-2xl text-center flex flex-col justify-center">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket Médio Calculado</span>
                        <span className="text-3xl font-black text-indigo-300 mt-2">
                          R$ {(diagnosticData.ticketMedio || selectedProspect.ticketMedio || 500).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="p-6 bg-[#090b13] border border-gray-800 rounded-2xl text-center flex flex-col justify-center">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Vendas Não Realizadas / Mês</span>
                        <span className="text-3xl font-black text-amber-400 mt-2">
                          {diagnosticData.vendasPerdidasMes || 30} Pacientes
                        </span>
                      </div>
                    </div>

                    {/* Barra de cenários */}
                    <div className="bg-[#090b13] p-6 rounded-2xl border border-gray-800 space-y-4">
                      <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Cenários de Recuperação de Receita</h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="flex justify-between font-bold mb-1.5">
                            <span className="text-gray-200 text-sm">Conservador (70%)</span>
                            <span className="text-emerald-400 font-black text-base">R$ {cons.toLocaleString('pt-BR')}/mês</span>
                          </div>
                          <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '45%' }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between font-bold mb-1.5">
                            <span className="text-gray-200 text-sm">Moderado (100%)</span>
                            <span className="text-emerald-400 font-black text-base">R$ {mod.toLocaleString('pt-BR')}/mês</span>
                          </div>
                          <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: '70%' }}></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between font-bold mb-1.5">
                            <span className="text-gray-200 text-sm">Agressivo (150%)</span>
                            <span className="text-emerald-400 font-black text-base">R$ {agr.toLocaleString('pt-BR')}/mês</span>
                          </div>
                          <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                            <div className="h-full bg-emerald-300 rounded-full" style={{ width: '100%' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SLIDE 6 */}
              {currentSlideIndex === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="border-b border-gray-800 pb-4 flex justify-between items-end">
                    <div>
                      <span className="text-emerald-400 font-black text-sm uppercase tracking-widest block mb-1">SLIDE 06 DE 06</span>
                      <h1 className="text-4xl font-black text-white">Plano de Ação Estratégico de 10 Passos</h1>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 text-xs font-bold block uppercase tracking-wider">PRIORIDADE</span>
                      <span className="text-xl font-black text-emerald-400">EXECUÇÃO IMEDIATA</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {(diagnosticData.planoAcao && diagnosticData.planoAcao.length > 0
                      ? diagnosticData.planoAcao
                      : [
                          { titulo: `Otimizar Perfil no Google com a palavra-chave "${formData.keyword || 'Dentista'}"`, descricao: `Adequar o nome do perfil e incluir na categoria principal em ${formData.cityName || 'sua cidade'}.`, imp: "ALTO", esf: "BAIXO" },
                          { titulo: "Processo Ativo para Solicitar Avaliações 5 Estrelas", descricao: "Gerar link direto e orientar a equipe a solicitar avaliações após o atendimento.", imp: "ALTO", esf: "BAIXO" },
                          { titulo: "Otimizar Velocidade e SEO Técnico do Site", descricao: "Corrigir pontos técnicos para aumentar a taxa de conversão em agendamentos.", imp: "ALTO", esf: "MÉDIO" },
                          { titulo: `Lançar Anúncios no Google Ads focados em "${formData.keyword || 'Dentista'}"`, descricao: `Capturar clientes com intenção imediata de agendamento na região.`, imp: "ALTO", esf: "MÉDIO" },
                          { titulo: "Lançar Campanhas no Meta Ads (Instagram & Facebook)", descricao: "Anúncios em vídeo no Feed e Stories com diferenciais da clínica.", imp: "ALTO", esf: "MÉDIO" },
                          { titulo: "Instalar Rastreamento de Conversões (Pixel Meta e GA4)", descricao: "Mapear cliques no botão do WhatsApp e formulários.", imp: "ALTO", esf: "BAIXO" },
                          { titulo: "Análise Sistemática e Monitoramento de Concorrentes", descricao: "Acompanhar movimentações dos concorrentes locais no raio de busca.", imp: "MÉDIO", esf: "BAIXO" },
                          { titulo: "Treinamento da Recepção para Conversão Telefônica/WhatsApp", descricao: "Padronizar roteiros de atendimento para converter mais contatos em consultas.", imp: "ALTO", esf: "MÉDIO" },
                          { titulo: "Régua de Reativação e Pós-Atendimento", descricao: "Automatizar lembretes de retorno para pacientes inativos.", imp: "MÉDIO", esf: "MÉDIO" },
                          { titulo: "Acompanhamento Semanal de Métricas de Crescimento", descricao: "Reuniões curtas de alinhamento para validar o ROI das ações.", imp: "MÉDIO", esf: "BAIXO" }
                        ]
                    ).slice(0, 10).map((passo: any, idx: number) => {
                      const isObj = typeof passo === 'object' && passo !== null;
                      const title = isObj ? (passo.titulo || passo.title || passo.descricao || '') : String(passo);
                      const desc = isObj ? (passo.descricao || passo.description || '') : '';
                      const imp = isObj ? (passo.imp || passo.impacto || '') : '';
                      const esf = isObj ? (passo.esf || passo.esforco || '') : '';

                      return (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-[#090b13] rounded-2xl border border-gray-800 hover:border-gray-700 transition-all">
                          <span className="w-8 h-8 shrink-0 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-sm flex items-center justify-center border border-emerald-500/30 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm text-gray-100 font-bold leading-snug">{title}</h4>
                              {(imp || esf) && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {imp && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">{imp}</span>}
                                  {esf && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800 text-gray-300">{esf}</span>}
                                </div>
                              )}
                            </div>
                            {desc && desc !== title && (
                              <p className="text-xs text-gray-400 font-normal leading-relaxed mt-1.5">{desc}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer controls inside slide card */}
              <div className="border-t border-gray-800/60 pt-4 flex items-center justify-between text-xs text-gray-500">
                <span>Use ◄ ► no teclado ou clique nas setas para navegar</span>
                <span className="font-bold text-gray-400">{selectedProspect.clinicName} — Apresentação Oficial</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
