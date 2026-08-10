import React, { useState, useEffect } from 'react';
import { Wand2, Search, MapPin, Database, Zap, ArrowRight, Play, Loader2, Sparkles, Building2, Map, Crosshair, Check, Key, X, User, Target } from 'lucide-react';
import { addProspect, getGlobalSettings } from '../services/firestoreService';
import { enrichSingleLeadWithOutscraper } from '../services/outscraperEnrichment';

export const LeadGeneratorView: React.FC = () => {
  const [searchMode, setSearchMode] = useState<'niche' | 'specific'>('niche');
  const [isGenerating, setIsGenerating] = useState(false);

  // Campos para busca por nicho (em lote)
  const [searchTerm, setSearchTerm] = useState('Clínica Odontológica');
  const [location, setLocation] = useState('Valparaíso de Goiás, GO');
  const [radius, setRadius] = useState('');
  const [leadsToGenerate, setLeadsToGenerate] = useState('10');

  // Campos para busca por empresa específica
  const [specificName, setSpecificName] = useState('');
  const [specificAddress, setSpecificAddress] = useState('');

  // Responsável e Configs
  const [responsible, setResponsible] = useState('');
  const [outscraperKey, setOutscraperKey] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  // Modals
  const [successModal, setSuccessModal] = useState({ show: false, count: 0, companyName: '' });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });

  useEffect(() => {
    const fetchKey = async () => {
      const settings = await getGlobalSettings('gemini');
      if (settings?.outscraperKey) {
        setOutscraperKey(settings.outscraperKey);
      }
    };
    fetchKey();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const handleGenerate = async () => {
    if (!outscraperKey) {
      setErrorModal({ show: true, message: 'Chave da API do Outscraper não encontrada! Vá em Administração e configure a chave.' });
      return;
    }

    const isSpecific = searchMode === 'specific';

    if (isSpecific && !specificName.trim()) {
      setErrorModal({ show: true, message: 'Por favor, digite o nome da empresa ou clínica.' });
      return;
    }

    if (!isSpecific && (!searchTerm.trim() || !location.trim())) {
      setErrorModal({ show: true, message: 'Preencha o nicho e a localização para a busca.' });
      return;
    }

    setIsGenerating(true);
    setLogs([]);

    const query = isSpecific
      ? `${specificName.trim()} ${specificAddress.trim()}`.trim()
      : `${searchTerm.trim()} in ${location.trim()}`;

    const limit = isSpecific ? '1' : leadsToGenerate;
    const searchLocation = isSpecific ? (specificAddress.trim() || 'Brasil') : location.trim();

    addLog(isSpecific
      ? `Iniciando busca específica por "${specificName}"${specificAddress ? ` em "${specificAddress}"` : ''}...`
      : `Iniciando busca por "${searchTerm}" em "${location}"...`
    );

    try {
      addLog('Consultando Outscraper (localizando estabelecimento no Google Maps)...');

      const url = `https://api.app.outscraper.com/maps/search-v2?query=${encodeURIComponent(query)}&limit=${limit}&async=false`;

      const response = await fetch(url, {
        headers: {
          'X-API-KEY': outscraperKey
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !data.data.length || !data.data[0].length) {
        addLog('Nenhum local encontrado para esta busca.');
        setIsGenerating(false);
        return;
      }

      const places = data.data[0];
      addLog(`Encontrado${places.length > 1 ? 's' : ''} ${places.length} local(is). Enriquecendo dados via Outscraper + Receita e salvando no CRM...`);

      let savedCount = 0;
      let lastSavedName = '';

      for (const place of places) {
        let initialInsta = place.instagram || (place.social_media && place.social_media.find((s: string) => s.includes('instagram'))) || '';
        let initialOwner = place.owner_title || place.owner || '';
        let foundCnpj = '';
        const websiteUrl = place.site || place.website || '';
        const currentName = place.name || (isSpecific ? specificName : 'Sem Nome');
        lastSavedName = currentName;

        addLog(`Enriquecendo dados de "${currentName}" (CNPJ, Instagram, Sócios)...`);

        // Chamada do serviço de enriquecimento
        try {
          const enriched = await enrichSingleLeadWithOutscraper(currentName, searchLocation, websiteUrl);
          if (!initialInsta && enriched.clinicInstagram) initialInsta = enriched.clinicInstagram;
          if (!initialOwner && enriched.ownerName) initialOwner = enriched.ownerName;
          if (enriched.cnpj) foundCnpj = enriched.cnpj;
        } catch (e) {
          console.warn('Erro ao enriquecer lead:', e);
        }

        // Cadastra o prospect na Prospecção Online
        await addProspect({
          order: 0,
          responsible: responsible,
          location: place.full_address || searchLocation,
          clinicName: currentName,
          clinicInstagram: initialInsta,
          cnpj: foundCnpj,
          gmn: place.google_maps_url || (place.place_id ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}` : ''),
          gmnRating: place.rating ? String(place.rating) : '',
          gmnReviewsCount: place.reviews ? String(place.reviews) : '',
          site: websiteUrl,
          ownerName: initialOwner,
          ownerInstagram: '',
          size: '',
          age: '',
          status: 'VERIFICAR ICP', // Entra como novo lead na Prospecção Online
          hasAnswered: false,
          lastFollowUp: '',
          observations: `Telefone: ${place.phone || 'N/A'}\nEndereço: ${place.full_address || 'N/A'}\nModo de Busca: ${isSpecific ? 'Empresa Específica' : 'Busca em Lote'}`,
          firstContactDate: new Date().toISOString().split('T')[0],
          week: 'Semana 1',
          companyId: 'digital',
          currentStep: 1,
          fullAddress: place.full_address || '',
          lat: place.latitude || null,
          lng: place.longitude || null
        });
        savedCount++;
      }

      addLog(`Sucesso! ${savedCount} lead(s) salvo(s) na Prospecção Online.`);
      setSuccessModal({ show: true, count: savedCount, companyName: isSpecific ? lastSavedName : '' });
    } catch (error: any) {
      console.error(error);
      addLog(`Erro: ${error.message}`);
      setErrorModal({ show: true, message: `Ocorreu um erro: ${error.message}` });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-stone-50 h-full p-4 md:p-8 custom-scrollbar relative">
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-stone-200/50 to-transparent pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-200">
                <Wand2 size={24} className="text-[#5271FF]" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">Gerador Inteligente de Leads</h1>
            </div>
            <p className="text-stone-500 font-medium max-w-xl text-sm md:text-base">
              Busque empresas por nicho ou encontre uma clínica específica no Google Maps. Cruze CNPJ (ReceitaWS), Instagram e sócios para salvar na Prospecção Online.
            </p>
          </div>
        </div>

        {/* Formulário Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          <div className="col-span-1 lg:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-stone-200 shadow-sm">

              {/* Seletor de Modo de Busca (Abas) */}
              <div className="flex bg-stone-100 p-1.5 rounded-2xl mb-6 border border-stone-200/80">
                <button
                  type="button"
                  onClick={() => setSearchMode('niche')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    searchMode === 'niche'
                      ? 'bg-white text-[#5271FF] shadow-sm font-black'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-white/50'
                  }`}
                >
                  <Building2 size={16} />
                  Busca por Nicho (Lote)
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('specific')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    searchMode === 'specific'
                      ? 'bg-white text-[#5271FF] shadow-sm font-black'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-white/50'
                  }`}
                >
                  <Target size={16} />
                  Empresa Específica
                </button>
              </div>

              <h2 className="text-lg font-black text-stone-900 mb-6 flex items-center gap-2">
                {searchMode === 'niche' ? (
                  <>
                    <Search size={20} className="text-[#5271FF]" />
                    Configurar Busca em Lote
                  </>
                ) : (
                  <>
                    <Target size={20} className="text-[#5271FF]" />
                    Buscar Empresa Específica
                  </>
                )}
              </h2>

              <div className="space-y-5">
                {searchMode === 'niche' ? (
                  <>
                    {/* Campos para busca por Nicho */}
                    <div>
                      <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                        Nicho / Palavra-chave
                      </label>
                      <div className="relative">
                        <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]/20 focus:border-[#5271FF] transition-all font-bold text-stone-900"
                          placeholder="Ex: Clínica Odontológica, Escritório de Advocacia..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                        Localização (Cidade/Bairro)
                      </label>
                      <div className="relative">
                        <Map size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]/20 focus:border-[#5271FF] transition-all font-bold text-stone-900"
                          placeholder="Ex: Valparaíso de Goiás - GO"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                          Raio (km)
                        </label>
                        <div className="relative">
                          <Crosshair size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                          <input
                            type="number"
                            value={radius}
                            onChange={(e) => setRadius(e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]/20 focus:border-[#5271FF] transition-all font-bold text-stone-900"
                            placeholder="Ex: 5"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                          Máx. Leads
                        </label>
                        <div className="relative">
                          <Database size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                          <input
                            type="number"
                            value={leadsToGenerate}
                            onChange={(e) => setLeadsToGenerate(e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]/20 focus:border-[#5271FF] transition-all font-bold text-stone-900"
                            placeholder="Ex: 50"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Campos para busca de Empresa Específica */}
                    <div>
                      <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                        Nome da Clínica / Empresa
                      </label>
                      <div className="relative">
                        <Target size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5271FF]" />
                        <input
                          type="text"
                          value={specificName}
                          onChange={(e) => setSpecificName(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]/20 focus:border-[#5271FF] transition-all font-bold text-stone-900"
                          placeholder="Ex: OdontoCompany, Clínica Sorriso Dourado..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                        Endereço, Bairro ou Cidade (Recomendado)
                      </label>
                      <div className="relative">
                        <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type="text"
                          value={specificAddress}
                          onChange={(e) => setSpecificAddress(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]/20 focus:border-[#5271FF] transition-all font-bold text-stone-900"
                          placeholder="Ex: Bairro Jardim Roriz, Valparaíso de Goiás - GO"
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-stone-400 font-medium">
                        Adicionar o bairro ou a cidade ajuda a localizar com exatidão no Google Maps.
                      </p>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                    Líder Responsável
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                    <select
                      value={responsible}
                      onChange={(e) => setResponsible(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#5271FF]/20 focus:border-[#5271FF] transition-all font-bold text-stone-900 appearance-none cursor-pointer"
                    >
                      <option value="">Sem Líder (Deixar em aberto)</option>
                      <option value="Diogo">Diogo</option>
                      <option value="Helenilton">Helenilton</option>
                      <option value="Tali">Tali</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    !outscraperKey ||
                    (searchMode === 'niche' && (!searchTerm || !location)) ||
                    (searchMode === 'specific' && !specificName)
                  }
                  className="w-full mt-4 flex items-center justify-center gap-3 bg-[#5271FF] text-white py-4 px-6 rounded-2xl font-black shadow-lg shadow-[#5271FF]/30 hover:shadow-xl hover:shadow-[#5271FF]/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:transform-none"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Localizando e Enriquecendo Empresa...
                    </>
                  ) : (
                    <>
                      {searchMode === 'niche' ? <Zap size={20} /> : <Target size={20} />}
                      {searchMode === 'niche' ? 'Gerar Base de Leads' : 'Buscar e Cadastrar Empresa'}
                      <ArrowRight size={18} className="ml-1" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles size={64} className="text-[#5271FF]" />
              </div>

              <h3 className="text-sm font-black text-stone-900 uppercase tracking-widest mb-4">Fluxo Automático</h3>

              <ul className="space-y-4 relative z-10">
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-[#5271FF]/10 text-[#5271FF] flex items-center justify-center font-bold text-xs shrink-0">1</div>
                  <div>
                    <strong className="block text-stone-800 mb-0.5">Localização no Google Maps</strong>
                    <span className="text-stone-500 text-xs">Obtém local exato, avaliação, endereço e telefone da clínica.</span>
                  </div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-[#5271FF]/10 text-[#5271FF] flex items-center justify-center font-bold text-xs shrink-0">2</div>
                  <div>
                    <strong className="block text-stone-800 mb-0.5">Cruzamento de CNPJ e Sócios</strong>
                    <span className="text-stone-500 text-xs">Busca na ReceitaWS / Google para identificar a razão social e donos.</span>
                  </div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-[#5271FF]/10 text-[#5271FF] flex items-center justify-center font-bold text-xs shrink-0">3</div>
                  <div>
                    <strong className="block text-stone-800 mb-0.5">Captura de Instagram</strong>
                    <span className="text-stone-500 text-xs">Extrai o perfil social oficial no site ou no Google Maps.</span>
                  </div>
                </li>
                <li className="flex gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center font-bold text-xs shrink-0"><Check size={14} /></div>
                  <div>
                    <strong className="block text-stone-800 mb-0.5">Prospecção Online</strong>
                    <span className="text-stone-500 text-xs">O lead é salvo diretamente no Kanban pronto para ser abordado.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Terminal de Logs */}
            <div className="bg-[#0C1122] p-6 rounded-[2rem] border border-stone-200/60 shadow-inner overflow-hidden flex flex-col">
              <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-3">Terminal</h3>
              <div className="space-y-2 text-xs font-mono text-green-400 min-h-12 max-h-40 overflow-y-auto custom-scrollbar">
                {logs.length > 0 ? logs.map((log, index) => (
                  <div key={index}>&gt; {log}</div>
                )) : (
                  <div className="text-white/35">&gt; Aguardando o início da busca...</div>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* SUCCESS MODAL */}
      {successModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSuccessModal({ show: false, count: 0, companyName: '' })}
              className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <Check size={32} />
            </div>

            <h3 className="text-xl font-black text-center text-stone-900 mb-2">
              {successModal.companyName ? 'Empresa Cadastrada!' : 'Leads Gerados!'}
            </h3>
            <p className="text-stone-500 text-center mb-8 text-sm">
              {successModal.companyName ? (
                <>
                  <strong className="text-stone-800">{successModal.companyName}</strong> foi localizada, enriquecida com dados e salva na Prospecção Online.
                </>
              ) : (
                <>
                  Foram importados <strong className="text-stone-800">{successModal.count} leads</strong> com sucesso. Vá para a aba "Prospecção online" para visualizá-los.
                </>
              )}
            </p>

            <button
              onClick={() => setSuccessModal({ show: false, count: 0, companyName: '' })}
              className="w-full bg-stone-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ERROR MODAL */}
      {errorModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setErrorModal({ show: false, message: '' })}
              className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <X size={32} />
            </div>

            <h3 className="text-xl font-black text-center text-stone-900 mb-2">
              Ops, algo deu errado
            </h3>
            <p className="text-stone-500 text-center mb-8 text-sm">
              {errorModal.message}
            </p>

            <button
              onClick={() => setErrorModal({ show: false, message: '' })}
              className="w-full bg-stone-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

