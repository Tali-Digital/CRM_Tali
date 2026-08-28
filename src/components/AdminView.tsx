import React, { useState, useEffect } from 'react';
import { Lock, Key, AlertTriangle, Save, Database, Users, Trash2, Activity, CheckCircle2, XCircle, Loader2, Wifi } from 'lucide-react';
import { UserProfile } from '../types';
import { getGlobalSettings, updateGlobalSettings } from '../services/firestoreService';
import Swal from 'sweetalert2';
import { checkLocalFalconStatus, runLocalFalconScan } from '../services/localFalconService';

export const AdminView: React.FC<{ userProfile?: UserProfile }> = ({ userProfile }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [outscraperKey, setOutscraperKey] = useState('');
  const [localFalconKey, setLocalFalconKey] = useState('');
  const [localFalconGridSize, setLocalFalconGridSize] = useState<'3x3' | '5x5' | '7x7'>('5x5');
  const [pageSpeedKey, setPageSpeedKey] = useState('');
  const [metaAdsKey, setMetaAdsKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [falconTesting, setFalconTesting] = useState(false);
  const [falconTestResult, setFalconTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [testClinicName, setTestClinicName] = useState('');
  const [testKeyword, setTestKeyword] = useState('');
  const [testCity, setTestCity] = useState('');
  const [runningDiagTest, setRunningDiagTest] = useState(false);
  const [diagTestResult, setDiagTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [outscraperTesting, setOutscraperTesting] = useState(false);
  const [outscraperTestResult, setOutscraperTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [pageSpeedTesting, setPageSpeedTesting] = useState(false);
  const [pageSpeedTestResult, setPageSpeedTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [metaAdsTesting, setMetaAdsTesting] = useState(false);
  const [metaAdsTestResult, setMetaAdsTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTestDiagnosticScan = async () => {
    if (!testClinicName.trim() || !testKeyword.trim()) {
      setDiagTestResult({ ok: false, message: 'Informe o nome da clínica e a palavra-chave para testar.' });
      return;
    }
    setRunningDiagTest(true);
    setDiagTestResult(null);
    try {
      const res = await runLocalFalconScan({
        locationName: testClinicName.trim(),
        keyword: testKeyword.trim(),
        cityName: testCity.trim() || undefined,
        forceNewScan: true,
        onConfirmNameMismatch: async (foundName, requestedName) => {
          const result = await Swal.fire({
            icon: 'warning',
            title: '⚠️ Empresa Divergente Detectada',
            html: `A empresa encontrada no Local Falcon foi <b>"${foundName}"</b>, que é diferente da clínica solicitada <b>"${requestedName}"</b>.<br/><br/>Deseja realmente prosseguir e aprovar a realização desta varredura?`,
            showCancelButton: true,
            confirmButtonText: 'Sim, aprovar e realizar scan',
            cancelButtonText: 'Não, cancelar scan',
            confirmButtonColor: '#0f172a',
            cancelButtonColor: '#e11d48'
          });
          return result.isConfirmed;
        }
      });

      if (res.success) {
        setDiagTestResult({
          ok: true,
          message: `✅ Diagnóstico concluído com sucesso! SoLV: ${res.solv}%, Posição: #${res.clientRank ?? 'N/A'}`
        });
      } else {
        setDiagTestResult({
          ok: false,
          message: `❌ ${res.error || 'Falha na execução do diagnóstico.'}`
        });
      }
    } catch (e: any) {
      setDiagTestResult({
        ok: false,
        message: `❌ Erro de execução: ${e.message}`
      });
    } finally {
      setRunningDiagTest(false);
    }
  };

  const handleTestLocalFalcon = async () => {
    if (!localFalconKey.trim()) {
      setFalconTestResult({ ok: false, message: 'Cole a API Key antes de testar.' });
      return;
    }
    setFalconTesting(true);
    setFalconTestResult(null);
    try {
      const result = await checkLocalFalconStatus(localFalconKey.trim());
      if (result.configured && !result.error) {
        setFalconTestResult({ ok: true, message: `✅ Conectado com sucesso! Créditos disponíveis: ${result.credits ?? '0'}` });
      } else {
        setFalconTestResult({ ok: false, message: `❌ Falha na conexão: ${result.error || 'Verifique a chave de API'}` });
      }
    } catch (e: any) {
      setFalconTestResult({ ok: false, message: `❌ Erro de conexão: ${e.message}` });
    } finally {
      setFalconTesting(false);
    }
  };

  const handleTestOutscraper = async () => {
    if (!outscraperKey.trim()) {
      setOutscraperTestResult({ ok: false, message: 'Cole a API Key antes de testar.' });
      return;
    }
    setOutscraperTesting(true);
    setOutscraperTestResult(null);
    try {
      const res = await fetch('https://api.app.outscraper.com/user/profile', {
        headers: { 'X-API-KEY': outscraperKey.trim() }
      }).catch(async () => {
        return await fetch('https://api.app.outscraper.com/maps/search-v2?query=test&limit=1&async=false', {
          headers: { 'X-API-KEY': outscraperKey.trim() }
        });
      });

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        const credits = data?.credits !== undefined ? data.credits : (data?.balance !== undefined ? data.balance : null);
        const creditsMsg = credits !== null ? ` (Créditos/Saldo: ${credits})` : '';
        setOutscraperTestResult({ ok: true, message: `✅ Conectado com sucesso ao Outscraper!${creditsMsg}` });
      } else {
        const errText = res ? await res.text().catch(() => '') : '';
        let errorMsg = 'Verifique a chave informada.';
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (res?.status === 401 || res?.status === 403) errorMsg = 'API Key inválida ou expirada.';
        }
        setOutscraperTestResult({ ok: false, message: `❌ Falha na conexão (${res?.status || 'Erro'}): ${errorMsg}` });
      }
    } catch (e: any) {
      setOutscraperTestResult({ ok: false, message: `❌ Erro de conexão: ${e.message}` });
    } finally {
      setOutscraperTesting(false);
    }
  };

  const handleTestPageSpeed = async () => {
    if (!pageSpeedKey.trim()) {
      setPageSpeedTestResult({ ok: false, message: 'Cole a API Key antes de testar.' });
      return;
    }
    setPageSpeedTesting(true);
    setPageSpeedTestResult(null);
    try {
      const directUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://google.com&category=PERFORMANCE&key=${encodeURIComponent(pageSpeedKey.trim())}`;
      const proxyUrl = `/api-proxy/pagespeed/pagespeedonline/v5/runPagespeed?url=https://google.com&category=PERFORMANCE&key=${encodeURIComponent(pageSpeedKey.trim())}`;

      let res = await fetch(directUrl).catch(async () => await fetch(proxyUrl));

      if (res && res.ok) {
        setPageSpeedTestResult({ ok: true, message: `✅ Conectado com sucesso à API Google PageSpeed Insights!` });
      } else {
        const errText = res ? await res.text().catch(() => '') : '';
        let errorMsg = 'Chave inválida ou cota excedida.';
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.error?.message || errorMsg;
        } catch {}
        setPageSpeedTestResult({ ok: false, message: `❌ Falha na conexão (${res?.status || 'Erro'}): ${errorMsg}` });
      }
    } catch (e: any) {
      setPageSpeedTestResult({ ok: false, message: `❌ Erro de conexão: ${e.message}` });
    } finally {
      setPageSpeedTesting(false);
    }
  };

  const handleTestMetaAds = async () => {
    if (!metaAdsKey.trim()) {
      setMetaAdsTestResult({ ok: false, message: 'Cole o Access Token / Key antes de testar.' });
      return;
    }
    setMetaAdsTesting(true);
    setMetaAdsTestResult(null);
    try {
      const url = `https://graph.facebook.com/v19.0/ads_archive?search_terms=Google&ad_reached_countries=['BR']&active_status=ACTIVE&limit=1&access_token=${encodeURIComponent(metaAdsKey.trim())}`;
      const res = await fetch(url).catch(() => null);

      if (res && res.ok) {
        setMetaAdsTestResult({ ok: true, message: `✅ Conectado com sucesso! Token válido na Meta Ad Library.` });
      } else {
        const errText = res ? await res.text().catch(() => '') : '';
        let errorMsg = 'Access Token inválido ou expirado.';
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.error?.message || errorMsg;
        } catch {}
        setMetaAdsTestResult({ ok: false, message: `❌ Falha na conexão (${res?.status || 'Erro'}): ${errorMsg}` });
      }
    } catch (e: any) {
      setMetaAdsTestResult({ ok: false, message: `❌ Erro de conexão: ${e.message}` });
    } finally {
      setMetaAdsTesting(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getGlobalSettings('gemini');
      if (settings) {
        if (settings.key) setGeminiKey(settings.key);
        if (settings.outscraperKey) setOutscraperKey(settings.outscraperKey);
        if (settings.localFalconKey) setLocalFalconKey(settings.localFalconKey);
        if (settings.localFalconGridSize) setLocalFalconGridSize(settings.localFalconGridSize);
        if (settings.pageSpeedKey) setPageSpeedKey(settings.pageSpeedKey);
        if (settings.metaAdsKey) setMetaAdsKey(settings.metaAdsKey);
      }
      setIsLoading(false);
    };
    if (userProfile?.role === 'admin') {
      loadSettings();
    } else {
      setIsLoading(false);
    }
  }, [userProfile]);

  const handleSaveKey = async () => {
    await updateGlobalSettings('gemini', {
      key: geminiKey,
      outscraperKey,
      localFalconKey,
      localFalconGridSize,
      pageSpeedKey,
      metaAdsKey
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  if (isLoading) {
    return <div className="flex-1 h-screen bg-[#060B19] text-white flex items-center justify-center">Carregando...</div>;
  }

  if (userProfile?.role !== 'admin') {
    return (
      <div className="flex-1 h-screen bg-[#060B19] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0C1122] rounded-3xl p-8 border border-red-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-red-600 to-red-500" />
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold font-heading mb-2 text-red-400">Acesso Negado</h2>
            <p className="text-white/60 text-sm">
              Esta é uma zona de administração sensível. Apenas usuários com privilégios de Administrador podem acessar esta área.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen bg-[#060B19] text-white overflow-y-auto custom-scrollbar">
      <div className="p-8 pb-28">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center border border-red-500/30">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading">Administração</h1>
            <p className="text-white/60">Gerenciamento de configurações sensíveis e chaves de API.</p>
          </div>
        </div>

        {/* Linha Superior: Gemini (Esquerda) + Zona de Perigo (Direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Chave Gemini */}
          <div className="bg-[#0C1122] rounded-3xl p-6 border border-white/10 relative overflow-hidden group flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-50" />

            <div>
              <div className="flex items-center gap-3 mb-4">
                <Key className="text-blue-400" />
                <h2 className="text-xl font-bold">Chave da API do Gemini</h2>
              </div>

              <p className="text-white/60 text-sm mb-6">
                Esta chave é utilizada para gerar as análises de IA e sugestões de mensagens. Certifique-se de usar uma chave válida do Google AI Studio.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">
                  API Key Atual (Google AI Studio)
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  Salvo de forma segura no banco de dados (Apenas admins).
                </p>
                <button
                  onClick={handleSaveKey}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
                >
                  <Save className="w-4 h-4" />
                  Salvar Chaves
                </button>
              </div>

              {saveSuccess && (
                <div className="mt-2 bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl flex items-center justify-center gap-2">
                  <span>Chaves salvas com sucesso!</span>
                </div>
              )}
            </div>
          </div>

          {/* Zona de Perigo */}
          <div className="bg-[#0C1122] rounded-3xl p-6 border border-white/10 relative overflow-hidden group flex flex-col justify-between">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500 opacity-50" />
            <div>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-orange-400" />
                <h2 className="text-xl font-bold">Zona de Perigo & Ferramentas</h2>
              </div>

              <p className="text-white/60 text-sm mb-4">
                Ações avançadas de gerenciamento do sistema.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between gap-4 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg shrink-0">
                    <Key className="text-yellow-400 w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-yellow-400">Acesso Mestre via Firebase Auth</h3>
                    <p className="text-[11px] text-white/40">Validado pelo nível de permissão do usuário.</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between gap-4 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg shrink-0">
                    <Database className="text-purple-400 w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs">Backup de Dados</h3>
                    <p className="text-[11px] text-white/40">Exportar cards e configurações para JSON.</p>
                  </div>
                </div>
                <button disabled className="text-[11px] font-bold bg-white/10 px-2.5 py-1 rounded text-white/40">Em breve</button>
              </div>

              <div className="p-3.5 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 transition-colors flex items-center justify-between gap-4 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors shrink-0">
                    <Trash2 className="text-red-400 w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-red-400">Limpar Cache Local</h3>
                    <p className="text-[11px] text-red-400/60">Remove preferências salvas e reseta a UI.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if(window.confirm('Tem certeza? Isso pode deslogar sua sessão ou limpar preferências visuais.')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="text-xs font-bold bg-red-500/20 hover:bg-red-500/40 px-3 py-1.5 rounded-lg text-red-400 transition-colors"
                >
                  Executar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Linha Inferior: Chaves de Integração */}
        <div className="bg-[#0C1122] rounded-3xl p-6 border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#5271FF] via-purple-500 to-[#38bdf8] opacity-50" />

          <div className="flex items-center gap-3 mb-4">
            <Database className="text-[#5271FF]" />
            <h2 className="text-xl font-bold">Chaves de Integração (Auditoria e Diagnóstico)</h2>
          </div>

          <p className="text-white/60 text-sm mb-6">
            Insira abaixo as chaves para alimentarmos os relatórios com dados 100% reais de Maps, SEO, Ads e Velocidade.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Outscraper */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
              <div>
                <label className="block text-sm font-bold text-white/80 mb-1">
                  API Key Outscraper (Google Maps & Ads)
                </label>
                <input
                  type="password"
                  value={outscraperKey}
                  onChange={(e) => { setOutscraperKey(e.target.value); setOutscraperTestResult(null); }}
                  placeholder="Cole sua API Key do Outscraper"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#5271FF] transition-all font-mono text-sm"
                />
                <p className="text-xs text-white/40 mt-1">Gerador de Leads e buscas no Google Maps.</p>
              </div>

              <button
                onClick={handleTestOutscraper}
                disabled={outscraperTesting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer"
              >
                {outscraperTesting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</>
                  : <><Wifi className="w-4 h-4" /> Testar Conexão</>}
              </button>

              {outscraperTestResult && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium ${
                  outscraperTestResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {outscraperTestResult.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{outscraperTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Google PageSpeed Insights */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
              <div>
                <label className="block text-sm font-bold text-white/80 mb-1">
                  API Key Google PageSpeed Insights (Velocidade & SEO)
                </label>
                <input
                  type="password"
                  value={pageSpeedKey}
                  onChange={(e) => { setPageSpeedKey(e.target.value); setPageSpeedTestResult(null); }}
                  placeholder="Cole sua API Key do PageSpeed Insights"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#5271FF] transition-all font-mono text-sm"
                />
                <p className="text-xs text-white/40 mt-1">Auditoria real de velocidade de site e métricas de SEO.</p>
              </div>

              <button
                onClick={handleTestPageSpeed}
                disabled={pageSpeedTesting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer"
              >
                {pageSpeedTesting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</>
                  : <><Wifi className="w-4 h-4" /> Testar Conexão</>}
              </button>

              {pageSpeedTestResult && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium ${
                  pageSpeedTestResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {pageSpeedTestResult.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{pageSpeedTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Meta Ad Library */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
              <div>
                <label className="block text-sm font-bold text-white/80 mb-1">
                  API Key Meta Ad Library / Access Token (Anúncios Meta)
                </label>
                <input
                  type="password"
                  value={metaAdsKey}
                  onChange={(e) => { setMetaAdsKey(e.target.value); setMetaAdsTestResult(null); }}
                  placeholder="Cole seu Token / Key da Meta Ads Library"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#5271FF] transition-all font-mono text-sm"
                />
                <p className="text-xs text-white/40 mt-1">Detecção de anúncios ativos no Instagram e Facebook.</p>
              </div>

              <button
                onClick={handleTestMetaAds}
                disabled={metaAdsTesting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer"
              >
                {metaAdsTesting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</>
                  : <><Wifi className="w-4 h-4" /> Testar Conexão</>}
              </button>

              {metaAdsTestResult && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium ${
                  metaAdsTestResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {metaAdsTestResult.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{metaAdsTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Local Falcon */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-4">
              <div>
                <label className="block text-sm font-bold text-white/80 mb-1">
                  API Key Local Falcon (Análise de SEO Local Grid)
                </label>
                <input
                  type="password"
                  value={localFalconKey}
                  onChange={(e) => { setLocalFalconKey(e.target.value); setFalconTestResult(null); }}
                  placeholder="Cole sua API Key do Local Falcon (opcional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#5271FF] transition-all font-mono text-sm"
                />
                <p className="text-xs text-white/40 mt-1">Raio-X de presença regional em matriz de pontos.</p>
              </div>

              {/* Botão de Teste */}
              <button
                onClick={handleTestLocalFalcon}
                disabled={falconTesting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer"
              >
                {falconTesting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</>
                  : <><Wifi className="w-4 h-4" /> Testar Conexão</>}
              </button>

              {/* Resultado do Teste de Conexão */}
              {falconTestResult && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium ${
                  falconTestResult.ok
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}>
                  {falconTestResult.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{falconTestResult.message}</span>
                </div>
              )}

              {/* Painel de Validação e Teste de Diagnóstico */}
              <div className="pt-3 border-t border-white/10 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Testar Diagnóstico & Validação de Empresa Divergente
                </label>
                <p className="text-[11px] text-white/50">
                  Compara o nome solicitado com a empresa retornada pelo Local Falcon e solicita sua aprovação se forem diferentes.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={testClinicName}
                    onChange={(e) => setTestClinicName(e.target.value)}
                    placeholder="Nome da Clínica (ex: Odontomax)"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={testKeyword}
                    onChange={(e) => setTestKeyword(e.target.value)}
                    placeholder="Palavra-chave (ex: dentista)"
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <input
                  type="text"
                  value={testCity}
                  onChange={(e) => setTestCity(e.target.value)}
                  placeholder="Cidade/Estado (opcional, ex: Brasília, DF)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                />

                <button
                  type="button"
                  onClick={handleTestDiagnosticScan}
                  disabled={runningDiagTest}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  {runningDiagTest ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verificando e Executando Diagnóstico...</>
                  ) : (
                    <><Activity className="w-4 h-4" /> Executar Diagnóstico de Teste</>
                  )}
                </button>

                {diagTestResult && (
                  <div className={`p-2.5 rounded-xl text-xs font-medium ${
                    diagTestResult.ok
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                  }`}>
                    {diagTestResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/40">
              Salvas globalmente no banco de dados.
            </p>
            <button
              onClick={handleSaveKey}
              className="flex items-center gap-2 bg-[#5271FF] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
            >
              <Save className="w-4 h-4" />
              Salvar Chaves
            </button>
          </div>

          {saveSuccess && (
            <div className="mt-4 bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl flex items-center justify-center gap-2">
              <span>Chaves salvas com sucesso!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
