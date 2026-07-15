import { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, FileText, CheckCircle, Clock, Settings, Bot, Copy, Layers, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import GeradorProspeccao from './GeradorProspeccao';
import GerenciadorModelosModal from './GerenciadorModelosModal';



import { subscribeToProspeccaoDocs, deleteProspeccaoDoc, addProspeccaoDoc, updateProspeccaoDoc, updateProspect } from '../services/firestoreService';
import { EditorProspeccaoDoc } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function GestaoProspeccaoEditor() {
  const [prospeccoes, setProspeccoes] = useState<EditorProspeccaoDoc[]>([]);
  
  const getSavedFilter = (key: string, defaultValue: any) => {
    try {
      const uid = auth?.currentUser?.uid || 'guest';
      const saved = localStorage.getItem(`gestao_filters_${uid}_${key}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return defaultValue;
  };

  const [searchTerm, setSearchTerm] = useState<string>(() => getSavedFilter('searchTerm', ''));

  const [isGeradorOpen, setIsGeradorOpen] = useState(false);
  const [isGerenciadorOpen, setIsGerenciadorOpen] = useState(false);
  const [editingEditorProspeccaoDoc, setEditingEditorProspeccaoDoc] = useState<EditorProspeccaoDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EditorProspeccaoDoc | null>(null);
  const [prospectsMap, setProspectsMap] = useState<Record<string, { responsible: string; ownerName: string; clinicName: string; }>>({});
  const [responsibleFilter, setResponsibleFilter] = useState<string>(() => getSavedFilter('responsibleFilter', ''));
  const [periodType, setPeriodType] = useState<string>(() => getSavedFilter('periodType', 'all'));
  const [startDate, setStartDate] = useState<string>(() => getSavedFilter('startDate', ''));
  const [activeTab, setActiveTab] = useState<'ativos' | 'lixeira'>('ativos');
  const [endDate, setEndDate] = useState<string>(() => getSavedFilter('endDate', ''));
  const [statusFilter, setStatusFilter] = useState<string>(() => getSavedFilter('statusFilter', ''));

  useEffect(() => {
    const uid = auth?.currentUser?.uid || 'guest';
    localStorage.setItem(`gestao_filters_${uid}_searchTerm`, JSON.stringify(searchTerm));
    localStorage.setItem(`gestao_filters_${uid}_responsibleFilter`, JSON.stringify(responsibleFilter));
    localStorage.setItem(`gestao_filters_${uid}_periodType`, JSON.stringify(periodType));
    localStorage.setItem(`gestao_filters_${uid}_startDate`, JSON.stringify(startDate));
    localStorage.setItem(`gestao_filters_${uid}_endDate`, JSON.stringify(endDate));
    localStorage.setItem(`gestao_filters_${uid}_statusFilter`, JSON.stringify(statusFilter));
  }, [searchTerm, responsibleFilter, periodType, startDate, endDate, statusFilter]);

  useEffect(() => {
    const unsubscribe = subscribeToProspeccaoDocs(docs => setProspeccoes(docs));
    
    const unsubscribeProspects = onSnapshot(collection(db, 'prospects'), (snapshot) => {
      const map: Record<string, { responsible: string; ownerName: string; clinicName: string; }> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        map[doc.id] = {
          responsible: data.responsible || '',
          ownerName: data.ownerName || '',
          clinicName: data.clinicName || ''
        };
      });
      setProspectsMap(map);
    });

    return () => {
      unsubscribe();
      unsubscribeProspects();
    };
  }, []);

  const uniqueResponsibles = Array.from(new Set(Object.values(prospectsMap).map((p: any) => p.responsible).filter(Boolean))).sort() as string[];

  const handleOpenGerador = (prospeccao?: EditorProspeccaoDoc) => {
    if (prospeccao) {
      setEditingEditorProspeccaoDoc(prospeccao);
    } else {
      setEditingEditorProspeccaoDoc(null);
    }
    setIsGeradorOpen(true);
  };



  const handleDelete = async () => {
    if (confirmDelete) {
      if (activeTab === 'lixeira') {
        await deleteProspeccaoDoc(confirmDelete.id);
        if (confirmDelete.clienteId) {
          await updateProspect(confirmDelete.clienteId, { isInPerson: false });
        }
      } else {
        await updateProspeccaoDoc(confirmDelete.id, { isDeleted: true });
        if (confirmDelete.clienteId) {
          await updateProspect(confirmDelete.clienteId, { hasPresencialFicha: false });
        }
      }
      setConfirmDelete(null);
    }
  };

  const handleRestore = async (prospeccao: EditorProspeccaoDoc) => {
    await updateProspeccaoDoc(prospeccao.id, { isDeleted: false });
    if (prospeccao.clienteId) {
      await updateProspect(prospeccao.clienteId, { hasPresencialFicha: true });
    }
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Restaurado!', showConfirmButton: false, timer: 1500 });
  };
  
  const handleEmptyTrash = async () => {
    if (window.confirm('Deseja apagar TOTALMENTE todas as prospecções da lixeira? Esta ação não pode ser desfeita.')) {
      const deletedDocs = prospeccoes.filter(c => c.isDeleted === true);
      for (const doc of deletedDocs) {
        await deleteProspeccaoDoc(doc.id);
        if (doc.clienteId) {
          await updateProspect(doc.clienteId, { isInPerson: false });
        }
      }
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Lixeira Esvaziada', showConfirmButton: false, timer: 1500 });
    }
  };

  const handleDuplicate = async (prospeccao: EditorProspeccaoDoc) => {
    try {
      const copy = { ...prospeccao };
      delete (copy as any).id;
      if (copy.titulo) copy.titulo += ' (Cópia)';
      if (copy.clienteNome) copy.clienteNome += ' (Cópia)';
      copy.isEntregue = false;
      copy.dataAssinatura = new Date().toISOString();
      
      await addProspeccaoDoc(copy as any);
      Swal.fire({ icon: 'success', title: 'Prospecção Duplicada!', timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Erro ao duplicar', text: error.message });
    }
  };



  const getMasterPassword = async () => {
    const savedData = sessionStorage.getItem('master_pass_auth');
    if (savedData) {
      const auth = JSON.parse(savedData);
      if (Date.now() - auth.timestamp < 10800000) {
        return auth.password;
      } else {
        sessionStorage.removeItem('master_pass_auth');
      }
    }

    const { value: password } = await Swal.fire({
      title: 'Acesso Restrito',
      text: 'Insira a senha do sistema para visualizar o prospeccao:',
      input: 'password',
      inputPlaceholder: 'Senha mestre',
      showCancelButton: true,
      confirmButtonText: 'Acessar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#10b981',
      showLoaderOnConfirm: true,
      preConfirm: async (pass) => {
        try {
          const fd = new FormData();
          fd.append('pass', pass);
          const response = await fetch('/api_documentos.php?action=verify_password', {
            method: 'POST',
            body: fd
          });
          const data = await response.json();
          if (!data.success) {
            Swal.showValidationMessage('Senha incorreta.');
          }
          return pass;
        } catch (error) {
          Swal.showValidationMessage('Erro ao verificar senha.');
        }
      },
      allowOutsideClick: () => !Swal.isLoading()
    });

    if (password) {
      sessionStorage.setItem('master_pass_auth', JSON.stringify({ password, timestamp: Date.now() }));
      return password;
    }
    return null;
  };

  const viewContract = async (prospeccao: EditorProspeccaoDoc) => {
    const password = await getMasterPassword();
    if (password) {
      if (prospeccao.link) {
        let url = prospeccao.link;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        window.open(url, '_blank');
      } else if (prospeccao.documentoId) {
        const url = `/api_documentos.php?action=view&file_id=${prospeccao.documentoId}&pass=${password}`;
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(prospeccao.documentoNome || '');
        if (isImage) {
          Swal.fire({
            title: prospeccao.documentoNome || 'Prospecção',
            imageUrl: url,
            imageAlt: 'Prospecção Assinada',
            width: '80%',
            showConfirmButton: false,
            showCloseButton: true
          });
        } else {
          window.open(url, '_blank');
        }
      }
    }
  };

  const countAtivos = prospeccoes.filter(c => c.isDeleted !== true).length;
  const countLixeira = prospeccoes.filter(c => c.isDeleted === true).length;

  const filteredProspeccoes = prospeccoes
    .filter(c => {
      if (activeTab === 'ativos') return c.isDeleted !== true;
      return c.isDeleted === true;
    })
    .filter(c => {
      const clienteNome = c.clienteNome || (c.clienteId && prospectsMap[c.clienteId]?.ownerName) || '';
      const titulo = c.titulo || (c.clienteId && prospectsMap[c.clienteId]?.clinicName) || '';
      return clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) || titulo.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .filter(c => {
      if (!responsibleFilter) return true;
      const resp = c.clienteId ? prospectsMap[c.clienteId]?.responsible : null;
      return resp === responsibleFilter;
    })
    .filter(c => {
      if (periodType === 'all') return true;
      const cDateStr = c.dataAssinatura ? c.dataAssinatura.substring(0, 10) : '';
      if (!cDateStr) return false;

      const parts = cDateStr.split('-');
      if (parts.length !== 3) return false;
      
      const cYear = parseInt(parts[0], 10);
      const cMonth = parseInt(parts[1], 10);

      const today = new Date();
      const tYear = today.getFullYear();
      const tMonth = today.getMonth() + 1;

      if (periodType === 'this_month') {
        return cYear === tYear && cMonth === tMonth;
      }
      if (periodType === 'last_month') {
        const lYear = tMonth === 1 ? tYear - 1 : tYear;
        const lMonth = tMonth === 1 ? 12 : tMonth - 1;
        return cYear === lYear && cMonth === lMonth;
      }
      if (periodType === 'this_year') {
        return cYear === tYear;
      }
      if (periodType === 'custom') {
        if (startDate && cDateStr < startDate) return false;
        if (endDate && cDateStr > endDate) return false;
        return true;
      }

      return true;
    })
    .filter(c => {
      if (!statusFilter) return true;
      if (statusFilter === 'entregue') return c.isEntregue === true;
      if (statusFilter === 'pendente') return !c.isEntregue;
      return true;
    });

  return (
    <div className="p-4 sm:p-8 bg-slate-50 h-full overflow-y-auto custom-scrollbar">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 sm:gap-4 mb-6">
        <div className="flex bg-[#1e3a8a]/5 p-1 rounded-xl w-fit gap-1 shadow-inner border border-[#1e3a8a]/10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button 
            onClick={() => setActiveTab('ativos')}
            className={`flex items-center justify-center px-3 sm:px-4 gap-2 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeTab === 'ativos' ? 'bg-white shadow-sm text-[#1e3a8a] border border-[#1e3a8a]/10' : 'text-[#1e3a8a]/60 hover:text-[#1e3a8a]'}`}
          >
            <Layers size={14} />
            Prospecções Ativas ({countAtivos})
          </button>
          <button 
            onClick={() => setActiveTab('lixeira')}
            className={`flex items-center justify-center px-3 sm:px-4 gap-2 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeTab === 'lixeira' ? 'bg-red-500 shadow-sm shadow-red-500/20 text-white' : 'text-[#1e3a8a]/60 hover:text-red-500'}`}
          >
            <Trash2 size={14} />
            Lixeira ({countLixeira})
          </button>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto items-center">
          <button onClick={() => setIsGerenciadorOpen(true)} className="flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-slate-200 text-slate-700 px-2 sm:px-4 py-2.5 rounded-lg font-semibold transition-all hover:bg-slate-50 shadow-sm text-[11px] sm:text-sm text-center">
            <Settings size={14} className="shrink-0" /> <span className="truncate">Modelos</span>
          </button>
          <button onClick={() => setIsGeradorOpen(true)} className="flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-600 text-white border-none px-2 sm:px-4 py-2.5 rounded-lg font-semibold transition-all hover:bg-blue-700 shadow-sm text-[11px] sm:text-sm text-center">
            <Plus size={14} className="shrink-0" /> <span className="truncate">Nova Prospecção</span>
          </button>
        </div>
      </div>

      {activeTab === 'lixeira' && (
        <div className="mb-4">
          <button 
            onClick={handleEmptyTrash}
            className="flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-lg transition-all text-red-500 border border-red-200 hover:bg-red-50"
          >
            <Trash2 size={14} />
            Esvaziar Lixeira
          </button>
        </div>
      )}

      <div className="bg-white p-3 sm:p-6 rounded-xl shadow-sm mb-6 border border-slate-200">
        <div className="grid grid-cols-2 sm:flex sm:flex-row flex-wrap gap-2 sm:gap-4 items-center">
          <div className="col-span-2 sm:flex-1 sm:max-w-[400px] relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por Clínica ou cliente..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="col-span-1 sm:w-auto relative">
            <select
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
              className="w-full sm:min-w-[150px] pl-3 pr-8 py-2 rounded-lg border border-slate-200 outline-none bg-white appearance-none text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Líder: Todos</option>
              {uniqueResponsibles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          
          <div className="col-span-1 sm:w-auto relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:min-w-[150px] pl-3 pr-8 py-2 rounded-lg border border-slate-200 outline-none bg-white appearance-none text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Status: Todos</option>
              <option value="entregue">Entregues</option>
              <option value="pendente">Não Entregues</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-1 sm:w-auto flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="w-full sm:w-auto pl-3 pr-8 py-2 rounded-lg border border-slate-200 outline-none bg-white appearance-none text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Período: Qualquer</option>
              <option value="this_month">Este Mês</option>
              <option value="last_month">Mês Passado</option>
              <option value="this_year">Este Ano</option>
              <option value="custom">Personalizado</option>
            </select>
            {periodType === 'custom' && (
              <div className="flex gap-2 w-full sm:w-auto items-center mt-2 sm:mt-0">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 sm:w-[140px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  title="Data Inicial"
                />
                <span className="text-slate-500 text-sm">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 sm:w-[140px] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  title="Data Final"
                />
              </div>
            )}
          </div>
          
          <div className="col-span-1 flex items-center justify-start sm:w-auto">
            {(periodType !== 'all' || startDate || endDate || statusFilter || responsibleFilter || searchTerm) && (
              <button 
                onClick={() => { setPeriodType('all'); setStartDate(''); setEndDate(''); setStatusFilter(''); setResponsibleFilter(''); setSearchTerm(''); }} 
                className="text-xs sm:text-sm text-slate-500 underline hover:text-slate-700 py-1"
              >
                Limpar Filtros
              </button>
            )}
          </div>
          
          <div className="col-span-1 flex items-center justify-end sm:w-auto sm:ml-auto">
            <div className="text-xs sm:text-sm text-slate-500 font-medium bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md border border-slate-200 text-center whitespace-nowrap">
              Exibindo {filteredProspeccoes.length} {filteredProspeccoes.length === 1 ? 'ficha' : 'fichas'}
            </div>
          </div>
        </div>
      </div>

        {/* MOBILE VIEW (CARDS) */}
        <div className="flex flex-col gap-3 sm:hidden mb-4">
          {filteredProspeccoes.map(prospeccao => (
             <div key={prospeccao.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3 relative" onClick={() => handleOpenGerador(prospeccao)}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-base leading-tight truncate">
                      {prospeccao.titulo || (prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.clinicName) || 'Prospecção'}
                    </h3>
                    <p className="text-slate-500 text-sm mt-0.5 truncate">
                      {prospeccao.clienteNome || (prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.ownerName)}
                    </p>
                  </div>
                  {prospeccao.isEntregue && (
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap shrink-0 mt-0.5">
                      ENTREGUE
                    </span>
                  )}
                </div>
                
                <div className="flex justify-between items-center text-sm border-t border-slate-100 pt-3">
                  <div className="flex flex-col gap-1 min-w-0 flex-1 pr-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Responsável</span>
                    {prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.responsible ? (
                      <span className="text-slate-700 font-medium truncate">
                        {prospectsMap[prospeccao.clienteId].responsible}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Sem Líder</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0 pl-2 border-l border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Data</span>
                    <span className="text-slate-700 font-medium">
                      {(() => { try { return new Date(prospeccao.dataAssinatura).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } catch { return '—'; } })()}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 mt-1">
                    {activeTab === 'lixeira' ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleRestore(prospeccao) }} title="Restaurar" className="p-2 text-green-600 hover:bg-green-50 rounded"><RefreshCw size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(prospeccao) }} title="Excluir Permanentemente" className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); if(prospeccao.documentoId || prospeccao.link) viewContract(prospeccao) }} title="Ver Prospecção" className={`p-2 rounded ${prospeccao.documentoId || prospeccao.link ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-300'}`} disabled={!(prospeccao.documentoId || prospeccao.link)}><FileText size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDuplicate(prospeccao) }} title="Duplicar" className="p-2 text-green-600 hover:bg-green-50 rounded"><Copy size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenGerador(prospeccao) }} title="Editar" className="p-2 text-slate-500 hover:bg-slate-100 rounded"><Edit2 size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(prospeccao) }} title="Mover para Lixeira" className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                      </>
                    )}
                </div>
             </div>
          ))}
          {filteredProspeccoes.length === 0 && (
            <div className="text-center p-8 text-slate-500 bg-white rounded-lg border border-slate-200">Nenhuma prospecção encontrada.</div>
          )}
        </div>

        {/* DESKTOP VIEW (TABLE) */}
        <div className="hidden sm:block overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="p-4 font-semibold">Clínica</th>
                <th className="p-4 font-semibold">Cliente</th>
                <th className="p-4 font-semibold">Responsável</th>
                <th className="p-4 font-semibold">Data da Prospecção</th>
                <th className="p-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProspeccoes.map(prospeccao => (
                <tr key={prospeccao.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => handleOpenGerador(prospeccao)}>
                  <td className="p-4">
                    <div className="font-semibold text-slate-800">
                      {prospeccao.titulo || (prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.clinicName) || 'Prospecção'}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-slate-600">
                    {prospeccao.clienteNome || (prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.ownerName)}
                  </td>
                  <td className="p-4">
                    {prospeccao.clienteId && prospectsMap[prospeccao.clienteId]?.responsible ? (
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md text-sm text-slate-700 font-medium">
                        {prospectsMap[prospeccao.clienteId].responsible}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-sm">Sem Líder</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap font-medium text-slate-700">
                        {(() => { try { return new Date(prospeccao.dataAssinatura).toLocaleDateString('pt-BR', { timeZone: 'UTC' }); } catch { return '—'; } })()}
                      </span>
                      {prospeccao.isEntregue && (
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-bold">
                          ENTREGUE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex gap-2 justify-center">
                      {activeTab === 'lixeira' ? (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); handleRestore(prospeccao) }} title="Restaurar" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><RefreshCw size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(prospeccao) }} title="Excluir Permanentemente" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); if(prospeccao.documentoId || prospeccao.link) viewContract(prospeccao) }} title="Ver Prospecção" className={`p-1.5 rounded ${prospeccao.documentoId || prospeccao.link ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-300'}`} disabled={!(prospeccao.documentoId || prospeccao.link)}><FileText size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDuplicate(prospeccao) }} title="Duplicar" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Copy size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleOpenGerador(prospeccao) }} title="Editar" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"><Edit2 size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(prospeccao) }} title="Mover para Lixeira" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProspeccoes.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Nenhuma prospecção encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#1e293b' }}>Confirmar Exclusão</h3>
            <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
              Tem certeza que deseja {activeTab === 'lixeira' ? 'excluir PERMANENTEMENTE' : 'mover para a lixeira'} a prospecção com <strong>{confirmDelete.clienteNome}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {isGeradorOpen && (
        <GeradorProspeccao 
          onClose={() => { setIsGeradorOpen(false); setEditingEditorProspeccaoDoc(null); }} 
          prospeccaoParaEditar={editingEditorProspeccaoDoc}
          onSaveProspeccao={async (prospeccao) => {
            try {
              const sanitizedData: any = Object.fromEntries(
                Object.entries(prospeccao).filter(([_, v]) => v !== undefined)
              );

              if (editingEditorProspeccaoDoc) {
                await updateProspeccaoDoc(editingEditorProspeccaoDoc.id, sanitizedData);
                if (editingEditorProspeccaoDoc.clienteId && (sanitizedData.location || sanitizedData.fullAddress)) {
                  await updateProspect(editingEditorProspeccaoDoc.clienteId, {
                    location: sanitizedData.location || '',
                    fullAddress: sanitizedData.fullAddress || '',
                    geocodeFailed: false // Forçar recálculo no mapa
                  });
                }
              } else {
                await addProspeccaoDoc(sanitizedData as any);
              }
            } catch (e: any) {
              console.error("Erro ao salvar prospeccao:", e);
              Swal.fire({ icon: 'error', title: 'Erro ao Salvar', text: e.message || String(e) });
              return;
            }
            
            setIsGeradorOpen(false);
            setEditingEditorProspeccaoDoc(null);
          }}
        />
      )}

      {isGerenciadorOpen && (
        <GerenciadorModelosModal onClose={() => setIsGerenciadorOpen(false)} />
      )}
      <style>{`
        .prospeccao-row-hover:hover {
          background-color: #f8fafc;
        }
      `}</style>
    </div>
  );
}
