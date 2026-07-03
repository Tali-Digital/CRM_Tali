import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1a1e2b',
      color: 'white',
      padding: '1.5rem 2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      zIndex: 99999,
      boxShadow: '0 -4px 10px rgba(0,0,0,0.2)',
      alignItems: 'center'
    }}>
      <div style={{ maxWidth: '1200px', display: 'flex', flexDirection: 'row', gap: '2rem', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: '#e2e8f0', flex: 1 }}>
          Utilizamos cookies essenciais e tecnologias semelhantes de acordo com a nossa{' '}
          <Link to="/politica-privacidade" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Política de Privacidade</Link>, 
          ao continuar navegando, você concorda com estas condições.
        </p>
        <button 
          onClick={handleAccept} 
          style={{
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            padding: '0.8rem 2rem',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Aceitar e Fechar
        </button>
      </div>
    </div>
  );
}
