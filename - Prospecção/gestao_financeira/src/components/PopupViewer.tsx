import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import type { PopupConfig } from '../pages/PopupManager';
import { initialPopupsData } from '../data/initialData';

const PopupViewer = () => {
  const location = useLocation();
  const [activePopup, setActivePopup] = useState<PopupConfig | null>(null);
  const [closedPopups, setClosedPopups] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Busca os popups ativos
    let popups: PopupConfig[] = [];
    fetch('/api.php?key=ruth_dias_popups')
      .then(res => res.text())
      .then(text => {
        if (!text || text.trim().startsWith('<')) throw new Error('API não rodando PHP');
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        popups = parsed || [];
        checkPopups(popups);
      })
      .catch(() => {
        const local = localStorage.getItem('ruth_dias_popups');
        if (local) {
          try {
            let parsed = JSON.parse(local);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            popups = parsed || [];
          } catch (e) {
            console.error(e);
          }
        }
        
        if (popups.length === 0) {
          popups = initialPopupsData as PopupConfig[];
        }
        checkPopups(popups);
      });
  }, [location.pathname]); // Reavalia quando muda de página

  const checkPopups = (popups: PopupConfig[]) => {
    if (activePopup) return; // Se já tem um popup na tela, não abre outro por cima
    
    // Ignora páginas do painel administrativo
    if (location.pathname.startsWith('/painel')) return;

    const validPopups = popups.filter(p => p.active && !closedPopups.has(p.id));
    if (validPopups.length === 0) return;

    // Filtra pelo targetPage
    const matchingPopup = validPopups.find(p => p.targetPage === 'all' || p.targetPage === location.pathname);
    
    if (matchingPopup) {
      if (matchingPopup.triggerType === 'onload') {
        setActivePopup(matchingPopup);
      } else if (matchingPopup.triggerType === 'delay') {
        const timer = setTimeout(() => {
          setActivePopup(matchingPopup);
        }, (matchingPopup.triggerDelay || 3) * 1000);
        return () => clearTimeout(timer);
      } else if (matchingPopup.triggerType === 'exit') {
        const onMouseLeave = (e: MouseEvent) => {
          if (e.clientY <= 0) { // Mouse subiu acima da viewport (indício de saída)
            setActivePopup(matchingPopup);
            document.removeEventListener('mouseleave', onMouseLeave);
          }
        };
        document.addEventListener('mouseleave', onMouseLeave);
        return () => document.removeEventListener('mouseleave', onMouseLeave);
      }
    }
  };

  const handleClose = () => {
    if (activePopup) {
      setClosedPopups(prev => new Set(prev).add(activePopup.id));
      setActivePopup(null);
    }
  };

  if (!activePopup) return null;

  // Helper function to format YouTube URLs to embed URLs
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = new URL(url).searchParams.get('v');
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    return url;
  };

  return (
    <div 
      onClick={handleClose}
      style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', backdropFilter: 'blur(4px)'
    }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className="card animate-fade-in" 
        style={{ 
          width: '100%', maxWidth: activePopup.size === 'large' ? '900px' : '500px', padding: 0, overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)', position: 'relative',
          display: 'flex', flexDirection: 'column'
        }}
      >
        <button 
          onClick={handleClose}
          style={{ 
            position: 'absolute', top: '10px', right: '10px', zIndex: 10,
            background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none',
            borderRadius: '50%', width: '30px', height: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {activePopup.content.mediaType === 'image' && activePopup.content.mediaUrl && (
          <img src={activePopup.content.mediaUrl} alt={activePopup.content.title} style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'cover' }} />
        )}
        
        {activePopup.content.mediaType === 'video' && activePopup.content.mediaUrl && (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe 
              src={getEmbedUrl(activePopup.content.mediaUrl)} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen 
            />
          </div>
        )}

        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>{activePopup.content.title}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', whiteSpace: 'pre-wrap' }}>{activePopup.content.text}</p>
          
          {activePopup.content.buttonText && activePopup.content.buttonLink && (
            <a 
              href={activePopup.content.buttonLink} 
              target={activePopup.content.buttonLink.startsWith('http') ? '_blank' : '_self'}
              rel="noreferrer"
              className="btn btn-primary"
              style={{ display: 'inline-block', width: '100%', maxWidth: '300px', textDecoration: 'none' }}
              onClick={() => {
                if (!activePopup.content.buttonLink.startsWith('http')) {
                  handleClose(); // Fecha se for um link interno para evitar deixar o popup aberto na navegação
                }
              }}
            >
              {activePopup.content.buttonText}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default PopupViewer;
