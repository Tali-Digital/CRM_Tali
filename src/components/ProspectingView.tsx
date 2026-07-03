import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import Swal from 'sweetalert2';
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  ExternalLink, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  Instagram, 
  MapPin, 
  Globe, 
  User, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
  Brain,
  MessageSquare,
  Key,
  RotateCcw,
  AlertTriangle,
  Check,
  Calculator,
  DollarSign,
  TrendingUp,
  Target,
  Building2,
  Zap,
  Users as UsersIcon,
  CalendarDays,
  Copy,
  Settings,
  LayoutGrid,
  Grid
} from 'lucide-react';
import { Prospect, CompanyType } from '../types';
import { subscribeToProspects, addProspect, updateProspect, deleteProspect, updateGlobalSettings, getGlobalSettings } from '../services/firestoreService';
import { generateProspectReport, generateInstagramMessage, parseProspectFromBlockText } from '../services/geminiService';

interface ProspectingViewProps {
  companyId: CompanyType;
}

const STATUS_COLORS = {
  'VERIFICAR ICP': 'bg-pink-100 text-pink-800',
  'Mandar Mensagem': 'bg-amber-100 text-amber-800',
  'Mensagem Enviada': 'bg-blue-100 text-blue-800',
  '1º Follow Up': 'bg-cyan-100 text-cyan-800',
  '2º Follow Up': 'bg-purple-100 text-purple-800',
  '3º+ Follow Up': 'bg-indigo-100 text-indigo-800',
  'Cliente Respondeu': 'bg-pink-100 text-pink-800',
  'Reunião Agendada': 'bg-orange-100 text-orange-800',
  'Cliente Fechado': 'bg-emerald-800 text-white',
  'Contrato Encerrado': 'bg-red-100 text-red-800',
  'Base de Recomeço': 'bg-slate-100 text-slate-800',
  '': 'bg-gray-100 text-gray-800'
};

const FOLLOWED_COLORS = {
  'Sim': 'bg-green-100 text-green-800',
  'Solicitado': 'bg-sky-100 text-sky-800',
  'Não': 'bg-red-100 text-red-800',
  '': 'bg-gray-100 text-gray-800'
};

export const ProspectingView: React.FC<ProspectingViewProps> = ({ companyId }) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [quickFilter, setQuickFilter] = useState<string>('active');
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Prospect; direction: 'asc' | 'desc' } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isProgressFilterOpen, setIsProgressFilterOpen] = useState(false);
  const progressFilterRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown de progresso ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (progressFilterRef.current && !progressFilterRef.current.contains(event.target as Node)) {
        setIsProgressFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // IA Gemini States
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingInsta, setIsGeneratingInsta] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState((import.meta.env.VITE_GEMINI_API_KEY as string) || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'ia' | 'instagram' | 'calculadora'>('dados');

  // Follow Up Form States
  const [newFollowUpDate, setNewFollowUpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newFollowUpMsg, setNewFollowUpMsg] = useState('');

  // AI Parsing States
  const [freeText, setFreeText] = useState('');
  const [isParsingFreeText, setIsParsingFreeText] = useState(false);
  const [aiSubTab, setAiSubTab] = useState<'analise' | 'preenchimento'>('preenchimento');

  // Duplicate Check State
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Drag to Scroll States
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasDragged, setHasDragged] = useState(false);

  const [formData, setFormData] = useState<Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>>({
    order: 0,
    responsible: '',
    location: '',
    clinicName: '',
    clinicInstagram: '',
    gmn: '',
    site: '',
    ownerName: '',
    ownerInstagram: '',
    followedOwner: '',
    size: '',
    age: '',
    status: '',
    hasAnswered: false,
    lastFollowUp: '',
    observations: '',
    firstContactDate: '',
    week: '',
    companyId: companyId,
    currentStep: 1,
    collaborators: '',
    gmnRating: '',
    gmnReviewsCount: '',
    approachUsed: '',
    lastContactDate: '',
    aiReport: '',
    instagramMessage: '',
    isRestartBase: false,
    followUps: [],
    aiFilledFields: [],
    fullAddress: '',
  });

  // Refs para salvar de forma automática ao clicar fora ou apertar ESC
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const editingProspectRef = useRef(editingProspect);
  useEffect(() => {
    editingProspectRef.current = editingProspect;
  }, [editingProspect]);

  const isModalOpenRef = useRef(isModalOpen);
  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
  }, [isModalOpen]);

  // Check duplicates real-time
  useEffect(() => {
    if (!formData.clinicName && !formData.location && !formData.clinicInstagram) {
      setDuplicateWarning(null);
      return;
    }

    const normalizeString = (str?: string) => {
      if (!str) return '';
      return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]/g, ''); // Remove espaços, traços e caracteres especiais
    };
    
    const normalizedName = normalizeString(formData.clinicName);
    const normalizedLocation = normalizeString(formData.location);
    const normalizedInsta = formData.clinicInstagram?.toLowerCase().trim().replace('@', '').replace('https://instagram.com/', '').replace('www.instagram.com/', '').replace(/\/$/, '') || '';

    const duplicate = prospects.find(p => {
      // Ignora a si mesmo na edição
      if (editingProspect && p.id === editingProspect.id) return false;

      const pName = normalizeString(p.clinicName);
      const pLoc = normalizeString(p.location);
      const pInsta = p.clinicInstagram?.toLowerCase().trim().replace('@', '').replace('https://instagram.com/', '').replace('www.instagram.com/', '').replace(/\/$/, '') || '';

      const nameLocMatch = normalizedName && normalizedLocation && pName === normalizedName && pLoc === normalizedLocation;
      const instaMatch = normalizedInsta && pInsta === normalizedInsta;
      
      return nameLocMatch || instaMatch;
    });

    if (duplicate) {
      setDuplicateWarning(`Atenção: Já existe um prospecto parecido (${duplicate.clinicName} ${duplicate.location ? `- ${duplicate.location}` : ''}) cadastrado por ${duplicate.responsible || 'alguém'}! Verifique para não trabalharem o mesmo cliente.`);
    } else {
      setDuplicateWarning(null);
    }
  }, [formData.clinicName, formData.location, formData.clinicInstagram, prospects, editingProspect]);

  const handleCloseAndSave = useCallback(async () => {
    if (isModalOpenRef.current) {
      try {
        const currentData = formDataRef.current;
        const currentEditing = editingProspectRef.current;
        if (currentData.clinicName && currentData.clinicName.trim() !== '') {
          if (currentEditing) {
            await updateProspect(currentEditing.id, currentData);
          } else {
            await addProspect(currentData);
          }
        }
      } catch (error) {
        console.error('Erro ao salvar prospecto automaticamente:', error);
      } finally {
        setIsModalOpen(false);
      }
    }
  }, []);

  // Keyboard Escape Handler to close modal and save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        handleCloseAndSave();
      }
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, handleCloseAndSave]);

  // Drag to Scroll Mouse Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    setIsMouseDown(true);
    setHasDragged(false);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeft(tableContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Sensitivity multiplier
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }
    tableContainerRef.current.scrollLeft = scrollLeft - walk;
  };


  useEffect(() => {
    const unsubscribe = subscribeToProspects(companyId, (data) => {
      setProspects(data);
      setLoading(false);
    });
    
    // Load global API Key if needed
    getGlobalSettings('gemini').then((settings) => {
      if (settings?.key && !apiKeyInput) {
        setApiKeyInput(settings.key);
      }
    });

    return () => unsubscribe();
  }, [companyId]);

  const processedProspects = useMemo(() => {
    let result = prospects.filter(p => {
      const matchesSearch = 
        p.clinicName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilters = Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        return String(p[key as keyof Prospect]) === value;
      });

      // Quick Step / Restart Base Filter
      let matchesQuickFilter = true;
      if (quickFilter === 'active') {
        matchesQuickFilter = !['Cliente Fechado', 'Contrato Encerrado', 'Base de Recomeço'].includes(p.status);
      } else if (quickFilter === 'all') {
        matchesQuickFilter = true;
      } else {
        matchesQuickFilter = p.status === quickFilter;
      }

      return matchesSearch && matchesFilters && matchesQuickFilter;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [prospects, searchTerm, filters, sortConfig, quickFilter]);

  const handleOpenModal = (prospect?: Prospect, startInAITab = false) => {
    setActiveTab(startInAITab ? 'ia' : 'dados');
    setNewFollowUpDate(new Date().toISOString().split('T')[0]);
    setNewFollowUpMsg('');
    setFreeText('');
    if (prospect) {
      setAiSubTab('analise');
      setEditingProspect(prospect);
      setFormData({
        ...prospect,
        companyId: companyId, // Ensure companyId is correct
        collaborators: prospect.collaborators || '',
        gmnRating: prospect.gmnRating || '',
        gmnReviewsCount: prospect.gmnReviewsCount || '',
        approachUsed: prospect.approachUsed || '',
        lastContactDate: prospect.lastContactDate || '',
        aiReport: prospect.aiReport || '',
        instagramMessage: prospect.instagramMessage || '',
        isRestartBase: !!prospect.isRestartBase,
        followUps: prospect.followUps || [],
        aiFilledFields: prospect.aiFilledFields || [],
        fullAddress: prospect.fullAddress || '',
      });
    } else {
      setAiSubTab('preenchimento');
      setEditingProspect(null);
      setFormData({
        order: Date.now() * -1,
        responsible: '',
        location: '',
        clinicName: '',
        clinicInstagram: '',
        gmn: '',
        site: '',
        ownerName: '',
        ownerInstagram: '',
        followedOwner: '',
        size: '',
        age: '',
        status: '',
        hasAnswered: false,
        lastFollowUp: '',
        observations: '',
        firstContactDate: '',
        week: '',
        companyId: companyId,
        currentStep: 1,
        collaborators: '',
        gmnRating: '',
        gmnReviewsCount: '',
        approachUsed: '',
        lastContactDate: '',
        aiReport: '',
        instagramMessage: '',
        isRestartBase: false,
        followUps: [],
        aiFilledFields: [],
        fullAddress: '',
      });
    }
    setIsModalOpen(true);
  };

  const renderAiReviewBadge = (fieldName: string) => {
    if (!formData.aiFilledFields?.includes(fieldName)) return null;
    return (
      <span className="ml-2 inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md text-[9px] font-bold border border-amber-200 animate-pulse select-none">
        <AlertTriangle size={9} className="text-amber-600" />
        IA
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const cleanList = formData.aiFilledFields?.filter(f => f !== fieldName) || [];
            setFormData({ ...formData, aiFilledFields: cleanList });
          }}
          className="ml-1 bg-amber-200 hover:bg-amber-300 text-amber-800 p-0.5 rounded-full flex items-center justify-center w-3 h-3"
          title="Confirmar este valor"
        >
          <Check size={8} />
        </button>
      </span>
    );
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    const cleanList = formData.aiFilledFields?.filter(f => f !== fieldName) || [];
    setFormData({
      ...formData,
      [fieldName]: value,
      aiFilledFields: cleanList
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProspect) {
        await updateProspect(editingProspect.id, formData);
      } else {
        await addProspect(formData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving prospect:', error);
    }
  };

  const [isCleaning, setIsCleaning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<{key: string; items: Prospect[]; hasDifferences: boolean}[] | null>(null);

  const startRemoveDuplicates = () => {
    if (prospects.length === 0) {
      alert('Não há registros para verificar.');
      return;
    }

    const groups = new Map<string, Prospect[]>();

    prospects.forEach(p => {
      const normalizedName = p.clinicName.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedLocation = (p.location || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const key = `${normalizedName}|${normalizedLocation}`;
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(p);
    });

    const duplicates: {key: string; items: Prospect[]; hasDifferences: boolean}[] = [];

    groups.forEach((items, key) => {
      if (items.length > 1) {
        let hasDifferences = false;
        const baseItem = items[0];
        for (let i = 1; i < items.length; i++) {
          const item = items[i];
          if (
            item.gmnRating !== baseItem.gmnRating ||
            item.gmnReviewsCount !== baseItem.gmnReviewsCount ||
            item.clinicInstagram !== baseItem.clinicInstagram ||
            item.ownerName !== baseItem.ownerName ||
            item.site !== baseItem.site ||
            item.responsible !== baseItem.responsible ||
            item.size !== baseItem.size
          ) {
            hasDifferences = true;
            break;
          }
        }
        duplicates.push({ key, items, hasDifferences });
      }
    });

    if (duplicates.length === 0) {
      alert('Nenhum registro duplicado encontrado (mesmo nome e localização).');
      return;
    }

    setDuplicateGroups(duplicates);
  };

  const handleKeepDuplicate = async (groupIndex: number, keepId: string) => {
    if (!duplicateGroups) return;
    
    setIsCleaning(true);
    try {
      const group = duplicateGroups[groupIndex];
      const idsToDelete = group.items.map(i => i.id).filter(id => id !== keepId);
      
      for (const id of idsToDelete) {
        await deleteProspect(id);
      }
      
      const newGroups = [...duplicateGroups];
      newGroups.splice(groupIndex, 1);
      
      if (newGroups.length === 0) {
        setDuplicateGroups(null);
        alert('Todos os duplicados foram resolvidos!');
      } else {
        setDuplicateGroups(newGroups);
      }
    } catch (error) {
      console.error('Erro ao remover duplicados:', error);
      alert('Erro ao processar a limpeza.');
    } finally {
      setIsCleaning(false);
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Tem certeza que deseja excluir os ${selectedIds.length} prospectos selecionados?`)) {
      setIsCleaning(true);
      try {
        for (const id of selectedIds) {
          await deleteProspect(id);
        }
        setSelectedIds([]);
        alert('Prospectos selecionados excluídos com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir prospectos:', error);
        alert('Ocorreu um erro ao excluir alguns registros.');
      } finally {
        setIsCleaning(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProspect(id);
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting prospect:', error);
      alert('Erro ao excluir registro.');
    }
  };

  const handleQuickUpdate = async (id: string, field: keyof Prospect, value: any) => {
    await updateProspect(id, { [field]: value });
  };

  const handleGenerateAI = async (tempFormData?: typeof formData) => {
    const dataToUse = tempFormData || formData;
    
    const dummyProspect: Prospect = {
      id: editingProspect?.id || 'temp',
      ...dataToUse,
    } as Prospect;

    setIsGeneratingAI(true);
    try {
      const result = await generateProspectReport(dummyProspect);
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          aiReport: result.content
        }));
        
        if (editingProspect) {
          await updateProspect(editingProspect.id, { aiReport: result.content });
        }
        
        if (result.isMock) {
          alert('Relatório gerado com sucesso em Modo de Demonstração! Para análises reais em tempo real, insira uma API Key do Gemini.');
        } else {
          alert('Relatório de IA gerado com sucesso pelo Google Gemini!');
        }
      } else {
        alert(`Erro ao gerar relatório: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveApiKey = async (key: string) => {
    try {
      await updateGlobalSettings('gemini', { key });
      setApiKeyInput(key);
      setShowApiKeyInput(false);
      alert('Chave de API do Gemini salva com sucesso globalmente!');
    } catch (error) {
      console.error('Erro ao salvar chave:', error);
      alert('Erro ao salvar chave da API.');
    }
  };

  const handleGenerateInstagramMessage = async (tempFormData?: typeof formData) => {
    const dataToUse = tempFormData || formData;
    
    const dummyProspect: Prospect = {
      id: editingProspect?.id || 'temp',
      ...dataToUse,
    } as Prospect;

    setIsGeneratingInsta(true);
    try {
      const result = await generateInstagramMessage(dummyProspect);
      if (result.success) {
        setFormData(prev => ({
          ...prev,
          instagramMessage: result.content
        }));
        
        if (editingProspect) {
          await updateProspect(editingProspect.id, { instagramMessage: result.content });
        }
        
        if (result.isMock) {
          alert('Mensagem personalizada gerada com sucesso em Modo de Demonstração! Para geração em tempo real via IA, insira uma API Key do Gemini.');
        } else {
          alert('Mensagem personalizada gerada com sucesso pelo Google Gemini!');
        }
      } else {
        alert(`Erro ao gerar mensagem: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Erro inesperado: ${err.message}`);
    } finally {
      setIsGeneratingInsta(false);
    }
  };


  const handleParseFreeText = async () => {
    if (!freeText.trim()) {
      alert('Por favor, cole os dados do prospecto no campo de texto antes de usar a IA.');
      return;
    }
    setIsParsingFreeText(true);
    try {
      const result = await parseProspectFromBlockText(freeText);
      if (result.success && result.prospect) {
        const parsed = result.prospect;
        const filledFields: string[] = [];
        // Detecta quais campos foram preenchidos pela IA
        const checkFields = [
          'clinicName','responsible','location','fullAddress','clinicInstagram','gmn','site',
          'ownerName','ownerInstagram','followedOwner','size','age','collaborators',
          'gmnRating','gmnReviewsCount','status','firstContactDate','week',
          'lastContactDate','approachUsed','observations','instagramMessage',
        ] as const;
        checkFields.forEach((field) => {
          const val = (parsed as any)[field];
          if (val !== undefined && val !== '' && val !== null) {
            filledFields.push(field);
          }
        });
        setFormData(prev => ({
          ...prev,
          ...parsed,
          aiFilledFields: filledFields,
        }));
        // Sucesso visual tratado diretamente no componente de interface
      } else {
        alert(`Não foi possível extrair dados: ${result.error || 'Resposta inválida da IA.'}`);
      }
    } catch (err: any) {
      alert(`Erro inesperado ao processar: ${err.message}`);
    } finally {
      setIsParsingFreeText(false);
    }
  };

  const importInitialData = async () => {
    Swal.fire({
      title: 'Selecione o Líder',
      input: 'select',
      inputOptions: {
        'Diogo': 'Diogo',
        'Helenilton': 'Helenilton'
      },
      inputPlaceholder: 'Selecione o líder da prospecção',
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        const leader = result.value;
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.csv';
        fileInput.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          setIsImporting(true);
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
              try {
                let importedCount = 0;
                for (const row of results.data as any[]) {
                  const clinicName = row['Nome '] || row['Nome'] || '';
                  if (!clinicName) continue; // Skip if no name

                  const address = row['Endereço'] || '';
                  const cityMatch = address.split('-').map((s: string) => s.trim());
                  let location = address;
                  if (cityMatch.length >= 3) {
                    location = `${cityMatch[cityMatch.length - 3]} - ${cityMatch[cityMatch.length - 2]}`;
                  }

                  await addProspect({
                    order: prospects.length + importedCount + 1,
                    responsible: leader,
                    location: location.substring(0, 50),
                    clinicName: clinicName,
                    clinicInstagram: row['Instagram'] || '',
                    gmn: row['URL Google Maps'] || '',
                    site: row['Site'] || '',
                    ownerName: row['Socios'] || row['Sócio'] || '',
                    ownerInstagram: row['Instagram Socios'] || '',
                    followedOwner: '',
                    size: row['Quadro de Funcionarios'] || '',
                    age: '',
                    status: 'VERIFICAR ICP',
                    hasAnswered: false,
                    lastFollowUp: '',
                    observations: '',
                    firstContactDate: '',
                    week: 'Semana 1',
                    currentStep: 1,
                    companyId: companyId as any
                  });
                  importedCount++;
                }
                Swal.fire('Sucesso!', `${importedCount} prospecções importadas.`, 'success');
              } catch (error) {
                console.error('Erro na importação:', error);
                Swal.fire('Erro', 'Erro ao importar. Verifique o console.', 'error');
              } finally {
                setIsImporting(false);
              }
            }
          });
        };
        fileInput.click();
      }
    });
  };

  const renderFilterDropdown = (column: keyof Prospect, label: string) => {
    const uniqueValues = Array.from(new Set(prospects.map(p => String(p[column] || '')))).filter(v => v !== '').sort();
    
    return (
      <div className="relative inline-block ml-1">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setActiveFilterColumn(activeFilterColumn === column ? null : column);
          }}
          className={`p-0.5 rounded hover:bg-white/20 transition-colors ${filters[column] || sortConfig?.key === column ? 'bg-white/30' : ''}`}
        >
          <Filter size={12} className="text-white" />
        </button>
        
        {activeFilterColumn === column && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-2 text-gray-700 animate-in fade-in zoom-in duration-200">
            <div className="px-3 py-1">
              <button 
                onClick={() => {
                  setSortConfig({ key: column, direction: 'asc' });
                  setActiveFilterColumn(null);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-lg flex items-center gap-2 transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center border border-gray-300 rounded text-[10px] font-bold">A</div> 
                Classificar de A a Z
              </button>
              <button 
                onClick={() => {
                  setSortConfig({ key: column, direction: 'desc' });
                  setActiveFilterColumn(null);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-lg flex items-center gap-2 transition-colors"
              >
                <div className="w-4 h-4 flex items-center justify-center border border-gray-300 rounded text-[10px] font-bold">Z</div>
                Classificar de Z a A
              </button>
            </div>
            
            <div className="border-t border-gray-100 my-2"></div>
            
            <div className="px-3 py-1">
              <button 
                onClick={() => {
                  const newFilters = { ...filters };
                  delete newFilters[column];
                  setFilters(newFilters);
                  setActiveFilterColumn(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Trash2 size={14} /> Limpar Filtro
              </button>
            </div>

            <div className="border-t border-gray-100 my-2"></div>
            
            <div className="max-h-48 overflow-y-auto px-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">Valores Únicos</div>
              {uniqueValues.map(value => (
                <button
                  key={value}
                  onClick={() => {
                    setFilters({ ...filters, [column]: value });
                    setActiveFilterColumn(null);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors truncate ${filters[column] === value ? 'bg-blue-900 text-white' : 'hover:bg-gray-100'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Prospecção</h1>
          <p className="text-gray-500">Gerenciamento de contatos e funil de vendas</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 flex-1 md:justify-end max-w-5xl">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '38px'; }} style={{ minHeight: '38px', fieldSizing: 'content' }}  
              placeholder="Buscar clínica, dono ou local..."
              className="pl-10 pr-4 py-1.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none w-full transition-all resize-none overflow-hidden custom-scrollbar text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>

          {/* Dropdown de Filtro de Progresso */}
          <div className="relative shrink-0 animate-in fade-in zoom-in duration-200" ref={progressFilterRef}>
            <button
              type="button"
              onClick={() => setIsProgressFilterOpen(!isProgressFilterOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-semibold border ${
                quickFilter !== 'active' && quickFilter !== 'all'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              style={{ height: '38px' }}
            >
              <Filter size={14} className={quickFilter !== 'active' && quickFilter !== 'all' ? 'text-blue-900' : 'text-gray-400'} />
              <span>
                {quickFilter === 'active' ? 'Ativos' : 
                 quickFilter === 'all' ? 'Mostrar Todos' : 
                 quickFilter}
              </span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isProgressFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProgressFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[99] py-2 text-gray-700 animate-in fade-in zoom-in-95 duration-200">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-1.5">Progresso</div>
                <div className="max-h-72 overflow-y-auto px-1.5 custom-scrollbar">
                  {[
                    { key: 'active', label: 'Todos os Ativos', count: prospects.filter(p => !['Cliente Fechado', 'Contrato Encerrado', 'Base de Recomeço'].includes(p.status)).length, dotColor: 'bg-blue-900' },
                    { key: 'VERIFICAR ICP', label: 'VERIFICAR ICP', count: prospects.filter(p => p.status === 'VERIFICAR ICP').length, dotColor: 'bg-pink-500' },
                    { key: 'Mandar Mensagem', label: 'Mandar Mensagem', count: prospects.filter(p => p.status === 'Mandar Mensagem').length, dotColor: 'bg-amber-500' },
                    { key: 'Mensagem Enviada', label: 'Mensagem Enviada', count: prospects.filter(p => p.status === 'Mensagem Enviada').length, dotColor: 'bg-blue-500' },
                    { key: '1º Follow Up', label: '1º Follow Up', count: prospects.filter(p => p.status === '1º Follow Up').length, dotColor: 'bg-cyan-500' },
                    { key: '2º Follow Up', label: '2º Follow Up', count: prospects.filter(p => p.status === '2º Follow Up').length, dotColor: 'bg-purple-500' },
                    { key: '3º+ Follow Up', label: '3º+ Follow Up', count: prospects.filter(p => p.status === '3º+ Follow Up').length, dotColor: 'bg-indigo-500' },
                    { key: 'Cliente Respondeu', label: 'Cliente Respondeu', count: prospects.filter(p => p.status === 'Cliente Respondeu').length, dotColor: 'bg-pink-500' },
                    { key: 'Reunião Agendada', label: 'Reunião Agendada', count: prospects.filter(p => p.status === 'Reunião Agendada').length, dotColor: 'bg-orange-500' },
                    { key: 'Cliente Fechado', label: 'Cliente Fechado', count: prospects.filter(p => p.status === 'Cliente Fechado').length, dotColor: 'bg-emerald-600' },
                    { key: 'Contrato Encerrado', label: 'Contrato Encerrado', count: prospects.filter(p => p.status === 'Contrato Encerrado').length, dotColor: 'bg-red-500' },
                    { key: 'Base de Recomeço', label: 'Base de Recomeço', count: prospects.filter(p => p.status === 'Base de Recomeço').length, dotColor: 'bg-slate-500' },
                    { key: 'all', label: 'Mostrar Todos', count: prospects.length, dotColor: 'bg-gray-400' }
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        setQuickFilter(f.key);
                        setIsProgressFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between ${
                        quickFilter === f.key
                          ? 'bg-blue-900 text-white shadow-sm'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${f.dotColor} shrink-0`} />
                        <span>{f.label}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                        quickFilter === f.key
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Seletor Tabela / Cards */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200/40 shrink-0" style={{ height: '38px' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all flex items-center ${viewMode === 'table' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Tabela"
            >
              <Grid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all flex items-center ${viewMode === 'cards' ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              title="Cards"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          
          <button 
            onClick={() => {
              setFilters({});
              setSearchTerm('');
              setQuickFilter('active');
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 shrink-0"
            style={{ height: '38px' }}
            title="Limpar Filtros"
          >
            <RotateCcw size={14} />
            Limpar
          </button>
          
          <button 
            onClick={startRemoveDuplicates}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-semibold bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200 shrink-0"
            style={{ height: '38px' }}
            title="Remover Duplicados"
          >
            <Copy size={14} />
            Duplicados
          </button>

          <button 
            onClick={importInitialData}
            disabled={isImporting}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95 text-xs font-semibold shrink-0 ${isImporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
            style={{ height: '38px' }}
            title="Importar dados da planilha"
          >
            {isImporting ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Clock size={14} />
            )}
            Importar
          </button>
          
          <button 
            onClick={() => handleOpenModal(undefined, true)}
            className="flex items-center gap-1 bg-blue-900 text-white px-3.5 py-1.5 rounded-xl hover:bg-blue-800 transition-all shadow-md active:scale-95 text-xs font-semibold shrink-0"
            style={{ height: '38px' }}
          >
            <Plus size={15} />
            Novo
          </button>
        </div>
      </div>



      {viewMode === 'table' ? (
        /* Table Container */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div 
            ref={tableContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="overflow-x-auto select-none"
            style={{ cursor: isMouseDown ? 'grabbing' : 'grab' }}
          >
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-[#004a8d] text-white">
                  <th className="px-4 py-3 border-r border-blue-800/30 w-8 text-center">
                    <input 
                      type="checkbox"
                      className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      checked={processedProspects.length > 0 && selectedIds.length === processedProspects.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(processedProspects.map(p => p.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-10">
                    # {renderFilterDropdown('order', '#')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-24">
                    Líder {renderFilterDropdown('responsible', 'Líder')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-32">
                    Cidade/UF {renderFilterDropdown('location', 'Localização')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 min-w-[160px]">
                    Clínica {renderFilterDropdown('clinicName', 'Clínica')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-20 text-center">
                    Links {renderFilterDropdown('clinicInstagram', 'Links')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 min-w-[120px]">
                    Dono {renderFilterDropdown('ownerName', 'Dono')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-24">
                    Estrutura {renderFilterDropdown('size', 'Tamanho')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-24">
                    Google {renderFilterDropdown('gmnRating', 'Nota GMN')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-44">
                    Progresso {renderFilterDropdown('status', 'Progresso')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 w-36">
                    Datas {renderFilterDropdown('firstContactDate', 'Datas')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider w-14 text-center">
                    <Settings size={14} className="mx-auto text-white/80" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedProspects.map((p, idx) => (
                  <tr key={p.id} className={`hover:bg-blue-50/50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${selectedIds.includes(p.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-4 text-center border-r border-gray-100 w-8">
                      <input 
                        type="checkbox"
                        className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        checked={selectedIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(prev => [...prev, p.id]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => id !== p.id));
                          }
                        }}
                      />
                    </td>
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 text-sm text-gray-600 font-medium border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors w-10"
                    >
                      {idx + 1}
                    </td>
  
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 text-sm text-gray-600 font-semibold border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors w-24"
                    >
                      {p.responsible || <span className="text-gray-400 italic">Sem Líder</span>}
                    </td>
  
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 text-sm text-gray-600 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors w-32"
                    >
                      {p.location}
                    </td>
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
                    >
                      <div className="font-bold text-gray-900">{p.clinicName}</div>
                    </td>
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors w-20"
                    >
                      <div className="flex gap-1.5 justify-center">
                        {p.clinicInstagram && (
                          <a 
                            href={p.clinicInstagram} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white shadow-sm hover:scale-110 transition-transform" 
                            title="Instagram Clínica"
                          >
                            <Instagram size={14} />
                          </a>
                        )}
                        {p.gmn && (
                          <a 
                            href={p.gmn} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl bg-blue-500 text-white shadow-sm hover:scale-110 transition-transform" 
                            title="GMN / Google Maps"
                          >
                            <MapPin size={14} />
                          </a>
                        )}
                        {p.site && (
                          <a 
                            href={p.site} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm hover:scale-110 transition-transform" 
                            title="Website"
                          >
                            <Globe size={14} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors min-w-[120px]"
                    >
                      <div className="text-sm font-bold text-gray-800">{p.ownerName}</div>
                      {p.ownerInstagram && (
                        <a 
                          href={p.ownerInstagram} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-pink-600 hover:underline flex items-center gap-1 mt-1 uppercase"
                        >
                          <Instagram size={10} /> Perfil do Dono
                        </a>
                      )}
                    </td>
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors w-24"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-bold text-gray-700 bg-gray-100 inline-block px-2 py-0.5 rounded w-max">{p.size || 'Cadeiras: N/D'}</div>
                        <div className="text-[10px] font-medium text-gray-500 uppercase">Idade: {p.age || 'N/D'}</div>
                        {p.collaborators && (
                          <div className="text-[10px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md w-max mt-0.5 flex items-center gap-1">
                            👥 {p.collaborators} colab.
                          </div>
                        )}
                      </div>
                    </td>
                    <td 
                      onClick={() => !hasDragged && handleOpenModal(p, false)}
                      className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors w-24"
                    >
                      {p.gmnRating ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="text-sm font-bold text-amber-500 flex items-center gap-1">
                            ★ <span className="text-gray-900">{p.gmnRating}</span>
                          </div>
                          {p.gmnReviewsCount && (
                            <div className="text-[10px] text-gray-500 font-medium">
                              ({p.gmnReviewsCount} avaliações)
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Sem avaliações</span>
                      )}
                    </td>
                    <td className="px-4 py-4 border-r border-gray-100 w-44">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter shrink-0">Seguiu:</span>
                          <select 
                            value={p.followedOwner}
                            onChange={(e) => handleQuickUpdate(p.id, 'followedOwner', e.target.value)}
                            className={`text-[9px] font-black px-2 py-1 rounded-lg border-none focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer shadow-sm uppercase tracking-tighter ${FOLLOWED_COLORS[p.followedOwner as keyof typeof FOLLOWED_COLORS]}`}
                          >
                            <option value="">Status</option>
                            <option value="Sim">Sim</option>
                            <option value="Solicitado">Sol.</option>
                            <option value="Não">Não</option>
                          </select>
                        </div>
                        <select 
                          value={p.status}
                          onChange={(e) => handleQuickUpdate(p.id, 'status', e.target.value)}
                          className={`text-[10px] font-black px-2 py-1.5 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-md w-full uppercase tracking-tighter transition-all hover:scale-[1.02] active:scale-95 ${STATUS_COLORS[p.status as keyof typeof STATUS_COLORS]}`}
                        >
                          <option value="">Definir Progresso</option>
                          <option value="VERIFICAR ICP">VERIFICAR ICP</option>
                          <option value="Mandar Mensagem">Mandar Mensagem</option>
                          <option value="Mensagem Enviada">Mensagem Enviada</option>
                          <option value="1º Follow Up">1º Follow Up</option>
                          <option value="2º Follow Up">2º Follow Up</option>
                          <option value="3º+ Follow Up">3º+ Follow Up</option>
                          <option value="Cliente Respondeu">Cliente Respondeu</option>
                          <option value="Reunião Agendada">Reunião Agendada</option>
                          <option value="Cliente Fechado">Cliente Fechado</option>
                          <option value="Contrato Encerrado">Contrato Encerrado</option>
                          <option value="Base de Recomeço">Base de Recomeço</option>
                        </select>
                      </div>
                    </td>
  
                    <td className="px-4 py-4 border-r border-gray-100 w-36">
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="font-bold text-gray-600 flex items-center gap-1" title="Data do Primeiro Contato">
                          <Calendar size={12} className="text-blue-500" /> {p.firstContactDate || '1º: N/D'}
                        </div>
                        {p.lastContactDate && (
                          <div className="text-[10px] font-semibold text-purple-700 flex items-center gap-1" title="Data do Último Contato">
                            <Clock size={10} className="text-purple-500" /> Últ: {p.lastContactDate}
                          </div>
                        )}
                        {p.approachUsed ? (
                          <div className="text-[9px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[130px] font-medium mt-0.5" title={p.approachUsed}>
                            💬 {p.approachUsed}
                          </div>
                        ) : (
                          <div className="text-[9px] text-gray-400 italic mt-0.5">Sem abordagem</div>
                        )}
                      </div>
                    </td>
  
                    <td className="px-4 py-4 text-center w-14">
                      {deletingId === p.id ? (
                        <div className="flex justify-center items-center gap-1 animate-in fade-in zoom-in duration-200">
                          <button 
                            onClick={() => handleDelete(p.id)}
                            className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-lg hover:bg-red-700 transition-all"
                          >
                            Sim
                          </button>
                          <button 
                            onClick={() => setDeletingId(null)}
                            className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[9px] font-black rounded-lg hover:bg-gray-300 transition-all"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingId(p.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all inline-flex justify-center"
                          title="Excluir Registro"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {processedProspects.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
              <div className="bg-gray-50 p-6 rounded-full mb-4">
                <Search size={40} />
              </div>
              <p className="text-lg font-medium">Nenhum prospecto encontrado</p>
              <p className="text-sm">Tente ajustar sua busca ou filtros</p>
            </div>
          )}
        </div>
      ) : (
        /* Cards Grid View Container */
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {processedProspects.map((p, idx) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <div 
                  key={p.id}
                  onClick={() => handleOpenModal(p, false)}
                  className={`bg-white rounded-2xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 flex flex-col overflow-hidden relative cursor-pointer group ${
                    isSelected 
                      ? 'border-blue-900 ring-2 ring-blue-900/10 shadow-md' 
                      : 'border-gray-200/80 hover:border-blue-300'
                  }`}
                >
                  {/* Checkbox de Seleção Rápida */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isSelected) {
                        setSelectedIds(prev => prev.filter(id => id !== p.id));
                      } else {
                        setSelectedIds(prev => [...prev, p.id]);
                      }
                    }}
                    className="absolute top-4 left-4 z-10 w-6 h-6 rounded-lg bg-white/90 backdrop-blur-sm border border-gray-200 flex items-center justify-center shadow-sm transition-all hover:scale-105"
                  >
                    <input 
                      type="checkbox"
                      className="rounded text-blue-900 focus:ring-blue-500 w-4 h-4 cursor-pointer border-gray-300"
                      checked={isSelected}
                      readOnly
                    />
                  </div>
  
                  {/* Número do Card */}
                  <span className="absolute top-4 right-4 text-[10px] font-black text-gray-400/80 tracking-wide select-none">
                    #{idx + 1}
                  </span>
  
                  {/* Corpo do Card */}
                  <div className="p-5 flex-1 flex flex-col pt-12">
                    {/* Nome da Clínica e Líder */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-800 text-[9px] font-black uppercase tracking-wider">
                          {p.responsible || 'Sem Líder'}
                        </span>
                        {p.followedOwner === 'Sim' && (
                          <span className="px-2 py-0.5 rounded-md bg-green-50 border border-green-100 text-green-700 text-[9px] font-black uppercase tracking-wider">
                            Seguiu Dono
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-gray-900 text-base leading-tight group-hover:text-blue-900 transition-colors">
                        {p.clinicName}
                      </h3>
                    </div>
  
                    {/* Informações Principais */}
                    <div className="space-y-2.5 text-xs text-gray-600 flex-1">
                      {/* Cidade/UF */}
                      {p.location && (
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-blue-600 shrink-0" />
                          <span className="font-semibold text-gray-800">{p.location}</span>
                        </div>
                      )}
  
                      {/* Dono */}
                      {p.ownerName && (
                        <div className="flex items-start gap-2">
                          <User size={13} className="text-pink-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-gray-800">{p.ownerName}</span>
                            {p.ownerInstagram && (
                              <a 
                                href={p.ownerInstagram} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                onClick={(e) => e.stopPropagation()}
                                className="text-[9px] font-bold text-pink-600 hover:underline flex items-center gap-1 mt-0.5 uppercase tracking-wide"
                              >
                                <Instagram size={9} /> Perfil do Dono
                              </a>
                            )}
                          </div>
                        </div>
                      )}
  
                      {/* Estrutura */}
                      {(p.size || p.age || p.collaborators) && (
                        <div className="flex items-start gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 mt-1">
                          <Building2 size={13} className="text-gray-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 text-[10px] font-bold text-gray-700 uppercase">
                            {p.size && <div>Cadeiras: {p.size}</div>}
                            {p.age && <div>Idade: {p.age}</div>}
                            {p.collaborators && <div>Colab.: {p.collaborators}</div>}
                          </div>
                        </div>
                      )}
  
                      {/* Google */}
                      {p.gmnRating && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-500 font-bold">★</span>
                          <span className="font-bold text-gray-800">{p.gmnRating}</span>
                          {p.gmnReviewsCount && (
                            <span className="text-[10px] text-gray-400 font-semibold">({p.gmnReviewsCount} avaliações)</span>
                          )}
                        </div>
                      )}
  
                      {/* Datas */}
                      <div className="text-[10px] font-bold text-gray-400/90 uppercase space-y-0.5 mt-2 border-t border-gray-100 pt-2.5">
                        {p.firstContactDate && <div>1º Contato: {p.firstContactDate}</div>}
                        {p.lastContactDate && <div>Último Contato: {p.lastContactDate}</div>}
                        {p.approachUsed && <div className="truncate text-gray-500">Abordagem: {p.approachUsed}</div>}
                      </div>
                    </div>
  
                    {/* Links e Ações rápidos */}
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-2.5">
                      {/* Links Sociais */}
                      <div className="flex gap-1">
                        {p.clinicInstagram && (
                          <a 
                            href={p.clinicInstagram} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white shadow-sm hover:scale-105 transition-transform" 
                            title="Instagram Clínica"
                          >
                            <Instagram size={12} />
                          </a>
                        )}
                        {p.gmn && (
                          <a 
                            href={p.gmn} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-blue-500 text-white shadow-sm hover:scale-105 transition-transform" 
                            title="Google Maps"
                          >
                            <MapPin size={12} />
                          </a>
                        )}
                        {p.site && (
                          <a 
                            href={p.site} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg bg-emerald-500 text-white shadow-sm hover:scale-105 transition-transform" 
                            title="Website"
                          >
                            <Globe size={12} />
                          </a>
                        )}
                      </div>
  
                      {/* Seletor de Progresso Rápido no Card */}
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 max-w-[125px]"
                      >
                        <select 
                          value={p.status}
                          onChange={(e) => handleQuickUpdate(p.id, 'status', e.target.value)}
                          className={`text-[9px] font-black px-2 py-1 rounded-xl border-none focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer shadow-sm w-full uppercase tracking-tighter transition-all ${STATUS_COLORS[p.status as keyof typeof STATUS_COLORS]}`}
                        >
                          <option value="">Progresso</option>
                          <option value="VERIFICAR ICP">VERIFICAR ICP</option>
                          <option value="Mandar Mensagem">Mandar Mensagem</option>
                          <option value="Mensagem Enviada">Mensagem Enviada</option>
                          <option value="1º Follow Up">1º Follow Up</option>
                          <option value="2º Follow Up">2º Follow Up</option>
                          <option value="3º+ Follow Up">3º+ Follow Up</option>
                          <option value="Cliente Respondeu">Cliente Respondeu</option>
                          <option value="Reunião Agendada">Reunião Agendada</option>
                          <option value="Cliente Fechado">Cliente Fechado</option>
                          <option value="Contrato Encerrado">Contrato Encerrado</option>
                          <option value="Base de Recomeço">Base de Recomeço</option>
                        </select>
                      </div>
  
                      {/* Excluir */}
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        {deletingId === p.id ? (
                          <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                            <button 
                              onClick={() => handleDelete(p.id)}
                              className="px-1.5 py-0.5 bg-red-600 text-white text-[8px] font-black rounded-lg hover:bg-red-700 transition-all"
                            >
                              Sim
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[8px] font-black rounded-lg hover:bg-gray-300 transition-all"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(p.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
  
          {processedProspects.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="bg-gray-50 p-6 rounded-full mb-4">
                <Search size={40} />
              </div>
              <p className="text-lg font-medium">Nenhum prospecto encontrado</p>
              <p className="text-sm">Tente ajustar sua busca ou filtros</p>
            </div>
          )}
        </div>
      )}

      {/* Modal para Adicionar/Editar */}

      {isModalOpen && (
        <div 
          onClick={handleCloseAndSave}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`bg-white rounded-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 ${!editingProspect ? 'max-w-7xl' : 'max-w-4xl'}`}
          >
            <div className="px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between bg-blue-900 text-white gap-4">
              <div>
                <h2 className="text-xl font-bold">{editingProspect ? 'Editar Prospecto' : 'Novo Prospecto'}</h2>
                <p className="text-blue-100 text-sm">
                  {editingProspect ? `Editando: ${formData.clinicName}` : 'Preencha os dados da clínica para prospecção'}
                </p>
              </div>
              
              {/* Exibição do Progresso Atual grande e em destaque */}
              <div className="flex items-center">
                <div className={`px-4 py-2 rounded-2xl text-xs font-black tracking-wide shadow-sm flex items-center gap-2 uppercase border ${
                  formData.status === 'Base de Recomeço'
                    ? 'bg-red-500 border-red-400 text-white animate-pulse'
                    : 'bg-white border-blue-200 text-blue-900'
                }`}>
                  {formData.status === 'Base de Recomeço' ? (
                    <>
                      <RotateCcw size={12} className="animate-spin" />
                      Base de Recomeço
                    </>
                  ) : (
                    <>
                      <span className="uppercase font-bold text-blue-950">
                        Progresso: {formData.status || 'Não Iniciado'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button 
                onClick={handleCloseAndSave}
                className="p-2 hover:bg-white/20 rounded-full transition-colors self-end sm:self-auto"
                title="Salvar e Fechar"
              >
                <ChevronDown className="rotate-180" size={24} />
              </button>
            </div>

            {/* Tabs for Editing - Design Pills Premium */}
            {editingProspect && (
              <div className="flex flex-wrap border-b border-gray-100 bg-gray-50/50 p-4 gap-3 justify-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('dados')}
                  className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'dados'
                      ? 'bg-blue-900 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <User size={14} /> Dados de Prospecção
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ia')}
                  className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'ia'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-800 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Sparkles size={14} className={activeTab === 'ia' ? 'text-yellow-300 animate-pulse' : 'text-indigo-600'} /> Inteligência Artificial (Gemini)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('instagram')}
                  className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'instagram'
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Instagram size={14} className={activeTab === 'instagram' ? 'text-white' : 'text-pink-600'} /> Mensagem Instagram (IA)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ageStr = formData.age || '';
                    const ageMatch = ageStr.match(/(\d+)/);
                    const years = ageMatch ? parseInt(ageMatch[1]) : 10;
                    
                    if (!formData.calculatorData) {
                      setFormData(prev => ({
                        ...prev,
                        calculatorData: {
                          yearsOpen: years,
                          patientsPerDay: 10,
                          workDaysPerWeek: 5,
                          ticketMedio: 400,
                          yearsWithData: Math.min(years, 5),
                          conversionRate: 1,
                          showResults: false
                        }
                      }));
                    }
                    setActiveTab('calculadora');
                  }}
                  className={`px-5 py-2.5 text-xs font-bold rounded-2xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'calculadora'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-700 text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <Calculator size={14} className={activeTab === 'calculadora' ? 'text-white' : 'text-amber-600'} /> Dinheiro Escondido
                </button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
              {duplicateWarning && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl shadow-sm animate-in fade-in duration-300">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm font-bold text-red-900 leading-snug">
                      {duplicateWarning}
                    </p>
                  </div>
                </div>
              )}
              <div className={!editingProspect ? "grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-8" : ""}>
                {/* Coluna Esquerda: Formulário Principal */}
                <div className={!editingProspect ? "border-r border-gray-100 pr-8" : ""}>
                  {(activeTab === 'dados' || !editingProspect) && (
                <div className="space-y-8 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Bloco 1: Clínica & Identificação (Azul) */}
                    <div className="md:col-span-3 bg-blue-50/10 border border-blue-100 rounded-3xl p-6 shadow-sm border-t-4 border-t-blue-600 transition-all hover:shadow-md">
                      <h4 className="text-sm font-black text-blue-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <User size={16} className="text-blue-600" />
                        1. Clínica & Identificação Geral
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Nome da Clínica *
                            {renderAiReviewBadge('clinicName')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            required
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Nome comercial da clínica"
                            value={formData.clinicName}
                            onChange={(e) => handleFieldChange('clinicName', e.target.value)}
                           />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Responsável Talí
                            {renderAiReviewBadge('responsible')}
                          </label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all text-sm font-medium bg-white"
                            value={formData.responsible}
                            onChange={(e) => handleFieldChange('responsible', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            <option value="Diogo">Diogo</option>
                            <option value="Helenilton">Helenilton</option>
                            <option value="Tali">Tali</option>
                          </select>
                        </div>
      
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Cidade/Bairro - UF
                            {renderAiReviewBadge('location')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Ex: Águas Claras - DF"
                            value={formData.location}
                            onChange={(e) => handleFieldChange('location', e.target.value)}
                           />
                        </div>

                        <div className="space-y-1 lg:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Endereço Completo
                            {renderAiReviewBadge('fullAddress')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Endereço completo (Rua, Número, Bairro, CEP)"
                            value={formData.fullAddress || ''}
                            onChange={(e) => handleFieldChange('fullAddress', e.target.value)}
                           />
                        </div>
 
                        <div className="space-y-1 md:col-span-3 lg:col-span-3">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Website Oficial
                            {renderAiReviewBadge('site')}
                          </label>
                          <input 
                            type="url" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all text-sm font-medium"
                            placeholder="https://..."
                            value={formData.site}
                            onChange={(e) => handleFieldChange('site', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco 2: Redes Sociais & Contatos (Rosa/Vinho) */}
                    <div className="md:col-span-3 bg-pink-50/10 border border-pink-100 rounded-3xl p-6 shadow-sm border-t-4 border-t-pink-500 transition-all hover:shadow-md">
                      <h4 className="text-sm font-black text-pink-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Instagram size={16} className="text-pink-600" />
                        2. Redes Sociais, Donos & Estrutura
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Instagram da Clínica
                            {renderAiReviewBadge('clinicInstagram')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Link ou @username"
                            value={formData.clinicInstagram}
                            onChange={(e) => handleFieldChange('clinicInstagram', e.target.value)}
                           />
                        </div>
      
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Nome do Proprietário / Dono
                            {renderAiReviewBadge('ownerName')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Nome completo do dono"
                            value={formData.ownerName}
                            onChange={(e) => handleFieldChange('ownerName', e.target.value)}
                           />
                        </div>
      
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Instagram do Dono
                            {renderAiReviewBadge('ownerInstagram')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Link ou @username"
                            value={formData.ownerInstagram}
                            onChange={(e) => handleFieldChange('ownerInstagram', e.target.value)}
                           />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Seguiu o Dono nas Redes?
                            {renderAiReviewBadge('followedOwner')}
                          </label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium bg-white"
                            value={formData.followedOwner}
                            onChange={(e) => handleFieldChange('followedOwner', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            <option value="Sim">Sim</option>
                            <option value="Solicitado">Solicitado</option>
                            <option value="Não">Não</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Nº de Colaboradores
                            {renderAiReviewBadge('collaborators')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Ex: 8 colaboradores"
                            value={formData.collaborators}
                            onChange={(e) => handleFieldChange('collaborators', e.target.value)}
                           />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Tamanho da Clínica (Cadeiras)
                            {renderAiReviewBadge('size')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Ex: 3 consultórios"
                            value={formData.size}
                            onChange={(e) => handleFieldChange('size', e.target.value)}
                           />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Idade da Empresa
                            {renderAiReviewBadge('age')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Ex: 4 anos"
                            value={formData.age}
                            onChange={(e) => handleFieldChange('age', e.target.value)}
                           />
                        </div>
                      </div>
                    </div>

                    {/* Bloco 3: Google Meu Negócio & Avaliações (Laranja/Amarelo) */}
                    <div className="md:col-span-3 bg-amber-50/10 border border-amber-100 rounded-3xl p-6 shadow-sm border-t-4 border-t-amber-500 transition-all hover:shadow-md">
                      <h4 className="text-sm font-black text-amber-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Globe size={16} className="text-amber-600" />
                        3. Google Meu Negócio & Nota Local
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Nota do GMN
                            {renderAiReviewBadge('gmnRating')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Ex: 4.9"
                            value={formData.gmnRating}
                            onChange={(e) => handleFieldChange('gmnRating', e.target.value)}
                           />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Qtd. Avaliações do Google
                            {renderAiReviewBadge('gmnReviewsCount')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Ex: 140 avaliações"
                            value={formData.gmnReviewsCount}
                            onChange={(e) => handleFieldChange('gmnReviewsCount', e.target.value)}
                           />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Link do GMN (Google Maps)
                            {renderAiReviewBadge('gmn')}
                          </label>
                          <input 
                            type="url" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium"
                            placeholder="https://maps.google.com/..."
                            value={formData.gmn}
                            onChange={(e) => handleFieldChange('gmn', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco 4: Estágio & Acompanhamento Comercial (Roxo) */}
                    <div className="md:col-span-3 bg-purple-50/10 border border-purple-100 rounded-3xl p-6 shadow-sm border-t-4 border-t-purple-500 transition-all hover:shadow-md">
                      <h4 className="text-sm font-black text-purple-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Clock size={16} className="text-purple-600" />
                        4. Estágio & Funil de Vendas
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Progresso
                            {renderAiReviewBadge('status')}
                          </label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium bg-white"
                            value={formData.status}
                            onChange={(e) => handleFieldChange('status', e.target.value as any)}
                          >
                            <option value="">Selecione...</option>
                            <option value="VERIFICAR ICP">0 - VERIFICAR ICP</option>
                            <option value="Mandar Mensagem">1 - Mandar Mensagem</option>
                            <option value="Mensagem Enviada">2 - Mensagem Enviada</option>
                            <option value="1º Follow Up">2.1 - 1º Follow Up</option>
                            <option value="2º Follow Up">2.2 - 2º Follow Up</option>
                            <option value="3º+ Follow Up">2.3 - 3º+ Follow Up</option>
                            <option value="Reunião Agendada">3 - Reunião Agendada</option>
                            <option value="Cliente Fechado">4 - Cliente Fechado</option>
                            <option value="Contrato Encerrado">5 - Contrato Encerrado</option>
                            <option value="Base de Recomeço">6 - Base de Recomeço</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Data do 1º Contato
                            {renderAiReviewBadge('firstContactDate')}
                          </label>
                          <input 
                            type="date" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium"
                            value={formData.firstContactDate}
                            onChange={(e) => handleFieldChange('firstContactDate', e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Semana
                            {renderAiReviewBadge('week')}
                          </label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium bg-white"
                            value={formData.week}
                            onChange={(e) => handleFieldChange('week', e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            <option value="Semana 1">Semana 1</option>
                            <option value="Semana 2">Semana 2</option>
                            <option value="Semana 3">Semana 3</option>
                            <option value="Semana 4">Semana 4</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Último Follow Up
                            {renderAiReviewBadge('lastContactDate')}
                          </label>
                          <input 
                            type="date" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium"
                            value={formData.lastContactDate}
                            onChange={(e) => handleFieldChange('lastContactDate', e.target.value)}
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2 lg:col-span-3">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Abordagem Comercial Utilizada
                            {renderAiReviewBadge('approachUsed')}
                          </label>
                          <textarea rows={1} onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 2 + 'px'; }} onBlur={(e) => { e.target.style.height = '44px'; }} style={{ minHeight: '44px', fieldSizing: 'content' }}  
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium resize-none overflow-hidden custom-scrollbar"
                            placeholder="Ex: Abordagem consultiva sobre pontos cegos do GMN / Parceria..."
                            value={formData.approachUsed}
                            onChange={(e) => handleFieldChange('approachUsed', e.target.value)}
                           />
                        </div>
                      </div>
                    </div>

                    {/* Observações Importantes (Cinza) */}
                    <div className="md:col-span-3 bg-gray-50/50 border border-gray-200 rounded-3xl p-6 shadow-sm border-t-4 border-t-gray-500 transition-all hover:shadow-md">
                      <h4 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <MessageSquare size={16} className="text-gray-500" />
                        Observações & Notas Importantes
                        {renderAiReviewBadge('observations')}
                      </h4>
                      <div className="space-y-1">
                        <textarea 
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all min-h-[120px] text-sm font-medium resize-y bg-white"
                          placeholder="Digite aqui particularidades do lead, dores específicas conversadas ou informações comerciais relevantes..."
                          value={formData.observations}
                          onChange={(e) => handleFieldChange('observations', e.target.value)}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              )}
                </div>
                
                {/* Coluna Direita: IA e Ferramentas */}
                <div className={!editingProspect ? "pl-2" : ""}>

              {(activeTab === 'ia' || !editingProspect) && (
                /* Gemini AI Section */
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-sm border border-blue-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-xl">
                        <Sparkles className="text-yellow-300 animate-pulse" size={22} />
                      </div>
                      <div>
                        <h4 className="font-bold text-base">Google Gemini AI — CRM Inteligente</h4>
                        <p className="text-xs text-blue-200">Gere análises táticas de abordagem ou preencha a ficha automaticamente com dados copiados.</p>
                      </div>
                    </div>
                  </div>


                  {/* Sub-tabs */}
                  <div className="flex gap-3 border-b border-gray-100 pb-4">
                    <button
                      type="button"
                      onClick={() => setAiSubTab('analise')}
                      className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                        aiSubTab === 'analise'
                          ? 'bg-indigo-700 text-white shadow-md'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Brain size={13} /> Análise Tática de Abordagem
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiSubTab('preenchimento')}
                      className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                        aiSubTab === 'preenchimento'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Sparkles size={13} /> Preenchimento Automático
                    </button>
                  </div>

                  {/* Sub-tab: Análise Tática */}
                  {aiSubTab === 'analise' && (
                    <div className="space-y-5 animate-in fade-in duration-150">
                      <div className="flex justify-center py-2">
                        <button
                          type="button"
                          disabled={isGeneratingAI}
                          onClick={() => handleGenerateAI()}
                          className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white font-bold px-8 py-3.5 rounded-xl hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingAI ? (
                            <>
                              <Loader2 className="animate-spin text-white" size={20} />
                              <span>Gemini está analisando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={20} className="text-yellow-300" />
                              <span>{formData.aiReport ? 'Atualizar Relatório Inteligente' : 'Gerar Relatório Inteligente (IA)'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {formData.aiReport && (
                        <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 duration-300">
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Brain size={18} className="text-blue-950" />
                              <span className="font-bold text-gray-800 text-sm">Relatório Gerado por Gemini</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(formData.aiReport || '');
                                alert('Relatório copiado para a área de transferência!');
                              }}
                              className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                            >
                              Copiar Texto
                            </button>
                          </div>
                          <div className="p-6 bg-white overflow-y-auto max-h-[400px]">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                              {formData.aiReport}
                            </pre>
                          </div>
                        </div>
                      )}

                      {!formData.aiReport && !isGeneratingAI && (
                        <div className="text-center py-12 text-gray-400 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl">
                          <Brain size={48} className="text-gray-300 mb-2" />
                          <p className="font-bold">Nenhuma análise gerada ainda</p>
                          <p className="text-xs max-w-sm mt-1">Preencha os dados na aba "Dados de Prospecção" e clique no botão acima para gerar um relatório tático personalizado.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-tab: Preenchimento Automático */}
                  {aiSubTab === 'preenchimento' && (
                    <div className="space-y-5 animate-in fade-in duration-150">
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2 bg-amber-100 rounded-xl shrink-0">
                            <Sparkles size={18} className="text-amber-700" />
                          </div>
                          <div>
                            <h5 className="font-bold text-amber-900 text-sm">Como usar o Preenchimento Automático</h5>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                              Cole abaixo qualquer texto com informações sobre a clínica — dados do Instagram, Google Meu Negócio, site, redes sociais, etc. A IA irá identificar e preencher os campos automaticamente. Os campos preenchidos receberão um selo <span className="font-black bg-amber-200 px-1 rounded">🟡 IA</span> para revisão.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <textarea
                            className="w-full px-4 py-3 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all min-h-[180px] text-sm font-medium resize-y bg-white"
                            placeholder={`Cole aqui os dados brutos que você coletou sobre a clínica...

Exemplos do que pode colar:
• Nome da clínica e do dono
• Link do Instagram, GMN, site
• Nota e quantidade de avaliações
• Localização, tamanho, colaboradores
• Qualquer texto livre sobre o lead

A IA vai interpretar e preencher a ficha! 🤖`}
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                          />

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-gray-500">
                              {freeText.length > 0 ? `${freeText.length} caracteres inseridos` : 'Aguardando dados...'}
                            </span>
                            <div className="flex gap-2">
                              {freeText && (
                                <button
                                  type="button"
                                  onClick={() => setFreeText('')}
                                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 border border-gray-200 hover:bg-gray-100 transition-all"
                                >
                                  Limpar
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isParsingFreeText || !freeText.trim()}
                                onClick={handleParseFreeText}
                                className="bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold px-6 py-2.5 rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                              >
                                {isParsingFreeText ? (
                                  <>
                                    <Loader2 className="animate-spin" size={15} />
                                    IA processando...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={15} />
                                    Preencher Ficha com IA
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {formData.aiFilledFields && formData.aiFilledFields.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
                          <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-green-800">
                              {formData.aiFilledFields.length} campo(s) preenchidos pela IA aguardando revisão
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              Vá para a aba <span className="font-black">"Dados de Prospecção"</span> e confirme cada campo com o botão ✓ no selo laranja "IA".
                            </p>
                            <button
                              type="button"
                              onClick={() => setActiveTab('dados')}
                              className="mt-2 text-xs font-bold text-green-700 underline hover:text-green-900"
                            >
                              Ir para Dados de Prospecção →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'instagram' && editingProspect && (
                /* Instagram message section */
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="bg-gradient-to-r from-purple-900 via-pink-800 to-pink-600 text-white p-6 rounded-2xl shadow-sm border border-purple-800">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white/10 rounded-xl">
                        <Instagram className="text-yellow-300" size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Gerador de Mensagem Comercial para Instagram</h4>
                        <p className="text-xs text-purple-100">Crie uma abordagem Direct B2B altamente personalizada com limite de 999 caracteres focada em Clínicas Odontológicas.</p>
                      </div>
                    </div>
                  </div>
 
                  {/* Generate Button */}
                  <div className="flex justify-center py-2">
                    <button
                      type="button"
                      disabled={isGeneratingInsta}
                      onClick={() => handleGenerateInstagramMessage()}
                      className="bg-gradient-to-r from-purple-700 to-pink-600 text-white font-bold px-8 py-3.5 rounded-xl hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingInsta ? (
                        <>
                          <Loader2 className="animate-spin text-white" size={20} />
                          <span>Gemini está personalizando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={20} className="text-yellow-300 animate-pulse" />
                          <span>{formData.instagramMessage ? 'Atualizar Mensagem Personalizada' : 'Gerar Abordagem Personalizada (IA)'}</span>
                        </>
                      )}
                    </button>
                  </div>
 
                  {/* Textarea for Editing */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <MessageSquare size={16} className="text-pink-600" />
                        Texto da Abordagem Direct
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.instagramMessage) {
                              navigator.clipboard.writeText(formData.instagramMessage);
                              alert('Mensagem copiada para a área de transferência!');
                            }
                          }}
                          disabled={!formData.instagramMessage}
                          className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                          Copiar Texto
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (editingProspect) {
                              await updateProspect(editingProspect.id, { instagramMessage: formData.instagramMessage });
                              alert('Mensagem salva com sucesso!');
                            }
                          }}
                          className="bg-pink-600 text-white hover:bg-pink-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                        >
                          Salvar Texto
                        </button>
                      </div>
                    </div>
                    <div className="p-6 bg-white space-y-3">
                      <textarea
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all min-h-[250px] text-sm text-gray-800 font-sans leading-relaxed resize-y"
                        placeholder="Clique em 'Gerar Abordagem' acima ou escreva manualmente sua mensagem..."
                        value={formData.instagramMessage || ''}
                        onChange={(e) => setFormData({...formData, instagramMessage: e.target.value})}
                      />
                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold px-1">
                        <span>Limite máximo: 999 caracteres</span>
                        <span className={formData.instagramMessage && formData.instagramMessage.length > 999 ? "text-red-500 font-bold" : "text-gray-600"}>
                          {formData.instagramMessage ? formData.instagramMessage.length : 0} / 999 caracteres
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Seção de Follow-ups do Direct */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm mt-8">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                        <Clock size={16} className="text-purple-600" />
                        Histórico de Follow-ups no Direct ({formData.followUps?.length || 0}/10)
                      </span>
                    </div>

                    <div className="p-6 bg-white space-y-6">
                      {/* Histórico Cadastrado */}
                      {(!formData.followUps || formData.followUps.length === 0) ? (
                        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          <p className="text-xs font-semibold">Nenhum follow-up enviado para este prospecto.</p>
                          <p className="text-[10px] mt-0.5">Use o formulário abaixo para registrar os follow-ups.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {formData.followUps.map((item, idx) => (
                            <div key={idx} className="flex gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 relative group animate-in fade-in-50 duration-200">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                    Follow-up #{idx + 1}
                                  </span>
                                  <span className="text-[10px] font-semibold text-gray-400">
                                    Enviado em: {item.date.split('-').reverse().join('/')}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-700 font-medium whitespace-pre-wrap leading-relaxed">
                                  {item.message}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const list = [...(formData.followUps || [])];
                                  list.splice(idx, 1);
                                  setFormData({ ...formData, followUps: list });
                                }}
                                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Excluir este follow-up"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulário de Adicionar Follow-up */}
                      {(formData.followUps?.length || 0) < 10 ? (
                        <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 space-y-4">
                          <h5 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                            Registrar Novo Follow-up
                          </h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1 space-y-1">
                              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wide">
                                Data do Envio
                              </label>
                              <input
                                type="date"
                                value={newFollowUpDate}
                                onChange={(e) => setNewFollowUpDate(e.target.value)}
                                className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                              />
                            </div>
                            <div className="md:col-span-3 space-y-1">
                              <label className="text-[10px] font-bold text-purple-900 uppercase tracking-wide font-sans">
                                Conteúdo / Anotação da Mensagem
                              </label>
                              <textarea
                                value={newFollowUpMsg}
                                onChange={(e) => setNewFollowUpMsg(e.target.value)}
                                placeholder="Descreva a mensagem enviada ou um resumo da resposta..."
                                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-purple-200 outline-none focus:ring-2 focus:ring-purple-500 bg-white min-h-[50px] resize-y"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={!newFollowUpMsg.trim()}
                              onClick={() => {
                                const currentList = [...(formData.followUps || [])];
                                const updatedList = [...currentList, { date: newFollowUpDate, message: newFollowUpMsg.trim() }];
                                
                                setFormData({
                                  ...formData,
                                  followUps: updatedList,
                                  currentStep: 2,
                                  lastFollowUp: newFollowUpDate,
                                  lastContactDate: newFollowUpDate
                                });
                                setNewFollowUpMsg('');
                              }}
                              className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Registrar Follow-up ({(formData.followUps?.length || 0) + 1}/10)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800 flex items-center gap-2">
                          <AlertCircle size={16} className="text-amber-600" />
                          <p className="text-xs font-semibold">
                            Limite de 10 follow-ups atingido. Se necessário, remova algum item acima para adicionar um novo.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'calculadora' && editingProspect && (() => {
                const calcData = formData.calculatorData || {
                  yearsOpen: 10,
                  patientsPerDay: 10,
                  workDaysPerWeek: 5,
                  ticketMedio: 400,
                  yearsWithData: 5,
                  conversionRate: 1,
                  showResults: false
                };

                const patientsPerWeek = calcData.patientsPerDay * calcData.workDaysPerWeek;
                const patientsPerMonth = patientsPerWeek * 4;
                const patientsPerYear = patientsPerMonth * 12;
                const totalPatients = patientsPerYear * calcData.yearsOpen;
                const patientsWithData = patientsPerYear * calcData.yearsWithData;
                const hiddenPatients = Math.round(patientsWithData * (calcData.conversionRate / 100));
                const potentialRevenue = hiddenPatients * calcData.ticketMedio;
                const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
                const fmtNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

                const calcSteps = [
                  { icon: Building2, label: 'Tempo de clínica', field: 'yearsOpen' as const, suffix: 'anos', description: 'Há quantos anos a clínica está aberta?', min: 1, max: 50 },
                  { icon: UsersIcon, label: 'Pacientes por dia', field: 'patientsPerDay' as const, suffix: 'pac/dia', description: 'Quantos pacientes são atendidos em média por dia?', min: 1, max: 100 },
                  { icon: CalendarDays, label: 'Dias de trabalho', field: 'workDaysPerWeek' as const, suffix: 'dias/sem', description: 'Quantos dias por semana a clínica atende?', min: 1, max: 7 },
                  { icon: DollarSign, label: 'Ticket médio', field: 'ticketMedio' as const, suffix: 'R$', description: 'Qual o ticket médio por paciente?', min: 50, max: 5000, step: 50, isCurrency: true },
                  { icon: Clock, label: 'Anos com dados', field: 'yearsWithData' as const, suffix: 'anos', description: 'Quantos anos de dados de pacientes a clínica possui?', min: 1, max: 50 },
                  { icon: Target, label: 'Taxa de conversão', field: 'conversionRate' as const, suffix: '%', description: 'Que % dos pacientes antigos voltariam com remarketing?', min: 0.5, max: 10, step: 0.5 },
                ];

                return (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-[#0C1122] via-[#131b3a] to-[#1a2550] rounded-2xl p-6 border border-white/5">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(82,113,255,0.15),transparent_70%)]" />
                      <div className="relative z-10 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-500/10 flex items-center justify-center border border-white/10">
                          <Calculator className="w-7 h-7 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-[9px] font-black uppercase tracking-widest text-amber-400">Relacionamento</span>
                          </div>
                          <h3 className="text-lg font-black text-white tracking-tight">
                            A Matemática do <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">Dinheiro Escondido</span>
                          </h3>
                          <p className="text-xs text-white/40 mt-0.5">Calculando para: <span className="text-white/70 font-bold">{formData.clinicName || 'Clínica'}</span></p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Left: Inputs */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center"><Zap size={12} className="text-blue-600" /></div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dados da Clínica</span>
                        </div>
                        {calcSteps.map((s) => {
                          const Icon = s.icon;
                          return (
                            <div key={s.field} className="group bg-white rounded-xl border border-gray-200/60 p-4 hover:border-blue-300/50 hover:shadow-sm transition-all">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
                                    <Icon size={14} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                                  </div>
                                  <div>
                                    <p className="text-[11px] font-bold text-gray-900">{s.label}</p>
                                    <p className="text-[9px] text-gray-400">{s.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200/60 px-2.5 py-1.5 min-w-[100px]">
                                  {s.isCurrency && <span className="text-gray-400 text-[10px] font-bold">R$</span>}
                                  <input
                                    type="number"
                                    value={calcData[s.field]}
                                    onChange={(e) => setFormData(prev => ({ ...prev, calculatorData: { ...calcData, [s.field]: parseFloat(e.target.value) || 0 } }))}
                                    min={s.min}
                                    max={s.max}
                                    step={s.step || 1}
                                    className="w-full bg-transparent text-right text-xs font-black text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  {!s.isCurrency && <span className="text-gray-400 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">{s.suffix}</span>}
                                </div>
                              </div>
                              <input
                                type="range"
                                value={calcData[s.field]}
                                onChange={(e) => setFormData(prev => ({ ...prev, calculatorData: { ...calcData, [s.field]: parseFloat(e.target.value) || 0 } }))}
                                min={s.min}
                                max={s.max}
                                step={s.step || 1}
                                className="w-full h-1 bg-gray-100 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-blue-600/30 [&::-webkit-slider-thumb]:cursor-pointer"
                              />
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, calculatorData: { ...calcData, showResults: true } }))}
                          className="w-full bg-gradient-to-r from-[#0C1122] to-[#1a2550] text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:shadow-lg hover:shadow-gray-900/20 transition-all flex items-center justify-center gap-2 border border-white/5 active:scale-[0.98]"
                        >
                          <Sparkles size={14} />
                          Calcular Dinheiro Escondido
                        </button>
                      </div>

                      {/* Right: Results */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center"><TrendingUp size={12} className="text-amber-600" /></div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conta de Padaria</span>
                        </div>

                        {/* Waterfall */}
                        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Projeção de Pacientes Acumulados</p>
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[11px] text-gray-500">Pacientes por semana</span>
                              <span className="text-xs font-black text-gray-900">{calcData.patientsPerDay} × {calcData.workDaysPerWeek} = {fmtNumber(patientsPerWeek)}</span>
                            </div>
                            <div className="h-px bg-gray-100" />
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[11px] text-gray-500">Pacientes por mês</span>
                              <span className="text-xs font-black text-gray-900">{fmtNumber(patientsPerWeek)} × 4 = {fmtNumber(patientsPerMonth)}</span>
                            </div>
                            <div className="h-px bg-gray-100" />
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[11px] text-gray-500">Pacientes por ano</span>
                              <span className="text-xs font-black text-gray-900">{fmtNumber(patientsPerMonth)} × 12 = {fmtNumber(patientsPerYear)}</span>
                            </div>
                            <div className="h-px bg-gray-100" />
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[11px] text-gray-500">Total em {calcData.yearsOpen} anos</span>
                              <span className="text-xs font-black text-gray-900">{fmtNumber(patientsPerYear)} × {calcData.yearsOpen} = {fmtNumber(totalPatients)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Data available */}
                        <div className="bg-white rounded-xl border border-gray-200/60 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-100 bg-blue-50/30">
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Base de Dados Disponível</p>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-gray-500">Dados dos últimos {calcData.yearsWithData} anos</span>
                              <span className="text-base font-black text-blue-700">{fmtNumber(patientsWithData)}</span>
                            </div>
                            <p className="text-[9px] text-gray-400 mt-0.5">pacientes com dados de contato na base</p>
                          </div>
                        </div>

                        {/* Results */}
                        {calcData.showResults ? (
                          <div className="bg-gradient-to-br from-[#0C1122] via-[#131b3a] to-[#1a2550] rounded-xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                            <div className="px-4 py-3 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)] animate-pulse" />
                                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Resultado — {calcData.conversionRate}% de conversão</p>
                              </div>
                            </div>
                            <div className="p-5 space-y-4">
                              <div className="text-[11px] text-white/50">
                                {calcData.conversionRate}% de {fmtNumber(patientsWithData)} =
                              </div>
                              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Pacientes Novos Escondidos</p>
                                <p className="text-2xl font-black text-white tracking-tight">{fmtNumber(hiddenPatients)}</p>
                                <p className="text-[9px] text-white/40 mt-0.5">pacientes que estavam escondidos na base</p>
                              </div>
                              <div className="flex items-center gap-2 text-white/30">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Ticket médio</span>
                                <div className="flex-1 h-px bg-white/10" />
                              </div>
                              <div className="text-[11px] text-white/50">
                                {fmtNumber(hiddenPatients)} × {fmtCurrency(calcData.ticketMedio)} =
                              </div>
                              <div className="relative bg-gradient-to-br from-amber-400/20 to-amber-500/10 rounded-xl p-5 border border-amber-400/20">
                                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center">
                                  <Sparkles className="w-4 h-4 text-amber-400" />
                                </div>
                                <p className="text-[9px] font-black text-amber-400/60 uppercase tracking-widest mb-1">Receita Potencial com Remarketing</p>
                                <p className="text-3xl font-black text-amber-300 tracking-tight">{fmtCurrency(potentialRevenue)}</p>
                                <p className="text-[9px] text-amber-400/40 mt-1">de receita reativando pacientes inativos</p>
                              </div>
                              <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                <p className="text-[9px] text-white/30 leading-relaxed">
                                  💡 Esse é o dinheiro <span className="text-amber-400 font-bold">escondido</span> na base de pacientes de <span className="text-white/60 font-bold">{formData.clinicName || 'esta clínica'}</span>.
                                  Uma campanha de remarketing ou ação especial para essa lista pode trazer resultados significativos.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                              <Calculator className="w-6 h-6 text-gray-300" />
                            </div>
                            <p className="text-xs font-bold text-gray-300">Ajuste os valores e clique em<br/>Calcular para ver os resultados</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-4 border-t border-gray-100 pt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-500 hover:bg-gray-50 transition-all text-sm"
                >
                  Fechar Janela
                </button>
                  <button 
                    type="submit"
                    className="px-10 py-3 rounded-xl bg-blue-900 text-white font-bold hover:bg-blue-800 transition-all shadow-lg active:scale-95 text-sm"
                  >
                    {editingProspect ? 'Salvar Alterações' : 'Cadastrar Prospecto'}
                  </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {duplicateGroups && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <Copy className="text-orange-600" />
              Resolvendo Duplicados ({duplicateGroups.length} grupos encontrados)
            </h2>
            <p className="text-gray-600 mb-6 text-sm">
              Para cada grupo abaixo, revise as diferenças e clique em "Manter este" no registro correto. Os demais do mesmo grupo serão removidos permanentemente.
            </p>

            <div className="space-y-6">
              {duplicateGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="border border-orange-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-orange-50 px-4 py-2 border-b border-orange-200 flex justify-between items-center">
                    <span className="font-bold text-orange-800 text-sm">
                      Clínica: {group.items[0].clinicName} / {group.items[0].location}
                    </span>
                    {group.hasDifferences && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded font-bold flex items-center gap-1">
                        <AlertTriangle size={14} /> Atributos Diferentes
                      </span>
                    )}
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.items.map(item => (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-3 bg-white relative">
                        <div className="text-xs space-y-1 mb-4 text-gray-700">
                          <p><span className="font-semibold">Responsável:</span> {item.responsible}</p>
                          <p><span className="font-semibold">Dono:</span> {item.ownerName}</p>
                          <p><span className="font-semibold">Nota/GMN:</span> {item.gmnRating} / {item.gmnReviewsCount}</p>
                          <p><span className="font-semibold">Estrutura:</span> {item.size}</p>
                          <p><span className="font-semibold">Status:</span> {item.status}</p>
                        </div>
                        <button
                          onClick={() => handleKeepDuplicate(groupIndex, item.id)}
                          disabled={isCleaning}
                          className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                          {isCleaning ? 'Processando...' : 'Manter este'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDuplicateGroups(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                disabled={isCleaning}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0C1122]/95 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 z-[100] flex items-center gap-6 animate-in slide-in-from-bottom-5 duration-300">
          <span className="text-xs font-bold tracking-wide">
            {selectedIds.length} {selectedIds.length === 1 ? 'prospecto selecionado' : 'prospectos selecionados'}
          </span>
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => setSelectedIds([])}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 border border-white/10"
            >
              Cancelar
            </button>
            <button 
              type="button"
              onClick={handleBulkDelete}
              disabled={isCleaning}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all active:scale-95 shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Excluir Selecionados
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
