import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  CalendarDays
} from 'lucide-react';
import { Prospect, CompanyType } from '../types';
import { subscribeToProspects, addProspect, updateProspect, deleteProspect } from '../services/firestoreService';
import { generateProspectReport, generateInstagramMessage, parseProspectFromBlockText } from '../services/geminiService';

interface ProspectingViewProps {
  companyId: CompanyType;
}

const STATUS_COLORS = {
  'Mandar mensagem': 'bg-amber-100 text-amber-800',
  'Mensagem Enviada': 'bg-blue-100 text-blue-800',
  '1º Follow up': 'bg-cyan-100 text-cyan-800',
  '2º Follow up': 'bg-purple-100 text-purple-800',
  'Reunião Agendada': 'bg-green-100 text-green-800',
  'Cliente Fechado': 'bg-emerald-800 text-white',
  'Contato Encerrado': 'bg-red-100 text-red-800',
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
  const [quickFilter, setQuickFilter] = useState<'active' | 'step1' | 'step2' | 'step3' | 'step4' | 'restart' | 'all'>('active');
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Prospect; direction: 'asc' | 'desc' } | null>(null);
  
  // IA Gemini States
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingInsta, setIsGeneratingInsta] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState((import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem('gemini_api_key') || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'ia' | 'instagram' | 'calculadora'>('dados');

  // Follow Up Form States
  const [newFollowUpDate, setNewFollowUpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newFollowUpMsg, setNewFollowUpMsg] = useState('');

  // AI Parsing States
  const [freeText, setFreeText] = useState('');
  const [isParsingFreeText, setIsParsingFreeText] = useState(false);
  const [aiSubTab, setAiSubTab] = useState<'analise' | 'preenchimento'>('preenchimento');

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
        matchesQuickFilter = !p.isRestartBase && p.currentStep < 4;
      } else if (quickFilter === 'step1') {
        matchesQuickFilter = !p.isRestartBase && p.currentStep === 1;
      } else if (quickFilter === 'step2') {
        matchesQuickFilter = !p.isRestartBase && p.currentStep === 2;
      } else if (quickFilter === 'step3') {
        matchesQuickFilter = !p.isRestartBase && p.currentStep === 3;
      } else if (quickFilter === 'step4') {
        matchesQuickFilter = !p.isRestartBase && p.currentStep === 4;
      } else if (quickFilter === 'restart') {
        matchesQuickFilter = !!p.isRestartBase;
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
      });
    } else {
      setEditingProspect(null);
      setFormData({
        order: prospects.length + 1,
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
  const [confirmClean, setConfirmClean] = useState<{count: number, ids: string[]} | null>(null);

  const startRemoveDuplicates = () => {
    console.log('Iniciando verificação de duplicados...', { count: prospects.length });
    if (prospects.length === 0) {
      alert('Não há registros para verificar.');
      return;
    }

    const seen = new Map<string, string>(); // key -> id
    const toDelete: string[] = [];

    prospects.forEach(p => {
      const normalizedName = p.clinicName.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedLocation = p.location.toLowerCase().trim().replace(/\s+/g, ' ');
      const key = `${normalizedName}|${normalizedLocation}`;
      
      if (seen.has(key)) {
        toDelete.push(p.id);
      } else {
        seen.set(key, p.id);
      }
    });

    if (toDelete.length === 0) {
      alert('Nenhum registro duplicado encontrado (mesmo nome e localização).');
      return;
    }

    setConfirmClean({ count: toDelete.length, ids: toDelete });
  };

  const handleRemoveDuplicates = async () => {
    if (!confirmClean) return;
    
    setIsCleaning(true);
    try {
      let count = 0;
      for (const id of confirmClean.ids) {
        console.log(`Deletando ${count + 1}/${confirmClean.count}: ${id}`);
        await deleteProspect(id);
        count++;
      }
      alert(`${count} registros duplicados foram removidos com sucesso!`);
      setConfirmClean(null);
    } catch (error) {
      console.error('Erro crítico ao remover duplicados:', error);
      alert('Erro ao processar a limpeza. Verifique o console.');
    } finally {
      setIsCleaning(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      const result = await generateProspectReport(dummyProspect, apiKeyInput);
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

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKeyInput(key);
    setShowApiKeyInput(false);
    alert('Chave de API do Gemini salva com sucesso localmente!');
  };

  const handleGenerateInstagramMessage = async (tempFormData?: typeof formData) => {
    const dataToUse = tempFormData || formData;
    
    const dummyProspect: Prospect = {
      id: editingProspect?.id || 'temp',
      ...dataToUse,
    } as Prospect;

    setIsGeneratingInsta(true);
    try {
      const result = await generateInstagramMessage(dummyProspect, apiKeyInput);
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
      const result = await parseProspectFromBlockText(freeText, apiKeyInput);
      if (result.success && result.data) {
        const parsed = result.data;
        const filledFields: string[] = [];
        // Detecta quais campos foram preenchidos pela IA
        const checkFields = [
          'clinicName','responsible','location','clinicInstagram','gmn','site',
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
        if (result.isMock) {
          alert(`✅ Dados extraídos (Modo Demonstração)! ${filledFields.length} campo(s) foram preenchidos automaticamente. Verifique os campos marcados com o selo laranja "IA" antes de salvar.`);
        } else {
          alert(`✅ Gemini extraiu ${filledFields.length} campo(s) com sucesso! Verifique os campos marcados com o selo laranja "IA" e confirme antes de salvar.`);
        }
        setAiSubTab('analise');
        setActiveTab('dados');
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
    const data = [
      { order: 1, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Concept Odontologia', clinicInstagram: 'https://www.instagram.com/concept.clinica/', gmn: 'https://www.google.com/maps?cid=17107572292729933206', site: 'https://conceptclinica.com.br/', ownerName: 'Wadson Almeida', ownerInstagram: 'https://www.instagram.com/wadson.santos.10/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '5 anos', gmnRating: '4,8 / 682', observations: '', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: 'v1', firstContactDate: '5-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 2, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Odonto Aguas Claras', clinicInstagram: 'https://www.instagram.com/odontoaguasclaras/', gmn: 'https://www.google.com/maps?cid=10289450762552572900', site: 'https://www.odontoaguasclaras.com.br/', ownerName: 'Carlos Eduardo Silva Vale, Heverton de Alencar Silva Ferreira, Mariana Barroso Coelho', ownerInstagram: 'https://www.instagram.com/marianab.coelho/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '17 anos', gmnRating: '4,9 / 225', observations: '', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: 'v2', firstContactDate: '20-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 3, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Qualis Odontologia', clinicInstagram: 'https://www.instagram.com/qualisodonto/', gmn: 'https://www.google.com/maps?cid=3577241715842256808', site: 'https://qualisodonto.com.br/', ownerName: 'Eduardo Franco', ownerInstagram: 'https://www.instagram.com/dreduardofranco/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '5 anos', gmnRating: '5,0 / 204', observations: '', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '', week: 'Semana 1', currentStep: 1, },
      { order: 4, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Clinica Odontológica Odontec', clinicInstagram: 'https://www.instagram.com/clinica.odontec/', gmn: 'https://www.google.com/maps/place/Cl%C3%ADnica+Odontol%C3%B3gica+Odontec/@-15.8338077,-48.0378024,17z/data=!3m1!4b1!4m6!3m5!1s0x935a3348fd37c5a7:0x3404dbe8bfc6a849!8m2!3d-15.8338077!4d-48.0378024!16s%2Fg%2F11px51gg3t?entry=ttu&g_ep=EgoyMDI2MDUwMi4wIKXMDSoASAFQAw%3D%3D', site: 'Não encontrado', ownerName: 'RAFAEL ASSIS MARQUES, EDYLANE SANTOS ALVES', ownerInstagram: 'https://www.instagram.com/lanesantos26/ , https://www.instagram.com/rafassis92/', followedOwner: 'Solicitado', collaborators: '', size: '1 Cadeira', age: '5 anos', gmnRating: '4,9 / 550', observations: 'Mensagem enviada para o Rafael, o perfil da Edylane é fechado', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '', week: 'Semana 1', currentStep: 1, },
      { order: 5, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'SouClinic', clinicInstagram: 'https://www.instagram.com/souclinic.ac/', gmn: 'https://www.google.com/maps?cid=8726339100314093995', site: 'https://karinevitoria.com.br/?utm_source=GoogleMeuNegocio', ownerName: 'Karine Vitoria Monte Cardoso', ownerInstagram: 'https://www.instagram.com/dra.karinecardosov/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '3 meses', gmnRating: '4,9 / 472', observations: 'Tem muitos colaboradores para o tamanho dela', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '', week: 'Semana 1', currentStep: 1, },
      { order: 6, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Luna Odontologia', clinicInstagram: 'https://www.instagram.com/clinicalunaodontologia/', gmn: 'https://www.google.com/maps/place/Luna+Odontologia/@-15.8351167,-48.0120236,15z/data=!4m15!1m8!3m7!1s0x935a33d91ad83105:0xd0d97a046b6d30f2!2sLuna+Odontologia!8m2!3d-15.8351201!4d-48.0121682!10e5!16s%2Fg%2F11gwhg7wy6!3m5!1s0x935a33d91ad83105:0xd0d97a046b6d30f2!8m2!3d-15.8351201!4d-48.0121682!16s%2Fg%2F11gwhg7wy6?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D', site: 'https://www.lunaodonto.com.br/', ownerName: 'Aletheya Patrice ', ownerInstagram: 'https://www.instagram.com/aletheya_luna/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '8 anos', gmnRating: '4,9 / 208', observations: 'Aguardando ser aceito', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '', week: 'Semana 2', currentStep: 1, },
      { order: 7, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Ceorth Clínica Odontológica', clinicInstagram: 'https://www.instagram.com/ceorth_odontologia/', gmn: 'https://www.google.com/maps/place/CEORTH+CL%C3%8DNICA+ODONTOL%C3%93GICA/@-15.8367667,-48.0192754,17z/data=!3m1!4b1!4m6!3m5!1s0x935a32136b0d7aef:0xca1c7d001537a625!8m2!3d-15.8367667!4d-48.0192754!16s%2Fg%2F11b_2_khgx?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D', site: 'https://www.ceorth.com.br/', ownerName: 'Dra Camila Andrade', ownerInstagram: 'https://www.instagram.com/dracamilandrade/', followedOwner: 'Sim', collaborators: '5 a 10', size: '1 Cadeira', age: '13 anos', gmnRating: '4,9 / 185', observations: '', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '', week: 'Semana 2', currentStep: 1, },
      { order: 8, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'IBA Odontologia Integrada', clinicInstagram: 'https://www.instagram.com/ibaodontologia/', gmn: 'https://www.google.com/maps/place/IBA+Odontologia+Integrada/@-15.8421109,-48.0243103,3a,77.4y,90t/data=!3m8!1e2!3m6!1sAF1QipPThiL7kbMpVX7OBSkIRe-S5BJOD-T8ZaQ36jhH!2e10!3e12!6shttps:%2F%2Flh3.googleusercontent.com%2Fp%2FAF1QipPThiL7kbMpVX7OBSkIRe-S5BJOD-T8ZaQ36jhH%3Dw203-h104-k-no!7i1278!8i658!4m7!3m6!1s0x935a335666d5929b:0xa2e75534ce742888!8m2!3d-15.8418255!4d-48.0236968!10e5!16s%2Fg%2F11q4bwpyn4?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D', site: 'https://ibaodontologia.com.br/', ownerName: 'Julia Barros Alves, Laura Barros Alves', ownerInstagram: 'https://www.instagram.com/laurabarros.alves/ , https://www.instagram.com/drajuliabarros/', followedOwner: 'Sim', collaborators: '5 a 10', size: '1 Cadeira', age: '4 anos', gmnRating: '5,0 / 146', observations: 'Conhecida do Gabriel da AES', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: 'Oi Fulano, tudo bem?', firstContactDate: '', week: 'Semana 2', currentStep: 1, },
      { order: 9, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Alfa Ridere Centro Odontológico', clinicInstagram: 'https://www.instagram.com/alfaridere/', gmn: 'https://www.google.com/maps/place/Alfa+Ridere+Dentista+em+%C3%81guas+Claras+%7C+Ortodontia+Implante+e+Lentes+Dent%C3%A1rias/@-15.8359607,-48.0115019,17z/data=!3m1!4b1!4m6!3m5!1s0x935a32109bff34ef:0x470a63ce64f1bd93!8m2!3d-15.8359607!4d-48.0115019!16s%2Fg%2F11b6_cx9lg?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D', site: '-', ownerName: 'Dr Mauro Henrique, Dra Lorena Gonçalves de Faria', ownerInstagram: 'https://www.instagram.com/drmaurogontijofaria/ , https://www.instagram.com/dralorenagontijo/ ', followedOwner: 'Sim', collaborators: 'Até 5', size: '1 Cadeira', age: '12 anos', gmnRating: '5,0 / 114', observations: '', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: 'Oi Fulano, tudo bem?', firstContactDate: '', week: 'Semana 2', currentStep: 1, },
      { order: 10, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Odontocenter Águas Claras', clinicInstagram: 'https://www.instagram.com/odontocenteraguasclaras/', gmn: 'https://www.google.com/maps/place/Odontocenter+%C3%81guas+Claras/@-15.8339637,-48.0149226,17z/data=!3m1!4b1!4m6!3m5!1s0x935a33d37bb1ca75:0xe2bbb393595b646a!8m2!3d-15.8339637!4d-48.0149226!16s%2Fg%2F11gmvcxl_v?entry=ttu&g_ep=EgoyMDI2MDUwNi4wIKXMDSoASAFQAw%3D%3D', site: 'https://www.odontocenteracdf.com.br/', ownerName: 'Carla Pereira de Sousa - Sócio-Administrador, Eliane Seito Freire Maia - Sócio, Patricia Rogerio Elias - Sócio', ownerInstagram: 'https://www.instagram.com/carla_odontocenter/', followedOwner: 'Sim', collaborators: '5 a 10', size: '1 Cadeira', age: '18 anos', gmnRating: '4,9 / 155', observations: '', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: 'Oi Fulano, tudo bem?', firstContactDate: '', week: 'Semana 2', currentStep: 1, },
      { order: 11, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Lírios Odontologia', clinicInstagram: 'https://www.instagram.com/dra.alineolive/', gmn: 'Lírios Odontologia - Dra. Aline Olive', site: 'https://draalineolive.com/', ownerName: 'ALINE OLIVE DE ARAUJO JANUARIO', ownerInstagram: 'https://www.instagram.com/dra.alineolive/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '', gmnRating: '', observations: '- SEM SITE ATIVO, - Vídeo de Antes e depois muito bem pensado com imagem da pessoa e sorriso anterior no canto da tela', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: 'V2', firstContactDate: '6-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 12, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Onne Odontologia', clinicInstagram: 'https://www.instagram.com/onneodontologia/', gmn: 'Onne Odontologia | Dentista Águas Claras | Implante Dentário Aparelho Invisível Invisalign', site: 'https://onneodontologia.net/', ownerName: 'Dr Evandro Filho', ownerInstagram: 'https://www.instagram.com/evandroosternefilho/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '', gmnRating: '', observations: 'Site pessimamente Ruim, feito no Wix', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '6-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 13, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Atually Odontologia Especializada', clinicInstagram: 'https://www.instagram.com/atually.odontologia/', gmn: 'https://maps.google.com/?cid=15429181756021543609', site: 'https://atuallyodontologia.com.br/', ownerName: 'BRUNA MOREIRA COELHO, JHYMES DE SOUZA RODRIGUES', ownerInstagram: 'https://www.instagram.com/dra.bruna_moreira?igsh=MTBkcWh5czVkdDZyMQ%3D%3D&utm_source=qr, https://www.instagram.com/dr.jhymes_rodrigues/', followedOwner: 'Sim', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: 'Coloquei o Instagram dos dois Donos, segui os dois também, vai que com um deles da certo', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '6-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 14, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Odonto Abreu Clínica Odontológica', clinicInstagram: 'https://www.instagram.com/clinicaodontoabreu/', gmn: 'https://maps.google.com/?cid=6525529241232235457', site: 'https://www.odontoabreu.com.br/', ownerName: 'ANA PAULA DE ABREU', ownerInstagram: 'https://www.instagram.com/draanapaula_odontoabreu/', followedOwner: 'Sim', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: '- Site péssimo, aparentemente tem várias cadeiras na clínica, mas não vi os outros profissionais nem no site nem no instagram', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '6-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 15, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Plena Clínica Odontológica', clinicInstagram: 'https://www.instagram.com/plena.clinicaodonto/', gmn: 'https://maps.google.com/?cid=16473019337197712508', site: 'https://plenaodonto.com/', ownerName: 'POLIANA XAVIER', ownerInstagram: 'https://www.instagram.com/polianax.odp/', followedOwner: 'Sim', collaborators: '', size: '1 Cadeira', age: '', gmnRating: '', observations: '1 Cadeira só, parece pequena, voltada para crianças, Em dúvida sobre o ICP, mas vou entrar em contato', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '19-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 16, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Faces Odontologia', clinicInstagram: 'https://www.instagram.com/facesodontologia/', gmn: 'https://www.google.com/maps/place/Faces+Odontologia+Especializada+-+Lentes+de+Contato+Dental/@-15.8413189,-48.0231217,17z/data=!4m15!1m8!3m7!1s0x935a32727bd2a68b:0x324ae453e88d41c!2sFaces+Odontologia+Especializada+-+Lentes+de+Contato+Dental!8m2!3d-15.8413977!4d-48.0233!10e5!16s%2Fg%2F11dxl46nht!3m5!1s0x935a32727bd2a68b:0x324ae453e88d41c!8m2!3d-15.8413977!4d-48.0233!16s%2Fg%2F11dxl46nht?entry=ttu&g_ep=EgoyMDI2MDUwMi4wIKXMDSoASAFQAw%3D%3D', site: 'https://www.facesodontologia.com.br/in%C3%ADcio', ownerName: 'Dra. Karina de Oliveira Sales da Cruz', ownerInstagram: 'https://www.instagram.com/drakarinacruz/', followedOwner: 'Sim', collaborators: '', size: '2 Cadeiras', age: '', gmnRating: '', observations: 'GMN está legal, instagram e site da pra melhorar', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '7-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 18, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'COB - Centro Odontológico De Brasília', clinicInstagram: 'https://www.instagram.com/cob.odontologia/', gmn: 'https://maps.google.com/?cid=6409669711096750032', site: 'https://cobrasilia.com.br/', ownerName: 'WALKIRIA MENDES DE LIMA CERBINO', ownerInstagram: 'https://www.instagram.com/dra.walkiria/', followedOwner: 'Sim', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: 'Site não Carrega - 2 Unidades', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '7-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 19, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'IMP Odonto', clinicInstagram: 'https://www.instagram.com/impodonto/', gmn: 'https://maps.google.com/?cid=540869271782453575', site: 'http://impodonto.com.br/', ownerName: 'RICARDO FABRIS PAULIN, LIANA BONFIM MISSON PAULIN', ownerInstagram: 'https://www.instagram.com/drricardopaulin/', followedOwner: 'Solicitado', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: 'Ja tem Agência (https://insitemarketing.digital/)', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: 'Oi, Dr. Ricardo, tudo bem? Me chamo Helenilton Alves...', firstContactDate: '19-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 20, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'OdontoMed Clinica Odontologica', clinicInstagram: 'https://www.instagram.com/odontomed_df/', gmn: 'https://maps.google.com/?cid=16175309161409557498', site: 'NÃO TEM', ownerName: 'BARBARA CAROLINE PEDROZA TENORIO', ownerInstagram: 'https://www.instagram.com/dra.barbaractenorio/', followedOwner: 'Sim', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: 'Tentar pelo Facebook também: https://www.facebook.com/DraBarbaratenorio/', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '7-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 21, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Patrícia Pizzo Clínica Odontológica', clinicInstagram: 'https://www.instagram.com/odontopatriciapizzo/', gmn: 'https://maps.google.com/?cid=9944486686592341465', site: 'http://www.patriciapizzo.com.br/', ownerName: 'PATRICIA MARIA PIZZO REIS', ownerInstagram: 'https://www.instagram.com/odontopatriciapizzo/', followedOwner: 'Sim', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: '', status: 'Mensagem Enviada', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '7-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 22, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'SCury Odontologia', clinicInstagram: 'https://www.instagram.com/scuryodontologia/', gmn: 'https://maps.google.com/?cid=12964385716841226767', site: 'http://scuryodontologia.com.br/', ownerName: 'STEFANNY CURY GUERRA VASCONCELOS', ownerInstagram: 'https://www.instagram.com/tetycury/', followedOwner: 'Solicitado', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: '', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '7-mai.-2026', week: 'Semana 2', currentStep: 1, },
      { order: 23, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Orthos Odontologia', clinicInstagram: 'https://www.instagram.com/orthosbrasilia', gmn: 'https://maps.google.com/?cid=17602167728930593026', site: 'https://orthosodonto.com.br/', ownerName: 'Dra Mariella Salgado', ownerInstagram: 'https://www.instagram.com/dra.mariellasalgado', followedOwner: 'Solicitado', collaborators: '', size: '3+ Cadeiras ', age: '', gmnRating: '', observations: 'Site fora do ar. Segui o Welss e o Sérgio Marra', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '19-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 24, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'harmonizare odontologia', clinicInstagram: 'https://www.instagram.com/p/C4_QFoqpjup/', gmn: 'https://www.google.com/maps/place/Harmonizare+Odontologia./@-15.7431803,-47.9024719,17z/data=!3m1!4b1!4m6!3m5!1s0x935a3a309ad6b9b7:0x398084b5a6eaa74a!8m2!3d-15.7431803!4d-47.9024719!16s%2Fg%2F11c5h2_dd6?hl=pt-BR&entry=ttu&g_ep=EgoyMDI2MDUxNy4wIKXMDSoASAFQAw%3D%3D', site: 'https://www.harmonizare.com/', ownerName: 'João Henrique', ownerInstagram: 'https://www.instagram.com/drjoaohenriquerosa/', followedOwner: 'Sim', collaborators: '', size: '2 Cadeiras', age: '', gmnRating: '', observations: '', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '19-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 25, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Perioclinic', clinicInstagram: 'https://www.instagram.com/perioclinicodontologiaa/', gmn: 'https://maps.google.com/?cid=4081078317850022728', site: 'http://odontologiaperioclinic.com.br/', ownerName: 'SAMARA SILVA TOMAZ', ownerInstagram: 'https://www.instagram.com/drasamaratomaz/', followedOwner: 'Sim', collaborators: '', size: '2 Cadeiras', age: '', gmnRating: '', observations: 'Site Fora do Ar', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '19-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 26, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Guiotti Galvão Odontologia - Dentista em Águas Claras', clinicInstagram: 'https://www.instagram.com/guiottigalvao/', gmn: 'https://maps.google.com/?cid=10607495656419104780', site: 'https://guiottigalvao.com.br/', ownerName: 'ADRIANO GUIOTTI GALVAO, JOVELINO FERREIRA GALVAO', ownerInstagram: '', followedOwner: '', collaborators: '', size: '', age: '', gmnRating: '', observations: '', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '19-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 28, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Onne Odontologia', clinicInstagram: 'https://www.instagram.com/onneodontologia/', gmn: 'https://maps.google.com/?cid=9231454741253015599', site: 'https://onneodontologia.net/', ownerName: 'HELEN DE MELO SANTOS OSTERNE', ownerInstagram: '', followedOwner: '', collaborators: '', size: '', age: '', gmnRating: '', observations: '', status: 'VERIFICAR', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '20-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 29, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Vital Odontologia e Saúde', clinicInstagram: 'https://www.instagram.com/vital_odonto_saude/', gmn: 'https://maps.google.com/?cid=406867147876303350', site: 'https://instagram.com/vital_odonto_saude?igshid=wetn0hqt7oxn', ownerName: 'FLAVIA MAYUMI KOMENO ENDRES, THIAGO ENDRES DA SILVA GOMES', ownerInstagram: '', followedOwner: '', collaborators: '', size: '', age: '', gmnRating: '', observations: '', status: 'VERIFICAR', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '20-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 30, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Ampla Odontologia', clinicInstagram: 'https://www.instagram.com/ampla_odontologia/', gmn: 'https://maps.google.com/?cid=9965070652727543755', site: '', ownerName: 'BIANCA DE SANTI BONATTI OLIVEIRA, THIAGO AMARAL DE OLIVEIRA', ownerInstagram: '', followedOwner: '', collaborators: '', size: '', age: '', gmnRating: '', observations: '', status: 'VERIFICAR', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '20-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 31, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Clínica Odontológica Sorriso Aberto', clinicInstagram: 'https://www.instagram.com/sorriso.aberto/', gmn: 'https://maps.google.com/?cid=11651250230918435552', site: '', ownerName: 'GILBERTO MINORU SHIMANO', ownerInstagram: '', followedOwner: '', collaborators: '', size: '', age: '', gmnRating: '', observations: '', status: 'VERIFICAR', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '20-mai.-2026', week: 'Semana 1', currentStep: 1, },
      { order: 32, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'OdontoZ', clinicInstagram: 'https://www.instagram.com/odontoz/', gmn: 'https://maps.google.com/?cid=11468393895107961725', site: 'https://www.odontoz.com.br/', ownerName: 'ZACARIAS SILVA CONDE, VINICIUS SILVA CONDE', ownerInstagram: '', followedOwner: '', collaborators: '', size: '', age: '', gmnRating: '', observations: '', status: 'VERIFICAR', hasAnswered: false, lastFollowUp: '', approachUsed: '', firstContactDate: '20-mai.-2026', week: 'Semana 1', currentStep: 1, },
    ];

    try {
      setIsImporting(true);
      console.log('Iniciando importação silenciosa...');
      for (const item of data) {
        await addProspect({
          ...item,
          companyId: companyId as any,
          followedOwner: item.followedOwner as any,
          status: item.status as any
        });
      }
      alert('Dados importados com sucesso!');
    } catch (error) {
      console.error('Erro na importação:', error);
      alert('Erro ao importar. Verifique o console.');
    } finally {
      setIsImporting(false);
    }
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
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar clínica, dono ou local..."
              className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none w-64 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          


          <button 
            onClick={importInitialData}
            disabled={isImporting}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all shadow-md active:scale-95 font-medium ${isImporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
            title="Importar dados da planilha"
          >
            {isImporting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Clock size={18} />
            )}
            {isImporting ? 'Importando...' : 'Importar Dados'}
          </button>
          
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-blue-900 text-white px-5 py-2 rounded-xl hover:bg-blue-800 transition-all shadow-md active:scale-95 font-medium"
          >
            <Plus size={20} />
            Novo Prospecto
          </button>
        </div>
      </div>

      {/* Barra de Filtros Rápidos */}
      <div className="flex flex-wrap items-center gap-2 mb-6 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Filtros Rápidos:</span>
        {[
          { key: 'active', label: 'Todos os Ativos', count: prospects.filter(p => !p.isRestartBase && p.currentStep < 4).length, colorClass: 'bg-blue-900 border-blue-900', textColor: 'text-blue-900', lightBg: 'bg-blue-50' },
          { key: 'step1', label: '01. Encontrar/Seguir', count: prospects.filter(p => !p.isRestartBase && p.currentStep === 1).length, colorClass: 'bg-cyan-600 border-cyan-600', textColor: 'text-cyan-600', lightBg: 'bg-cyan-50' },
          { key: 'step2', label: '02. Mensagem/Follows', count: prospects.filter(p => !p.isRestartBase && p.currentStep === 2).length, colorClass: 'bg-purple-600 border-purple-600', textColor: 'text-purple-600', lightBg: 'bg-purple-50' },
          { key: 'step3', label: '03. Reunião Agendada', count: prospects.filter(p => !p.isRestartBase && p.currentStep === 3).length, colorClass: 'bg-orange-500 border-orange-500', textColor: 'text-orange-500', lightBg: 'bg-orange-50' },
          { key: 'step4', label: '04. Contratou (Método)', count: prospects.filter(p => !p.isRestartBase && p.currentStep === 4).length, colorClass: 'bg-emerald-600 border-emerald-600', textColor: 'text-emerald-600', lightBg: 'bg-emerald-50' },
          { key: 'restart', label: '🔄 Base de Recomeço', count: prospects.filter(p => p.isRestartBase).length, colorClass: 'bg-slate-600 border-slate-600', textColor: 'text-slate-600', lightBg: 'bg-slate-50' },
          { key: 'all', label: 'Mostrar Todos', count: prospects.length, colorClass: 'bg-gray-800 border-gray-800', textColor: 'text-gray-800', lightBg: 'bg-gray-50' }
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap ${
              quickFilter === f.key
                ? `${f.colorClass} text-white shadow-md`
                : `bg-white border-gray-200 ${f.textColor} hover:${f.lightBg}`
            }`}
          >
            {f.label}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              quickFilter === f.key
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
        {quickFilter !== 'active' && (
          <button
            onClick={() => setQuickFilter('active')}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all border border-red-100 flex items-center gap-1 ml-auto"
            title="Limpar Filtro"
          >
            <RotateCcw size={14} /> Limpar Filtro
          </button>
        )}
      </div>

      {/* Table Container */}
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
          <table className="w-full text-left border-collapse min-w-[1800px]">
            <thead>
              <tr className="bg-[#004a8d] text-white">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Ordem {renderFilterDropdown('order', 'Ordem')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Responsável {renderFilterDropdown('responsible', 'Responsável')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Cidade/Bairro {renderFilterDropdown('location', 'Localização')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Clínica {renderFilterDropdown('clinicName', 'Clínica')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Links {renderFilterDropdown('clinicInstagram', 'Links')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Dono {renderFilterDropdown('ownerName', 'Dono')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Estrutura/Idade {renderFilterDropdown('size', 'Tamanho')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Avaliações Google {renderFilterDropdown('gmnRating', 'Nota GMN')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 min-w-[200px]">
                  Status & Seguiu {renderFilterDropdown('status', 'Status')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Progresso {renderFilterDropdown('currentStep', 'Passo')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 text-center">
                  Resp? {renderFilterDropdown('hasAnswered', 'Resposta')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30">
                  Datas/Abordagem {renderFilterDropdown('firstContactDate', 'Datas')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider border-r border-blue-800/30 text-center">
                  IA Gemini
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedProspects.map((p, idx) => (
                <tr key={p.id} className={`hover:bg-blue-50/50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td 
                    onClick={() => !hasDragged && handleOpenModal(p, false)}
                    className="px-4 py-4 text-sm text-gray-600 font-medium border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    {p.order}
                  </td>
                  <td 
                    onClick={() => !hasDragged && handleOpenModal(p, false)}
                    className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 shadow-sm">
                      {p.responsible || 'Pendente'}
                    </span>
                  </td>
                  <td 
                    onClick={() => !hasDragged && handleOpenModal(p, false)}
                    className="px-4 py-4 text-sm text-gray-600 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
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
                    className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="flex gap-2">
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
                    className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
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
                    className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
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
                    className="px-4 py-4 border-r border-gray-100 cursor-pointer hover:bg-blue-50/40 transition-colors"
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
                  <td className="px-4 py-4 border-r border-gray-100">
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
                        <option value="">Definir Status</option>
                        <option value="Mandar mensagem">Mandar mensagem</option>
                        <option value="Mensagem Enviada">Mensagem Enviada</option>
                        <option value="1º Follow up">1º Follow up</option>
                        <option value="2º Follow up">2º Follow up</option>
                        <option value="Reunião Agendada">Reunião Agendada</option>
                        <option value="Cliente Fechado">Cliente Fechado</option>
                        <option value="Contato Encerrado">Contato Encerrado</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-100">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map(step => (
                          <button
                            key={step}
                            onClick={() => {
                              handleQuickUpdate(p.id, 'currentStep', step);
                              if (p.isRestartBase) {
                                handleQuickUpdate(p.id, 'isRestartBase', false);
                              }
                            }}
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                              p.currentStep >= step && !p.isRestartBase
                                ? 'bg-blue-900 text-white shadow-sm' 
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={`Passo ${step}`}
                          >
                            {step}
                          </button>
                        ))}
                      </div>

                      <div className="h-4 w-[1px] bg-gray-200 mx-0.5"></div>

                      <button
                        onClick={() => handleQuickUpdate(p.id, 'isRestartBase', !p.isRestartBase)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                          p.isRestartBase
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-white border border-red-200 text-red-500 hover:bg-red-50'
                        }`}
                        title="Base de Recomeço"
                      >
                        <RotateCcw size={10} className={p.isRestartBase ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {p.isRestartBase ? (
                        <span className="inline-block text-[9px] font-black text-red-600 uppercase tracking-tighter bg-red-50 px-1 py-0.5 rounded-md border border-red-100 w-fit">
                          🔄 Recomeçar
                        </span>
                      ) : (
                        <div className="text-[9px] font-bold text-blue-900 uppercase tracking-tighter">
                          {p.currentStep === 1 
                            ? '01. Encontrar/Seguir' 
                            : p.currentStep === 2 
                            ? `02. Msg (${p.followUps?.length || 0} f.ups)` 
                            : p.currentStep === 3 
                            ? '03. Reunião Marcada' 
                            : '04. Contratou (Método)'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center border-r border-gray-100">
                    <button 
                      onClick={() => handleQuickUpdate(p.id, 'hasAnswered', !p.hasAnswered)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${p.hasAnswered ? 'bg-green-500 border-green-500 text-white shadow-green-200 shadow-lg' : 'bg-white border-gray-200 text-transparent'}`}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-100">
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
                  <td className="px-4 py-4 text-center border-r border-gray-100">
                    <button
                      onClick={() => handleOpenModal(p, true)}
                      className={`p-2 rounded-xl transition-all shadow-sm hover:scale-110 inline-flex ${
                        p.aiReport 
                          ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white' 
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={p.aiReport ? "Ver Relatório IA" : "Gerar Relatório IA"}
                    >
                      <Sparkles size={14} className={p.aiReport ? "animate-pulse" : ""} />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(p, false)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Editar Registro"
                      >
                        <Edit2 size={16} />
                      </button>
                      {deletingId === p.id ? (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                          <button 
                            onClick={() => handleDelete(p.id)}
                            className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-all"
                          >
                            Confirmar
                          </button>
                          <button 
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded-lg hover:bg-gray-300 transition-all"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingId(p.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir Registro"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
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

      {/* Modal para Adicionar/Editar */}

      {isModalOpen && (
        <div 
          onClick={handleCloseAndSave}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between bg-blue-900 text-white gap-4">
              <div>
                <h2 className="text-xl font-bold">{editingProspect ? 'Editar Prospecto' : 'Novo Prospecto'}</h2>
                <p className="text-blue-100 text-sm">
                  {editingProspect ? `Editando: ${formData.clinicName}` : 'Preencha os dados da clínica para prospecção'}
                </p>
              </div>
              
              {/* Exibição do Estágio Atual grande e em destaque */}
              <div className="flex items-center">
                <div className={`px-4 py-2 rounded-2xl text-xs font-black tracking-wide shadow-sm flex items-center gap-2 uppercase border ${
                  formData.isRestartBase
                    ? 'bg-red-500 border-red-400 text-white animate-pulse'
                    : 'bg-white border-blue-200 text-blue-900'
                }`}>
                  {formData.isRestartBase ? (
                    <>
                      <RotateCcw size={12} className="animate-spin" />
                      Base de Recomeço
                    </>
                  ) : (
                    <>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                        formData.currentStep === 1 ? 'bg-cyan-600' :
                        formData.currentStep === 2 ? 'bg-purple-600' :
                        formData.currentStep === 3 ? 'bg-orange-500' :
                        formData.currentStep === 4 ? 'bg-emerald-600' : 'bg-blue-950'
                      }`}>
                        {formData.currentStep}
                      </span>
                      <span className={`uppercase font-bold ${
                        formData.currentStep === 1 ? 'text-cyan-600' :
                        formData.currentStep === 2 ? 'text-purple-600' :
                        formData.currentStep === 3 ? 'text-orange-500' :
                        formData.currentStep === 4 ? 'text-emerald-600' : 'text-blue-950'
                      }`}>
                        {formData.currentStep === 1 && 'Passo 01: Encontrar & Seguir'}
                        {formData.currentStep === 2 && 'Passo 02: Mensagem & Follows'}
                        {formData.currentStep === 3 && 'Passo 03: Reunião Agendada'}
                        {formData.currentStep === 4 && 'Passo 04: Contratou (Método)'}
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
                          <input 
                            type="text" 
                            required
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all text-sm font-medium"
                            placeholder="Ex: Águas Claras - DF"
                            value={formData.location}
                            onChange={(e) => handleFieldChange('location', e.target.value)}
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2 lg:col-span-3">
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-600 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium"
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium"
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
                        
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Estágio de Prospecção
                          </label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium bg-white"
                            value={formData.currentStep}
                            onChange={(e) => handleFieldChange('currentStep', Number(e.target.value))}
                          >
                            <option value={1}>Passo 01: Encontrar & Seguir</option>
                            <option value={2}>Passo 02: Enviar Mensagem (Direct)</option>
                            <option value={3}>Passo 03: Reunião Comercial</option>
                            <option value={4}>Passo 04: Cliente Fechado (Método)</option>
                          </select>
                        </div>

                        <div className="space-y-1 flex flex-col justify-end">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 mb-1 block">
                            Situação da Prospecção
                          </label>
                          <div className="flex items-center h-[42px]">
                            <label className="inline-flex items-center cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.isRestartBase || false}
                                onChange={(e) => handleFieldChange('isRestartBase', e.target.checked)}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 relative"></div>
                              <span className="ml-3 text-xs font-black text-red-600 uppercase tracking-wide">
                                🔄 Base de Recomeço
                              </span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-gray-500 uppercase ml-1 flex items-center">
                            Status da Mensagem
                            {renderAiReviewBadge('status')}
                          </label>
                          <select 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium bg-white"
                            value={formData.status}
                            onChange={(e) => handleFieldChange('status', e.target.value as any)}
                          >
                            <option value="">Selecione...</option>
                            <option value="Mandar mensagem">Mandar mensagem</option>
                            <option value="Mensagem Enviada">Mensagem Enviada</option>
                            <option value="1º Follow up">1º Follow up</option>
                            <option value="2º Follow up">2º Follow up</option>
                            <option value="Reunião Agendada">Reunião Agendada</option>
                            <option value="Cliente Fechado">Cliente Fechado</option>
                            <option value="Contato Encerrado">Contato Encerrado</option>
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
                          <input 
                            type="text" 
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-600 outline-none transition-all text-sm font-medium"
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

              {activeTab === 'ia' && editingProspect && (
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

                  {/* API Key Section */}
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key size={15} className="text-gray-500" />
                        <span className="text-sm font-bold text-gray-700">Chave de API do Gemini</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                        className="text-xs font-semibold text-blue-900 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!!import.meta.env.VITE_GEMINI_API_KEY}
                      >
                        {!!import.meta.env.VITE_GEMINI_API_KEY ? 'Chave Fixada' : (showApiKeyInput ? 'Ocultar Campo' : (apiKeyInput ? 'Alterar Chave' : 'Configurar Chave'))}
                      </button>
                    </div>

                    {apiKeyInput && !showApiKeyInput && (
                      <div className="text-xs text-green-700 font-bold bg-green-50 px-3 py-2 rounded-xl flex items-center gap-1.5 w-max border border-green-200">
                        {!!import.meta.env.VITE_GEMINI_API_KEY ? '✓ Chave de API configurada de forma fixa (ambiente)!' : '✓ Chave de API configurada localmente no navegador!'}
                      </div>
                    )}

                    {(!apiKeyInput || showApiKeyInput) && (
                      <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                        <input
                          type="password"
                          className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-900 outline-none"
                          placeholder="Cole sua API Key do Gemini aqui..."
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveApiKey(apiKeyInput)}
                          className="bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors"
                        >
                          Salvar
                        </button>
                      </div>
                    )}

                    {!apiKeyInput && (
                      <p className="text-[10px] text-amber-600 font-medium">
                        * Nenhuma chave configurada. O sistema funcionará em Modo de Demonstração estruturado.
                      </p>
                    )}
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
      </div>
    </div>
  );
};
