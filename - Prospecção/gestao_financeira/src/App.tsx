import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Settings, Bell, Menu, ChevronLeft, ChevronRight, User, LogIn, DollarSign, FileText, BarChart, Eye, EyeOff, Shield } from 'lucide-react';
import ContasPagar from './pages/ContasPagar';
import ContasReceber from './pages/ContasReceber';
import FluxoCaixa from './pages/FluxoCaixa';
import HistoricoPagamentos from './pages/HistoricoPagamentos';
import RelatoriosFinanceiros from './pages/RelatoriosFinanceiros';
import GestaoContratos from './pages/GestaoContratos';
import Equipe from './pages/Equipe';
import SettingsPage from './pages/Settings';
// import UsersManagement from './pages/UsersManagement';
import MyProfile from './pages/MyProfile';
import { AuthProvider, useAuth } from './context/AuthContext';

import logo from './assets/logo.png';

import { ChevronDown, ChevronUp } from 'lucide-react';

function Sidebar({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen, user }: any) {
  const location = useLocation();
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'financeiro': true,
    'configuracoes': false
  });
  
  const toggleFolder = (folderKey: string) => {
    setOpenFolders(prev => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };
  
  const navItems = [
    { path: '/painel', label: 'Relatórios Financeiros', icon: <BarChart className="nav-item-icon" style={{ color: '#f59e0b' }} /> },
    { path: '/painel/gestao-contratos', label: 'Gestão de Contratos', icon: <FileText className="nav-item-icon" style={{ color: '#0ea5e9' }} />, roles: ['admin', 'financeiro'] },
    { 
      id: 'financeiro',
      label: 'Financeiro', 
      icon: <DollarSign className="nav-item-icon" style={{ color: '#10b981' }} />, 
      roles: ['admin', 'financeiro'],
      children: [
        { path: '/painel/financeiro/contas-pagar', label: 'Contas a Pagar' },
        { path: '/painel/financeiro/contas-receber', label: 'Contas a Receber' },
        { path: '/painel/financeiro/fluxo-caixa', label: 'Fluxo de Caixa' },
        { path: '/painel/financeiro/historico-pagamentos', label: 'Histórico de Pagamentos' }
      ]
    },
    { 
      id: 'configuracoes',
      label: 'Configurações', 
      icon: <Settings className="nav-item-icon" style={{ color: '#64748b' }} />, 
      roles: ['admin'],
      children: [
        { path: '/painel/equipe', label: 'Equipe e Usuários' },
        { path: '/painel/configuracoes', label: 'Aparência e Dados' }
      ]
    },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isMobileOpen ? 'mobile-open' : ''}`} onClick={() => setIsMobileOpen(false)}></div>
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <button 
          className="sidebar-toggle-btn desktop-only" 
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className="sidebar-header" style={{ position: 'relative' }}>
          <a href="https://ruthdiasimoveis.com.br/site" style={{ display: 'block', width: '100%', textAlign: 'center' }}>
            <img src={logo} alt="Ruth Dias" className="sidebar-logo" style={{ filter: 'brightness(0) invert(1)' }} />
          </a>
        </div>
        <nav className="sidebar-nav">
          {navItems.filter(item => {
            const r = user?.role || 'financeiro';
            const isAdmin = r === 'admin' || r === 'Sócio CFO' || r === 'CEO';
            return !item.roles || item.roles.includes(r) || (isAdmin && item.roles.includes('admin'));
          }).map((item) => {
            if (item.children) {
              const isOpen = openFolders[item.id] && !isCollapsed;
              const hasActiveChild = item.children.some(child => location.pathname === child.path || (location.pathname.startsWith(child.path) && child.path !== '/painel'));
              
              return (
                <div key={item.id} className={`nav-folder ${isOpen ? 'open' : ''}`}>
                  <button 
                    className={`nav-item nav-folder-btn ${hasActiveChild && !isOpen ? 'active-folder' : ''}`}
                    onClick={() => {
                      if (isCollapsed) setIsCollapsed(false);
                      toggleFolder(item.id);
                    }}
                    title={isCollapsed ? item.label : ''}
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', outline: 'none' }}
                  >
                    {item.icon}
                    <span className="nav-item-text">{item.label}</span>
                    {!isCollapsed && (
                      <div style={{ marginLeft: 'auto' }}>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </button>
                  
                  {isOpen && !isCollapsed && (
                    <div className="nav-folder-content" style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                      {item.children.map(child => (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`nav-item nav-child-item ${location.pathname === child.path || (location.pathname.startsWith(child.path) && child.path !== '/painel') ? 'active' : ''}`}
                          onClick={() => setIsMobileOpen(false)}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '4px' }}
                        >
                          <span className="nav-item-text">{child.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path!}
                className={`nav-item ${location.pathname.startsWith(item.path!) && item.path !== '/painel' || location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.label : ''}
              >
                {item.icon}
                <span className="nav-item-text">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function AdminHeader({ setIsMobileOpen }: { setIsMobileOpen: (v: boolean) => void }) {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="top-header glass">
      <div className="header-left">
        <button className="mobile-menu-btn" onClick={() => setIsMobileOpen(true)}>
          <Menu size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-color)' }}>Gestão & Finanças</h2>
      </div>
      <div className="header-actions">

        <button className="btn btn-ghost" style={{ padding: '0.5rem' }}>
          <Bell className="nav-item-icon" />
        </button>
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowDropdown(!showDropdown)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}
          >
            {user?.photoUrl ? (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--primary-color)', transition: 'transform 0.2s', transform: showDropdown ? 'scale(1.05)' : 'scale(1)' }}>
                <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--primary-color)', transition: 'transform 0.2s', transform: showDropdown ? 'scale(1.05)' : 'scale(1)' }}>
                <User size={24} />
              </div>
            )}
            <div className="mobile-hidden" style={{ fontWeight: '600', fontSize: '0.9rem', color: '#334155' }}>
              {user?.name?.split(' ')[0] || 'Usuário'}
            </div>
          </div>
          
          {showDropdown && (
            <>
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} 
                onClick={() => setShowDropdown(false)}
              ></div>
              <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '0.5rem', backgroundColor: 'white', padding: '0.5rem 0', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', width: '220px', zIndex: 100, overflow: 'hidden' }}>
                <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '0.2rem' }}>{user?.name || 'Visitante'}</div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', textTransform: 'capitalize' }}>Perfil: {user?.role || 'Usuário'}</div>
                </div>
                
                <Link 
                  to="/painel/perfil" 
                  onClick={() => setShowDropdown(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1rem', color: '#475569', textDecoration: 'none', fontWeight: '500', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <User size={18} /> Meu Perfil
                </Link>
                
                <button 
                  onClick={() => { setShowDropdown(false); logout(); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1rem', color: '#ef4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '500', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <LogIn size={18} /> Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function AdminLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, login, loginWithGoogle, resetPassword, logout, originalUser, stopImpersonating } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleResetPassword = async () => {
    if (!emailInput) {
      Swal.fire('Atenção', 'Por favor, preencha seu e-mail primeiro para recuperar a senha.', 'warning');
      return;
    }
    try {
      // @ts-ignore
      if (resetPassword) {
        await resetPassword(emailInput);
      } else {
        throw new Error('Função de reset não disponível.');
      }
      Swal.fire({
        icon: 'success',
        title: 'E-mail Enviado!',
        text: 'E-mail de recuperação enviado! Verifique sua caixa de entrada e também a pasta de spam (lixo eletrônico).',
        confirmButtonColor: '#0f172a'
      });
    } catch (err: any) {
      Swal.fire('Erro', err.message || 'Não foi possível conectar ao servidor de e-mails.', 'error');
    }
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f9fafb' }}>
        <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <img src={logo} alt="Logo" style={{ height: '60px', marginBottom: '1rem', filter: 'brightness(0)' }} />
          <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Gestão & Finanças</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' }}>Acesso restrito e seguro.</p>
          <input 
            type="email" 
            placeholder="Seu E-mail" 
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            style={{ width: '100%', padding: '0.8rem', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '1rem', outline: 'none' }}
          />
          <div style={{ position: 'relative', width: '100%', marginBottom: '1.5rem' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Sua Senha" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ width: '100%', padding: '0.8rem', paddingRight: '2.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
            <button 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div style={{ textAlign: 'right', marginTop: '-1rem', marginBottom: '1.5rem' }}>
            <button type="button" onClick={handleResetPassword} style={{ background: 'none', border: 'none', color: '#0f172a', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}>
              Esqueci minha senha
            </button>
          </div>
          <button 
            onClick={async () => { try { await login(emailInput, passwordInput); } catch(e:any) { Swal.fire('Erro no login', e.message, 'error'); } }}
            style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem' }}
          >
            Entrar no Sistema Seguro
          </button>
          <button 
            onClick={async () => { try { await loginWithGoogle(); } catch(e:any) { Swal.fire('Erro', e.message, 'error'); } }}
            style={{ width: '100%', padding: '0.8rem', backgroundColor: '#ffffff', color: '#333', border: '1px solid #ddd', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{width: 20, height: 20}} />
            Entrar com o Google
          </button>
        </div>
      </div>
    );
  }

  if (user && !['admin', 'Sócio CFO', 'CEO', 'financeiro'].includes(user.role)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f9fafb' }}>
        <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
          <Shield size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
          <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Acesso Restrito</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Esta área é exclusiva para a gestão financeira e administrativa. Seu perfil ({user.role}) não possui permissão para acessar esta página.
          </p>
          <a 
            href="https://ruthdiasimoveis.com.br/painel"
            style={{ display: 'inline-block', width: '100%', padding: '0.8rem', backgroundColor: '#5c1b33', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}
          >
            Ir para o Sistema Principal
          </a>
          <button onClick={logout} style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}>
            Sair desta conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {originalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, backgroundColor: '#f59e0b', color: 'white', padding: '0.5rem', textAlign: 'center', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <span>Você está visualizando o sistema como {user?.name} ({user?.role}).</span>
          <button onClick={stopImpersonating} style={{ backgroundColor: 'white', color: '#f59e0b', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Voltar para {originalUser.name}
          </button>
        </div>
      )}
      <Sidebar 
        isCollapsed={isCollapsed} 
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        user={user}
      />
      <main className="main-content">
        <AdminHeader setIsMobileOpen={setIsMobileOpen} />
        <div className="page-wrapper">
          <Routes>
            <Route path="/" element={<RelatoriosFinanceiros />} />
            <Route path="/financeiro/contas-pagar" element={<ContasPagar />} />
            <Route path="/financeiro/contas-receber" element={<ContasReceber />} />
            <Route path="/financeiro/fluxo-caixa" element={<FluxoCaixa />} />
            <Route path="/financeiro/historico-pagamentos" element={<HistoricoPagamentos />} />
            <Route path="/gestao-contratos" element={<GestaoContratos />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/usuarios" element={<Navigate to="/painel/equipe" replace />} />
            <Route path="/perfil" element={<MyProfile />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
}


function App() {
  useState(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    }
  });

  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Navigate to="/painel" replace />} />
          <Route path="/painel/*" element={<AdminLayout />} />
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
