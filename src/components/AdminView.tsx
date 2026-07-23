import React, { useState, useEffect } from 'react';
import { Lock, Key, AlertTriangle, Save, Database, Users, Trash2, Activity } from 'lucide-react';
import { UserProfile } from '../types';
import { getGlobalSettings, updateGlobalSettings } from '../services/firestoreService';

export const AdminView: React.FC<{ userProfile?: UserProfile }> = ({ userProfile }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [outscraperKey, setOutscraperKey] = useState('');
  const [localFalconKey, setLocalFalconKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getGlobalSettings('gemini');
      if (settings) {
        if (settings.key) setGeminiKey(settings.key);
        if (settings.outscraperKey) setOutscraperKey(settings.outscraperKey);
        if (settings.localFalconKey) setLocalFalconKey(settings.localFalconKey);
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
      localFalconKey
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
      <div className="p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center border border-red-500/30">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-heading">Administração</h1>
            <p className="text-white/60">Gerenciamento de configurações sensíveis e chaves de API.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configurações de API */}
          <div className="bg-[#0C1122] rounded-3xl p-6 border border-white/10 relative overflow-hidden group flex flex-col h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-50" />
            
            <div className="flex items-center gap-3 mb-6">
              <Key className="text-blue-400" />
              <h2 className="text-xl font-bold">Chave da API do Gemini</h2>
            </div>
            
            <p className="text-white/60 text-sm mb-6 flex-1">
              Esta chave é utilizada para gerar as análises de IA e sugestões de mensagens. Certifique-se de usar uma chave válida do Google AI Studio.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white/80 mb-2">
                  API Key Atual
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
                <div className="mt-4 bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl flex items-center justify-center gap-2">
                  <span>Chaves salvas com sucesso!</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-[#0C1122] rounded-3xl p-6 border border-white/10 relative overflow-hidden group flex flex-col h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#5271FF] to-[#38bdf8] opacity-50" />
            
            <div className="flex items-center gap-3 mb-6">
              <Database className="text-[#5271FF]" />
              <h2 className="text-xl font-bold">Chaves de Integração (Gerador de Leads)</h2>
            </div>
            
            <p className="text-white/60 text-sm mb-6 flex-1">
              Insira abaixo as chaves necessárias para as integrações de prospecção digital (Outscraper, Local Falcon, etc).
            </p>

            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-white/80 mb-2">
                    API Key Outscraper (Google Maps)
                  </label>
                  <input
                    type="password"
                    value={outscraperKey}
                    onChange={(e) => setOutscraperKey(e.target.value)}
                    placeholder="Cole sua API Key do Outscraper"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5271FF] transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-white/40 mt-1">Usada no Gerador Inteligente de Leads.</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-white/80 mb-2">
                    API Key Local Falcon (Análise de SEO)
                  </label>
                  <input
                    type="password"
                    value={localFalconKey}
                    onChange={(e) => setLocalFalconKey(e.target.value)}
                    placeholder="Cole sua API Key do Local Falcon"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5271FF] transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-white/40 mt-1">Usada na etapa de verificação de ICP para gerar raio-X.</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-white/40">
                  Estas chaves ficam salvas junto com a configuração global.
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
                <div className="mt-2 bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl flex items-center justify-center gap-2">
                  <span>Chaves salvas com sucesso!</span>
                </div>
              )}
            </div>
          </div>
        </div>

          {/* Sugestões de Ferramentas Administrativas */}
          <div className="bg-[#0C1122] rounded-3xl p-6 border border-white/10 mt-8">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="text-orange-400" />
              <h2 className="text-xl font-bold">Zona de Perigo & Ferramentas</h2>
            </div>

            <p className="text-white/60 text-sm mb-6">
              Ações avançadas de gerenciamento do sistema. (Algumas ferramentas podem estar em desenvolvimento).
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                <div className="flex items-center gap-3 w-full">
                  <div className="p-2 bg-yellow-500/20 rounded-lg group-hover:bg-yellow-500/30 transition-colors shrink-0">
                    <Key className="text-yellow-400 w-5 h-5" />
                  </div>
                  <div className="flex-1 w-full opacity-50 cursor-not-allowed">
                    <h3 className="font-bold text-sm text-yellow-400 mb-1">Acesso Mestre via Firebase Auth</h3>
                    <p className="text-xs text-white/40">O acesso agora é validado pelo nível de permissão da conta do usuário.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Database className="text-purple-400 w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Backup de Dados</h3>
                    <p className="text-xs text-white/40">Exportar todos os cards e configurações para JSON.</p>
                  </div>
                </div>
                <button disabled className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg text-white/40">Em breve</button>
              </div>

              <div className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="text-blue-400 w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Permissões Globais</h3>
                    <p className="text-xs text-white/40">Gerenciar níveis de acesso de todos os usuários.</p>
                  </div>
                </div>
                <button disabled className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg text-white/40">Em breve</button>
              </div>

              <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors">
                    <Trash2 className="text-red-400 w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-red-400">Limpar Cache Local</h3>
                    <p className="text-xs text-red-400/60">Remove preferências salvas e reseta a UI.</p>
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
    </div>
  );
};
