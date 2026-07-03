import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, MapPin, Bed, Car, Ruler, Bath, Dog, Armchair, Share2, ChevronLeft, ChevronRight, X, MessageCircle } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { useAuth } from '../context/AuthContext';
import ClientLoginModal from '../components/ClientLoginModal';
import PublicHeader from '../components/PublicHeader';
import Swal from 'sweetalert2';
import logo from '../assets/logo.png';
import { initialPortfolioProperties } from '../data/initialData';

interface Property {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  price: string;
  area: string;
  rooms: string;
  garages: string;
  imageUrl: string;
  type: string;
  description: string;
  featured: boolean;
  suites?: string;
  banheiros?: string;
  pets?: string;
  mobilia?: string;
  createdBy?: string;
  gallery?: string[];
}

export default function SiteProperty() {
  const { id } = useParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  
  const { user, toggleFavorite } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [enlargedImageIndex, setEnlargedImageIndex] = useState<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragMoved, setDragMoved] = useState(false);
  const [pendingFavId, setPendingFavId] = useState<string | null>(null);

  const formatPrice = (price?: string | number) => {
    if (!price) return 'Sob Consulta';
    const strPrice = String(price).trim();
    if (strPrice.toLowerCase().includes('r$') && strPrice.includes(',')) return strPrice;
    const numericString = strPrice.replace(/\D/g, '');
    if (!numericString) return strPrice;
    let numValue = 0;
    if (strPrice.includes(',')) {
      numValue = parseInt(numericString, 10) / 100;
    } else {
      numValue = parseInt(numericString, 10);
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue);
  };

  // Efeito para auto-favoritar após o login/cadastro se havia um clique pendente
  useEffect(() => {
    if (user && user.role === 'cliente' && pendingFavId) {
      if (!user.favorites?.includes(pendingFavId)) {
        toggleFavorite(pendingFavId);
      }
      setPendingFavId(null); // limpa
    }
  }, [user, pendingFavId]);

  useEffect(() => {
    if (property && !formData.message) {
      setFormData(prev => ({ ...prev, message: `Olá, tenho interesse no imóvel:\nhttps://ruthdiasimoveis.com.br/imovel/${property.id}` }));
    }
  }, [property]);

  const handleFavoriteClick = (e: React.MouseEvent, propId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setPendingFavId(propId);
      setIsLoginModalOpen(true);
    } else {
      toggleFavorite(propId);
    }
  };

  useEffect(() => {
    // Carregar todas as propriedades para encontrar a atual e também para mostrar "Relacionados"
    fetch('/api.php?key=ruth_dias_portfolio')
      .then(res => res.text())
      .then(text => {
        try {
          if (!text || text.trim().startsWith('<')) throw new Error('Fallback para localStorage');
          let parsed = JSON.parse(text);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            setProperties(parsed.filter((p: any) => p.isActive !== false));
            const found = parsed.find(p => p.id === id && p.isActive !== false);
            if (found) setProperty(found);
            setLoading(false);
            return;
          }
        } catch (e) {
          throw e;
        }
      })
      .catch((e) => {
        const local = localStorage.getItem('ruth_dias_portfolio');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
            setProperties(parsed.filter((p: any) => p.isActive !== false));
            const found = parsed.find((p: any) => p.id === id && p.isActive !== false);
            if (found) setProperty(found);
            setLoading(false);
            return;
          }
        }
        setProperties(initialPortfolioProperties as Property[]);
        const foundInitial = initialPortfolioProperties.find((p: any) => p.id === id);
        if (foundInitial) setProperty(foundInitial as Property);
        console.error('Falha ao carregar imóvel via BD:', e.message);
        setLoading(false);
      });
  }, [id]);

  const galleryImages = Array.isArray(property?.gallery) ? property.gallery : [];
  const allImages = property ? [property.imageUrl, ...galleryImages].filter(Boolean) : [];
  const marqueeImages = [...allImages, ...allImages];

  useEffect(() => {
    let animationId: number;
    const scroll = () => {
      if (scrollContainerRef.current && !isPausedRef.current && !isDragging && allImages.length > 1) {
        scrollContainerRef.current.scrollLeft += 1.5;
        
        if (scrollContainerRef.current.scrollLeft >= scrollContainerRef.current.scrollWidth / 2) {
          scrollContainerRef.current.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };
    animationId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationId);
  }, [isDragging, allImages.length]);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5c1b33', fontSize: '1.2rem' }}>Carregando informações do imóvel...</div>;
  }

  if (!property) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <h1 style={{ color: '#5c1b33', marginBottom: '1rem' }}>Imóvel não encontrado</h1>
        <Link to="/site" style={{ padding: '0.8rem 1.5rem', backgroundColor: '#5c1b33', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>Voltar ao Início</Link>
      </div>
    );
  }

  // Pegar imóveis relacionados (mesmo tipo ou mesma cidade)
  const relatedProperties = properties
    .filter(p => p.id !== property.id && (p.type === property.type || p.city === property.city))
    .slice(0, 4);

  const handleShare = async () => {
    const cardNode = document.getElementById('property-card-share');
    if (!cardNode) return;

    try {
      cardNode.style.transform = 'none';
      const blob = await htmlToImage.toBlob(cardNode, { cacheBust: true, pixelRatio: 2, backgroundColor: 'white' });
      if (!blob) throw new Error("Erro ao gerar imagem");

      const file = new File([blob], `imovel-${property.id}.png`, { type: 'image/png' });
      const shareUrl = `${window.location.origin}/imovel/${property.id}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: property.title,
          text: `Confira este imóvel:\n${shareUrl}`,
          files: [file],
        });
      } else {
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ [blob.type]: blob })
            ]);
            alert(`Imagem do imóvel copiada com sucesso!\n\nEnvie para quem desejar junto com este link:\n${shareUrl}`);
          } catch(clipboardErr) {
            alert(`Link do imóvel (Imagem não suportada pelo navegador):\n${shareUrl}`);
          }
        } else {
          alert(`Link do imóvel:\n${shareUrl}`);
        }
      }
    } catch (err) {
      console.error("Erro no compartilhamento:", err);
      alert('Erro ao tentar gerar a imagem para compartilhamento.');
    }
  };

  const handleSendMessage = () => {
    if (!formData.name || !formData.email || !formData.message) {
      Swal.fire('Atenção', 'Por favor, preencha pelo menos Nome, E-mail e Mensagem.', 'warning');
      return;
    }

    const newMessage = {
      id: 'msg_' + Date.now().toString(36),
      propertyId: property.id,
      brokerId: property.createdBy || 'admin', // Envia para o corretor que criou, ou admin se não tiver
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      message: formData.message,
      date: new Date().toISOString()
    };

    fetch('/api.php?key=ruth_dias_messages')
      .then(res => res.text())
      .then(text => {
         let parsed = JSON.parse(text);
         if (typeof parsed === 'string') parsed = JSON.parse(parsed);
         const messages = Array.isArray(parsed) ? parsed : [];
         messages.push(newMessage);
         
         return fetch('/api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'ruth_dias_messages', value: JSON.stringify(messages), send_email: true, email_data: newMessage })
         });
      })
      .catch(() => {
         // Fallback local
         const local = localStorage.getItem('ruth_dias_messages');
         let messages = [];
         if (local) {
           let parsed = JSON.parse(local);
           if (typeof parsed === 'string') parsed = JSON.parse(parsed);
           messages = Array.isArray(parsed) ? parsed : [];
         }
         messages.push(newMessage);
         localStorage.setItem('ruth_dias_messages', JSON.stringify(messages));
      })
      .finally(() => {
        Swal.fire({
          title: 'Mensagem Enviada!',
          text: 'Sua mensagem foi enviada com sucesso para o corretor responsável. Em breve entraremos em contato.',
          icon: 'success',
          confirmButtonColor: '#5c1b33'
        });
        setFormData({ name: '', email: '', phone: '', message: `Olá, tenho interesse no imóvel:\nhttps://ruthdiasimoveis.com.br/imovel/${property.id}` });
      });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (allImages.length <= 1) return;
    setIsDragging(true);
    setDragMoved(false);
    isPausedRef.current = true;
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    isPausedRef.current = false;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    isPausedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (Math.abs(walk) > 5) setDragMoved(true);
    if (scrollContainerRef.current) {
      let newScroll = scrollLeft - walk;
      const halfWidth = scrollContainerRef.current.scrollWidth / 2;
      if (newScroll < 0) newScroll += halfWidth;
      if (newScroll >= halfWidth) newScroll -= halfWidth;
      scrollContainerRef.current.scrollLeft = newScroll;
    }
  };

  const handleImageClick = (idx: number) => {
    if (dragMoved) return;
    setEnlargedImageIndex(idx % allImages.length);
  };

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', width: '100%' }}>
      {/* Top Header idêntico à Home */}
      <PublicHeader />

      {/* Banner Principal de Imagem */}
      <div style={{ width: '100%', height: '500px', position: 'relative', overflow: 'hidden', backgroundColor: '#111' }}>
        
        {allImages.length > 1 ? (
          <div 
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => { isPausedRef.current = true; }}
            style={{ 
              display: 'flex', 
              height: '100%', 
              overflowX: 'hidden', 
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
          >
            {marqueeImages.map((img, idx) => (
              <img 
                key={idx} 
                src={img} 
                alt={`${property.title} - ${idx}`} 
                onDragStart={(e) => e.preventDefault()}
                onClick={() => handleImageClick(idx)}
                style={{ width: 'auto', height: '100%', paddingRight: '4px', opacity: 1, transition: 'opacity 0.3s' }} 
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              />
            ))}
          </div>
        ) : (
          <img 
            src={allImages[0] || property.imageUrl} 
            alt={property.title} 
            className="gallery-item"
            onClick={() => setEnlargedImageIndex(0)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        )}

        {/* Overlays */}
        <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
          <span style={{ backgroundColor: '#5c1b33', color: 'white', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
             {property.type}
          </span>
          <span style={{ backgroundColor: '#f59e0b', color: 'white', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>
            Venda
          </span>
        </div>
      </div>

      {/* Modal de Imagem Ampliada */}
      {enlargedImageIndex !== null && (
        <div 
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEnlargedImageIndex(null)}
        >
          <img 
            src={allImages[enlargedImageIndex]} 
            style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain' }} 
            onClick={(e) => e.stopPropagation()} 
            alt="Ampliada" 
          />
          
          {allImages.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setEnlargedImageIndex(prev => prev === 0 ? allImages.length - 1 : prev! - 1); }} 
                style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronLeft size={32} />
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); setEnlargedImageIndex(prev => prev === allImages.length - 1 ? 0 : prev! + 1); }} 
                style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          <button 
            onClick={() => setEnlargedImageIndex(null)} 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '10px' }}
          >
            <X size={32} />
          </button>
        </div>
      )}

      {/* Conteúdo Principal (Duas colunas) */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
        
        {/* Coluna Esquerda: Informações (70%) */}
        <div id="property-card-share" style={{ flex: '1 1 65%', minWidth: '300px', backgroundColor: 'white', padding: '1rem', borderRadius: '12px' }}>
          {/* Botões de Ação Superiores */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 2rem', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', color: '#5c1b33' }}>
               <MapPin size={18} /> Mapa
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
               <Share2 size={18} /> Compartilhar
            </button>
            <button onClick={(e) => handleFavoriteClick(e, property.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
               <Heart size={18} color={user?.favorites && Array.isArray(user.favorites) && user.favorites.includes(property.id) ? '#f59e0b' : 'white'} fill={user?.favorites && Array.isArray(user.favorites) && user.favorites.includes(property.id) ? '#f59e0b' : 'none'} /> Favoritar
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', color: '#f59e0b', fontSize: '0.9rem', marginBottom: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={14} /> Ruth Dias</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={14} /> {property.type}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={14} /> Venda</span>
          </div>

          <h1 style={{ fontSize: '2.5rem', color: '#1a1e2b', marginBottom: '0.5rem', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.2 }}>{property.title}</h1>
          <h2 style={{ fontSize: '2rem', color: '#5c1b33', marginBottom: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 'normal', color: '#64748b', marginRight: '0.5rem' }}>Por apenas</span>
            {formatPrice(property.price)}
          </h2>

          {/* Características Grid */}
          <div style={{ backgroundColor: '#fdfbfb', padding: '1.5rem', borderRadius: '8px', marginBottom: '3rem', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: '#666', marginBottom: '1rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bed size={18} color="#5c1b33" /> {property.rooms || '-'} Quartos</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Car size={18} color="#5c1b33" /> {property.garages || '-'} Vagas</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bath size={18} color="#5c1b33" /> {property.banheiros || '1'} Banheiros</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Ruler size={18} color="#5c1b33" /> {property.area || '-'} m²</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: '#666' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Dog size={18} color="#5c1b33" /> {property.pets || 'Aceita pet'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bed size={18} color="#5c1b33" /> {property.suites || '1 Suíte'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Armchair size={18} color="#5c1b33" /> {property.mobilia || 'Sem Mobília'}</span>
            </div>
          </div>

          <h3 style={{ fontSize: '1.5rem', color: '#5c1b33', marginBottom: '1.5rem' }}>Descrição do imóvel</h3>
          <div style={{ color: '#4b5563', lineHeight: '1.8', marginBottom: '3rem', whiteSpace: 'pre-wrap' }}>
            <ul>
              <li style={{ marginBottom: '1rem' }}>
                {property.description || "Descrição completa deste imóvel em breve. Para mais detalhes sobre as condições, negociação ou agendamento de visita, entre em contato diretamente com a nossa equipe."}
              </li>
            </ul>
          </div>

          <h3 style={{ fontSize: '1.5rem', color: '#5c1b33', marginBottom: '1.5rem' }}>Localização</h3>
          <div style={{ width: '100%', height: '300px', backgroundColor: '#e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
             <iframe 
               width="100%" 
               height="100%" 
               frameBorder="0" 
               scrolling="no" 
               marginHeight={0} 
               marginWidth={0} 
               src={`https://maps.google.com/maps?q=${encodeURIComponent(property.neighborhood + ', ' + property.city)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
               title={`Mapa de ${property.neighborhood}, ${property.city}`}
             ></iframe>
          </div>
          <div style={{ color: '#5c1b33', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={18} /> {property.neighborhood}, {property.city}
          </div>

          {/* Navegação Anterior / Próximo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', marginTop: '3rem', paddingTop: '1.5rem' }}>
             <button style={{ background: 'none', border: 'none', color: '#5c1b33', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
               <ChevronLeft size={20} /> ANTERIOR
             </button>
             <button style={{ background: 'none', border: 'none', color: '#5c1b33', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
               PRÓXIMO <ChevronRight size={20} />
             </button>
          </div>
        </div>

        {/* Coluna Direita: Contato (30%) */}
        <div style={{ flex: '1 1 30%', minWidth: '300px' }}>
          
          {/* Formulário Fixo */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '2rem', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <span style={{ fontWeight: 'bold', color: '#5c1b33' }}>Preço:</span>
              <span style={{ color: '#666' }}>{property.price}</span>
            </div>
            
            <h3 style={{ color: '#5c1b33', fontSize: '1.5rem', marginBottom: '1.5rem' }}>Dados de contato</h3>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="Nome" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none' }} />
              <input type="email" placeholder="E-mail" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none' }} />
              <input type="tel" placeholder="(__) ____-____" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none' }} />
              <textarea rows={4} value={formData.message} onChange={(e) => setFormData({...formData, message: e.target.value})} style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none', resize: 'vertical' }} />
              <button type="button" onClick={handleSendMessage} style={{ backgroundColor: '#fbcfe8', color: '#be185d', fontWeight: 'bold', padding: '1rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', marginTop: '0.5rem', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9a8d4'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fbcfe8'}>
                ENVIAR MENSAGEM
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                <span style={{ color: '#5c1b33' }}>🔒</span> Sua privacidade está segura.
              </div>
            </form>
          </div>

          {/* Fale com a Imobiliária (Corretora) */}
          <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
            {/* Foto Genérica / Imagem Circular */}
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f3f4f6', marginBottom: '1rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #5c1b33' }}>
               <img src="/Foto-Principal-Ruth.webp" onError={(e) => { e.currentTarget.src = "/logo.png"; }} alt="Ruth Dias" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            
            <h3 style={{ color: '#5c1b33', fontSize: '1.3rem', marginBottom: '1rem' }}>Fale com a imobiliária</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', color: '#4b5563', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#5c1b33' }}>👤</span> Corretor responsável: Ruth Dias
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#5c1b33' }}>💬</span> Whatsapp: (61) 99695-2795
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#5c1b33' }}>📍</span> Localização: Av Monumental
              </div>
              <button 
                onClick={() => window.open(`https://wa.me/5561996952795?text=${encodeURIComponent('Olá, tenho interesse no imóvel ' + property.title)}`, '_blank')}
                style={{ marginTop: '1rem', width: '100%', padding: '0.8rem', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'background-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#128C7E'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#25D366'}
              >
                <MessageCircle size={18} /> Chamar no WhatsApp
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Relacionados */}
      {relatedProperties.length > 0 && (
        <section style={{ backgroundColor: '#5c1b33', padding: '4rem 2rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ color: 'white', fontSize: '2rem', textAlign: 'center', marginBottom: '3rem' }}>Imóveis relacionados</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
              {relatedProperties.map(p => (
                <div key={p.id} style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                  <Link to={`/imovel/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ position: 'relative' }}>
                      <img src={p.imageUrl} alt={p.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '1rem', left: '1rem', backgroundColor: '#5c1b33', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                        Venda
                      </div>
                    </div>
                    <div style={{ padding: '1rem' }}>
                      <h3 style={{ margin: '0 0 0.8rem 0', color: '#1a1e2b', fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.3, letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        <MapPin size={14} color="#5c1b33" /> {p.neighborhood}, {p.city}
                      </div>
                      <div style={{ display: 'flex', gap: '0.8rem', color: '#666', fontSize: '0.8rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Bed size={12} /> {p.rooms || '-'} Qts</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Car size={12} /> {p.garages || '-'} Vgs</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Ruler size={12} /> {p.area || '-'} m²</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ color: '#5c1b33', fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.5px' }}>{formatPrice(p.price)}</div>
                        <Heart size={16} color={user?.favorites && Array.isArray(user.favorites) && user.favorites.includes(p.id) ? '#f59e0b' : '#cbd5e1'} fill={user?.favorites && Array.isArray(user.favorites) && user.favorites.includes(p.id) ? '#f59e0b' : 'none'} style={{ cursor: 'pointer' }} onClick={(e) => handleFavoriteClick(e, p.id)} />
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer idêntico à Home */}
      <footer style={{ backgroundColor: '#5c1b33', color: 'white', padding: '4rem 2rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '3rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '3rem' }}>
          
          <div style={{ flex: 2, minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
            <Link to="/site">
              <img src={logo} alt="Ruth Dias Logo" style={{ height: '60px', filter: 'brightness(0) invert(1)', marginBottom: '1.5rem', alignSelf: 'flex-start' }} />
            </Link>
            <p style={{ color: '#e5e7eb', lineHeight: 1.6, maxWidth: '400px', marginBottom: '1rem' }}>
              Especialista em negócios imobiliários de alto padrão e oportunidades de leilão. Encontre o imóvel ideal com segurança e rentabilidade.
            </p>
            <div style={{ width: '40px', height: '2px', backgroundColor: '#f59e0b', marginBottom: '1rem' }}></div>
            <Link to="/politica-privacidade" style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s', width: 'fit-content' }} onMouseOver={(e) => e.currentTarget.style.color = 'white'} onMouseOut={(e) => e.currentTarget.style.color = '#e5e7eb'}>
              Política de Privacidade
            </Link>
          </div>

          <div style={{ flex: 1, minWidth: '250px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'white' }}>Contatos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem', color: '#e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#f59e0b' }}>📞</span> (61) 99695-21795
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#f59e0b' }}>✉️</span> ruth.dias@gmail.com
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#f59e0b' }}>📍</span> Avenida Monumental - Brasília
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <h4 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'white' }}>Social</h4>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '1.2rem' }}>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>📷</a>
              <a href="#" style={{ color: 'white', textDecoration: 'none' }}>📱</a>
            </div>
          </div>

        </div>
        
        <div style={{ maxWidth: '1200px', margin: '2rem auto 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', opacity: 0.9 }}>
          <div>
            © RUTH DIAS IMÓVEIS 2025<br />
            TODOS OS DIREITOS RESERVADOS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Feito por</span>
            <img src="/Tali-Logo-Arroba-Deitado-branco.svg" alt="Tali Agência Digital" style={{ height: '24px' }} />
          </div>
        </div>
      </footer>
      
      <ClientLoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}
