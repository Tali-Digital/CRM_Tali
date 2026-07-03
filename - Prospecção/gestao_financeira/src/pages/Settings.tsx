import { useState, useEffect } from 'react';
import { Shield, MessageSquare, Moon, Sun, Trash2, Download, Upload, RefreshCw, AlertTriangle, Cloud, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

const Settings = () => {
  // Aparência
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  const [toastMessage, setToastMessage] = useState('');
  const [isBackingUpDrive, setIsBackingUpDrive] = useState(false);

  // Aplica o tema dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleClearImoveis = async () => {
    const { value: password } = await Swal.fire({
      title: 'Área Restrita',
      text: 'Digite a senha de administrador para limpar o banco de dados:',
      input: 'password',
      inputPlaceholder: 'Senha',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Acessar e Limpar',
      cancelButtonText: 'Cancelar'
    });

    if (password !== '120516') {
      if (password) Swal.fire('Acesso Negado', 'Senha incorreta.', 'error');
      return;
    }

    Swal.fire({
      title: 'Limpar Banco de Dados?',
      text: 'Tem certeza que deseja apagar TODOS os imóveis importados da Caixa do seu banco de dados local?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, apagar tudo',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Limpa no localStorage
        const saved = localStorage.getItem('ruth_dias_properties');
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.db = {}; // Esvazia o DB
          const dataString = JSON.stringify(parsed);
          localStorage.setItem('ruth_dias_properties', dataString);
          
          // Tenta limpar na API PHP
          fetch('/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'ruth_dias_properties', value: dataString })
          }).catch(console.error);
        }
        showToast('Banco de imóveis Caixa esvaziado.');
        Swal.fire('Esvaziado!', 'O banco de imóveis foi limpo com sucesso.', 'success');
      }
    });
  };

  const handleClearGeoCache = () => {
    Swal.fire({
      title: 'Limpar Cache de Mapa?',
      text: 'Deseja limpar o cache local de geolocalização dos imóveis? Isso fará com que o sistema recupere as coordenadas exatas novamente na aba do mapa.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, limpar cache',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('ruth_dias_geo_cache');
        showToast('Cache de geolocalização limpo.');
        Swal.fire('Limpo!', 'O cache do mapa foi limpo.', 'success');
      }
    });
  };

  const handleExportBackup = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ruth_dias_')) {
        data[key] = localStorage.getItem(key);
      }
      if (key === 'theme') {
        data[key] = localStorage.getItem(key);
      }
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sistema_ruth_dias_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup exportado com sucesso!');
  };

  const handleBackupDrive = async () => {
    setIsBackingUpDrive(true);
    try {
      const res = await fetch('/backup_drive.php', { method: 'POST' });
      const text = await res.text();
      try {
        const result = JSON.parse(text);
        if (result.status === 'success') {
          Swal.fire('Backup Concluído', result.message, 'success');
        } else {
          Swal.fire('Erro no Backup', result.message + (result.details ? '\n\nDetalhes: ' + result.details : ''), 'error');
        }
      } catch (e) {
        console.error("Resposta não-JSON do backup_drive.php:", text);
        Swal.fire('Erro no Backup', 'A resposta do servidor foi inválida. Tente novamente mais tarde.', 'error');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Erro no Backup', 'Falha ao conectar com o servidor.', 'error');
    } finally {
      setIsBackingUpDrive(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        
        let importedCount = 0;
        for (const [key, value] of Object.entries(data)) {
          if (key.startsWith('ruth_dias_') || key === 'theme') {
            localStorage.setItem(key, value as string);
            importedCount++;
            
            if (key.startsWith('ruth_dias_')) {
              fetch('/api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
              }).catch(console.error);
            }
          }
        }

        if (importedCount > 0) {
          showToast('Backup importado com sucesso! Recarregando sistema...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          Swal.fire('Erro', 'Arquivo de backup inválido.', 'error');
        }
      } catch (err) {
        Swal.fire('Erro', 'Erro ao processar o arquivo de backup. Verifique se o arquivo JSON está correto.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Aparência e Dados</h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Gerencie a aparência e ferramentas avançadas de banco de dados do sistema.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Seção 1: Preferências Visuais */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Shield size={20} style={{ color: 'var(--accent-color)' }} />
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Aparência do Sistema</h2>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>Modo Escuro (Dark Mode)</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Altera as cores de fundo do sistema para tons escuros e elegantes.</div>
            </div>
            <button 
              className="btn btn-outline" 
              onClick={() => setDarkMode(!darkMode)}
              style={{ width: '48px', height: '48px', padding: 0, borderRadius: '50%' }}
            >
              {darkMode ? <Sun size={20} style={{ color: '#eab308' }} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {/* Seção 2: Gerenciamento de Dados */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <MessageSquare size={20} style={{ color: 'var(--accent-color)' }} />
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Dados e Ferramentas</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Backup e Restauração */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>Backup das Configurações e Imóveis</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Exporte todos os seus dados para o Google Drive ou para segurança local.</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn" 
                  style={{ fontSize: '0.85rem', backgroundColor: '#4285F4', color: 'white', borderColor: '#4285F4' }} 
                  onClick={handleBackupDrive}
                  disabled={isBackingUpDrive}
                >
                  {isBackingUpDrive ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />} 
                  {isBackingUpDrive ? 'Salvando no Drive...' : 'Salvar no Google Drive'}
                </button>
                <button className="btn btn-outline" style={{ fontSize: '0.85rem' }} onClick={handleExportBackup}>
                  <Download size={16} /> Exportar Local
                </button>
                <label className="btn btn-outline" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  <Upload size={16} /> Importar Local
                  <input 
                    type="file" 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    onChange={handleImportBackup} 
                  />
                </label>
              </div>
            </div>

            {/* Manutenção de Banco */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={18} /> Zona de Perigo: Manutenção
                </div>
                <div style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: '0.2rem' }}>Ações destrutivas. É exigida a senha mestre para limpar os imóveis da base.</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-outline" style={{ fontSize: '0.85rem', color: '#b91c1c', borderColor: '#fca5a5', backgroundColor: 'white' }} onClick={handleClearGeoCache}>
                  <RefreshCw size={16} /> Recalcular Geo
                </button>
                <button className="btn btn-outline" style={{ fontSize: '0.85rem', color: 'white', backgroundColor: '#dc2626', borderColor: '#dc2626' }} onClick={handleClearImoveis}>
                  <Trash2 size={16} /> Limpar Imóveis
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Toast de Feedback */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.75rem 1.5rem',
          borderRadius: '99px', fontSize: '0.9rem', fontWeight: 500, zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default Settings;
