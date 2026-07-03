import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, LogIn, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ClientLoginModal from './ClientLoginModal';
import logo from '../assets/logo.png';

export default function PublicHeader() {
  const { user, logout } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleNav = (filter?: any) => {
    setIsMobileMenuOpen(false);
    if (filter) {
      navigate('/site-busca', { state: filter });
    } else {
      navigate('/site-busca');
    }
  };

  return (
    <>
    <header style={{ backgroundColor: '#5c1b33', color: 'white', position: 'relative', zIndex: 50 }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/site" style={{ zIndex: 60 }}>
          <img src={logo} alt="Ruth Dias Logo" width="168" height="60" fetchPriority="high" style={{ height: '60px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
        </Link>

        {/* Desktop Nav */}
        <nav className="desktop-nav" style={{ display: 'flex', gap: '1.5rem', fontSize: '1rem', fontWeight: '500' }}>
          <button onClick={() => handleNav()} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>Imóveis</button>
          <button onClick={() => handleNav({ finalidade: 'Venda' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>Venda</button>
          <button onClick={() => handleNav({ finalidade: 'Aluguel' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>Aluguel</button>
          <button onClick={() => handleNav({ tipo: 'Apartamento' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>Apartamento</button>
          <button onClick={() => handleNav({ tipo: 'Casa' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', fontWeight: '500', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>Casa</button>
          <Link to="/contato" style={{ color: 'white', textDecoration: 'none', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>Contato</Link>
        </nav>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'white', fontWeight: 'bold' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Heart size={20} fill={user.favorites && user.favorites.length > 0 ? 'white' : 'none'} /> <span className="mobile-hidden">{user.favorites?.length || 0}</span>
                </span>
                <span className="mobile-hidden" style={{ fontSize: '0.9rem' }}>Olá, {user.name?.split(' ')[0] || ''}</span>
                <Link to="/painel" className="btn-painel" style={{ color: '#005ca9', backgroundColor: 'white', padding: '0.5rem 1rem', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>Painel</Link>
                <button onClick={logout} className="btn-sair" style={{ background: 'none', border: 'none', color: '#ffb3c6', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>Sair</button>
              </div>
            ) : (
              <button onClick={() => setIsLoginModalOpen(true)} style={{ color: '#005ca9', backgroundColor: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogIn size={16} /> <span className="mobile-hidden">Entrar / Favoritos</span>
              </button>
            )}
          </div>

          {/* Mobile Toggle */}
          <button className="mobile-nav-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ background: 'none', border: 'none', color: 'white', zIndex: 60, cursor: 'pointer', display: 'none' }}>
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-nav-menu animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#5c1b33', padding: '1rem 2rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', fontSize: '1.1rem', fontWeight: '500' }}>
            <button onClick={() => handleNav()} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '500', textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Imóveis</button>
            <button onClick={() => handleNav({ finalidade: 'Venda' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '500', textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Venda</button>
            <button onClick={() => handleNav({ finalidade: 'Aluguel' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '500', textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Aluguel</button>
            <button onClick={() => handleNav({ tipo: 'Apartamento' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '500', textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Apartamento</button>
            <button onClick={() => handleNav({ tipo: 'Casa' })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', fontWeight: '500', textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Casa</button>
            <Link to="/contato" onClick={() => setIsMobileMenuOpen(false)} style={{ color: 'white', textDecoration: 'none', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Contato</Link>
          </nav>
        </div>
      )}
    </header>
    <ClientLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </>
  );
}
