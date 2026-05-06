import React, { useState, useEffect, useMemo } from 'react';
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
  Loader2
} from 'lucide-react';
import { Prospect, CompanyType } from '../types';
import { subscribeToProspects, addProspect, updateProspect, deleteProspect } from '../services/firestoreService';

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
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Prospect; direction: 'asc' | 'desc' } | null>(null);

  // Form State
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
  });

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

      return matchesSearch && matchesFilters;
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
  }, [prospects, searchTerm, filters, sortConfig]);

  const handleOpenModal = (prospect?: Prospect) => {
    if (prospect) {
      setEditingProspect(prospect);
      setFormData({
        ...prospect,
        companyId: companyId // Ensure companyId is correct
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
      });
    }
    setIsModalOpen(true);
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

  const importInitialData = async () => {
    const data = [
      { order: 1, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Concept Odontologia', clinicInstagram: 'https://www.instagram.com/concept.clinica/', gmn: 'https://www.google.com/maps?cid=17107572292729933206', site: 'https://conceptclinica.com.br/', ownerName: 'Wadson Almeida', ownerInstagram: 'https://www.instagram.com/wadson.santos.10/', followedOwner: 'Sim', size: '1 Cadeira', age: '5 anos', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-05', week: 'Semana 1', currentStep: 1 },
      { order: 2, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Odonto Aguas Claras', clinicInstagram: 'https://www.instagram.com/odontoaguasclaras/', gmn: 'https://www.google.com/maps?cid=10289450762552572900', site: 'https://www.odontoaguasclaras.com.br/', ownerName: 'Carlos Eduardo Silva Vale, Heverton de Alencar Silva Ferreira, Mariana Barroso Coelho', ownerInstagram: 'https://www.instagram.com/marianab.coelho/', followedOwner: 'Sim', size: '1 Cadeira', age: '17 anos', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-05', week: 'Semana 1', currentStep: 1 },
      { order: 3, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Qualis Odontologia', clinicInstagram: 'https://www.instagram.com/qualisodonto/', gmn: 'https://www.google.com/maps?cid=3577241715842256808', site: 'https://qualisodonto.com.br/', ownerName: 'Eduardo Franco', ownerInstagram: 'https://www.instagram.com/dreduardofranco/', followedOwner: 'Sim', size: '1 Cadeira', age: '5 anos', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
      { order: 4, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'Clinica Odontológica Odontec', clinicInstagram: 'https://www.instagram.com/clinica.odontec/', gmn: 'https://www.google.com/maps/place/Cl%C3%ADnica+Odontol%C3%B3gica+Odontec/@-15.8338077,-48.0378024,17z/data=!3m1!4b1!4m6!3m5!1s0x935a3348fd37c5a7:0x3404dbe8bfc6a849!8m2!3d-15.8338077!4d-48.0378024!16s%2Fg%2F11px51gg3t?entry=ttu&g_ep=EgoyMDI2MDUwMi4wIKXMDSoASAFQAw%3D%3D', site: 'Não encontrado', ownerName: 'RAFAEL ASSIS MARQUES, EDYLANE SANTOS ALVES', ownerInstagram: 'https://www.instagram.com/lanesantos26/ , https://www.instagram.com/rafassis92/', followedOwner: 'Solicitado', size: '1 Cadeira', age: '5 anos', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', observations: 'Edylane parece ser mais proprietária do que o Rafael', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
      { order: 5, responsible: 'Diogo', location: 'Águas Claras - DF', clinicName: 'SouClinic', clinicInstagram: 'https://www.instagram.com/souclinic.ac/', gmn: 'https://www.google.com/maps?cid=8726339100314093995', site: 'https://karinevitoria.com.br/?utm_source=GoogleMeuNegocio', ownerName: 'Karine Vitoria Monte Cardoso', ownerInstagram: 'https://www.instagram.com/dra.karinecardosov/', followedOwner: 'Sim', size: '1 Cadeira', age: '3 meses', status: 'Mandar mensagem', hasAnswered: false, lastFollowUp: '', observations: 'Tem muitos colaboradores para o tamanho dela', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
      { order: 10, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Lírios Odontologia', clinicInstagram: 'https://www.instagram.com/dra.alineolive/', gmn: 'https://maps.google.com/?cid=3867221785075639666', site: 'https://draalineolive.com/', ownerName: 'ALINE OLIVE DE ARAUJO JANUARIO', ownerInstagram: '', followedOwner: '', size: '', age: '', status: '', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
      { order: 11, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Onne Odontologia', clinicInstagram: 'https://www.instagram.com/onneodontologia/', gmn: 'https://maps.google.com/?cid=9231454741253015599', site: 'https://onneodontologia.net/', ownerName: 'HELEN DE MELO SANTOS OSTERNE', ownerInstagram: '', followedOwner: '', size: '', age: '', status: '', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
      { order: 12, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Atually Odontologia Especializada', clinicInstagram: 'https://www.instagram.com/atually.odontologia/', gmn: 'https://maps.google.com/?cid=15429181756021543609', site: 'https://atuallyodontologia.com.br/', ownerName: 'BRUNA MOREIRA COELHO, JHYMES DE SOUZA RODRIGUES', ownerInstagram: '', followedOwner: '', size: '', age: '', status: '', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
      { order: 13, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Odonto Abreu Clínica Odontológica', clinicInstagram: 'https://www.instagram.com/clinicaodontoabreu/', gmn: 'https://maps.google.com/?cid=6525529241232235457', site: 'https://www.odontoabreu.com.br/', ownerName: 'ANA PAULA DE ABREU', ownerInstagram: '', followedOwner: '', size: '', age: '', status: '', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
      { order: 14, responsible: 'Helenilton', location: 'Águas Claras - DF', clinicName: 'Plena Clínica Odontológica', clinicInstagram: 'https://www.instagram.com/plena.clinicaodonto/', gmn: 'https://maps.google.com/?cid=16473019337197712508', site: 'https://plenaodonto.com/', ownerName: 'POLIANA XAVIER', ownerInstagram: '', followedOwner: '', size: '', age: '', status: '', hasAnswered: false, lastFollowUp: '', observations: '', firstContactDate: '2026-05-06', week: 'Semana 1', currentStep: 1 },
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
          
          {confirmClean ? (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
              <button 
                onClick={handleRemoveDuplicates}
                disabled={isCleaning}
                className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                {isCleaning ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Confirmar ({confirmClean.count})
              </button>
              <button 
                onClick={() => setConfirmClean(null)}
                className="bg-gray-200 text-gray-600 px-4 py-2 rounded-xl font-bold hover:bg-gray-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button 
              onClick={startRemoveDuplicates}
              disabled={isCleaning || prospects.length === 0}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl transition-all shadow-md active:scale-95 font-medium ${isCleaning ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'}`}
              title="Remover clínicas com nomes duplicados"
            >
              <Trash2 size={18} />
              Limpar Duplicados
            </button>
          )}

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

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1500px]">
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
                  Tamanho/Idade {renderFilterDropdown('size', 'Tamanho')}
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
                  Datas/Follow {renderFilterDropdown('firstContactDate', 'Datas')}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedProspects.map((p, idx) => (
                <tr key={p.id} className={`hover:bg-blue-50/50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-4 text-sm text-gray-600 font-medium border-r border-gray-100">{p.order}</td>
                  <td className="px-4 py-4 border-r border-gray-100">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 shadow-sm">
                      {p.responsible || 'Pendente'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 border-r border-gray-100">{p.location}</td>
                  <td className="px-4 py-4 border-r border-gray-100">
                    <div className="font-bold text-gray-900">{p.clinicName}</div>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-100">
                    <div className="flex gap-2">
                      {p.clinicInstagram && (
                        <a href={p.clinicInstagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white shadow-sm hover:scale-110 transition-transform" title="Instagram Clínica">
                          <Instagram size={14} />
                        </a>
                      )}
                      {p.gmn && (
                        <a href={p.gmn} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-blue-500 text-white shadow-sm hover:scale-110 transition-transform" title="GMN / Google Maps">
                          <MapPin size={14} />
                        </a>
                      )}
                      {p.site && (
                        <a href={p.site} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm hover:scale-110 transition-transform" title="Website">
                          <Globe size={14} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 border-r border-gray-100">
                    <div className="text-sm font-bold text-gray-800">{p.ownerName}</div>
                    {p.ownerInstagram && (
                      <a href={p.ownerInstagram} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-pink-600 hover:underline flex items-center gap-1 mt-1 uppercase">
                        <Instagram size={10} /> Perfil do Dono
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-4 border-r border-gray-100">
                    <div className="text-xs font-bold text-gray-700 bg-gray-100 inline-block px-2 py-0.5 rounded">{p.size || 'N/D'}</div>
                    <div className="text-[10px] font-medium text-gray-400 mt-1 uppercase">{p.age}</div>
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
                      {[1, 2, 3, 4].map(step => (
                        <button
                          key={step}
                          onClick={() => handleQuickUpdate(p.id, 'currentStep', step)}
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                            p.currentStep >= step 
                              ? 'bg-blue-900 text-white shadow-sm' 
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                          title={`Passo ${step}`}
                        >
                          {step}
                        </button>
                      ))}
                    </div>
                    <div className="text-[9px] font-bold text-blue-900 mt-1 uppercase tracking-tighter">
                      {p.currentStep === 1 ? 'Curtiu/Visto' : p.currentStep === 2 ? 'Msg Enviada' : `Passo ${p.currentStep}`}
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
                    <div className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                      <Calendar size={12} className="text-blue-500" /> {p.firstContactDate || 'N/D'}
                    </div>
                    <div className="text-[10px] font-black text-blue-600 mt-1.5 bg-blue-50 inline-block px-2 py-0.5 rounded-full uppercase">
                      {p.week}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(p)}
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

      {/* Process Steps Indicator (Pre-prepared) */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(step => (
          <div key={step} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${step === 1 ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {step}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Passo {step}</div>
              <div className="text-sm font-bold text-gray-700">
                {step === 1 ? 'Primeiro Contato' : step === 2 ? 'Envio de Mensagem' : `Passo ${step} (A definir)`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para Adicionar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-blue-900 text-white">
              <div>
                <h2 className="text-xl font-bold">{editingProspect ? 'Editar Prospecto' : 'Novo Prospecto'}</h2>
                <p className="text-blue-100 text-sm">Preencha os dados da clínica</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <ChevronDown className="rotate-180" size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Basic Info */}
                <div className="md:col-span-3">
                  <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User size={16} /> Informações Básicas
                  </h3>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Clínica</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    placeholder="Nome da clínica"
                    value={formData.clinicName}
                    onChange={(e) => setFormData({...formData, clinicName: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Responsável Tali</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    value={formData.responsible}
                    onChange={(e) => setFormData({...formData, responsible: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    <option value="Diogo">Diogo</option>
                    <option value="Helenilton">Helenilton</option>
                    <option value="Tali">Tali</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Cidade/Bairro - UF</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    placeholder="Ex: Águas Claras - DF"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  />
                </div>

                {/* Social Media & Links */}
                <div className="md:col-span-3 mt-4">
                  <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ExternalLink size={16} /> Links e Redes Sociais
                  </h3>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Instagram Clínica</label>
                  <input 
                    type="url" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    placeholder="https://..."
                    value={formData.clinicInstagram}
                    onChange={(e) => setFormData({...formData, clinicInstagram: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">GMN (Google Maps)</label>
                  <input 
                    type="url" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    placeholder="https://..."
                    value={formData.gmn}
                    onChange={(e) => setFormData({...formData, gmn: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Website</label>
                  <input 
                    type="url" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    placeholder="https://..."
                    value={formData.site}
                    onChange={(e) => setFormData({...formData, site: e.target.value})}
                  />
                </div>

                {/* Owner Info */}
                <div className="md:col-span-3 mt-4">
                  <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User size={16} /> Dados do Dono
                  </h3>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Nome do Dono</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    placeholder="Nome completo"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Instagram Dono</label>
                  <input 
                    type="url" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    placeholder="https://..."
                    value={formData.ownerInstagram}
                    onChange={(e) => setFormData({...formData, ownerInstagram: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Seguiu o dono?</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    value={formData.followedOwner}
                    onChange={(e) => setFormData({...formData, followedOwner: e.target.value as any})}
                  >
                    <option value="">Selecione...</option>
                    <option value="Sim">Sim</option>
                    <option value="Solicitado">Solicitado</option>
                    <option value="Não">Não</option>
                  </select>
                </div>

                {/* Status & Funnel */}
                <div className="md:col-span-3 mt-4">
                  <h3 className="text-sm font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Clock size={16} /> Funil e Status
                  </h3>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Status Atual</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
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

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Data 1º Contato</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    value={formData.firstContactDate}
                    onChange={(e) => setFormData({...formData, firstContactDate: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Semana</label>
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all"
                    value={formData.week}
                    onChange={(e) => setFormData({...formData, week: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    <option value="Semana 1">Semana 1</option>
                    <option value="Semana 2">Semana 2</option>
                    <option value="Semana 3">Semana 3</option>
                    <option value="Semana 4">Semana 4</option>
                  </select>
                </div>

                <div className="md:col-span-3 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Observações</label>
                  <textarea 
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-900 outline-none transition-all min-h-[100px]"
                    placeholder="Detalhes importantes sobre a clínica ou dono..."
                    value={formData.observations}
                    onChange={(e) => setFormData({...formData, observations: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-xl border border-gray-200 font-bold text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-10 py-3 rounded-xl bg-blue-900 text-white font-bold hover:bg-blue-800 transition-all shadow-lg active:scale-95"
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
