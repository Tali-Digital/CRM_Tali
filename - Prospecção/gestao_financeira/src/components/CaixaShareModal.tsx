import { useRef, useState, useEffect } from 'react';
import { X, MapPin, Copy, MessageCircle } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import logoUrl from '../assets/logo.png';

interface Property {
  id?: string;
  uf?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  price?: string;
  appraisalValue?: string;
  appraisal?: string;
  discount?: string;
  financing?: string;
  description?: string;
  saleType?: string;
  link?: string;
}

interface CaixaShareModalProps {
  property: Property;
  onClose: () => void;
}

export default function CaixaShareModal({ property, onClose }: CaixaShareModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState('');

  const copyImageToClipboard = async () => {
    if (!cardRef.current) return;
    try {
      const originalRadius = cardRef.current.style.borderRadius;
      cardRef.current.style.borderRadius = '0';
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 });
      cardRef.current.style.borderRadius = originalRadius;
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      setToastMessage('Imagem copiada com sucesso!');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Erro ao copiar imagem', err);
      setToastMessage('Erro ao copiar a imagem.');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };



  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 540) {
        setScale((window.innerWidth - 40) / 500);
      } else {
        setScale(1);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shareOnWhatsapp = async () => {
    if (!cardRef.current) return;
    
    const template = localStorage.getItem('ruth_dias_broker_message') || 
      'Olá, veja essa oportunidade de leilão da Caixa no bairro {bairro} em {cidade}. Preço: R$ {preco} ({desconto}% de desconto).';
    
    const formatted = template
      .replace(/{bairro}/gi, property.neighborhood || '')
      .replace(/{cidade}/gi, property.city || '')
      .replace(/{preco}/gi, property.price || '')
      .replace(/{desconto}/gi, property.discount || '')
      .replace(/{link}/gi, property.link || '');

    try {
      const originalRadius = cardRef.current.style.borderRadius;
      cardRef.current.style.borderRadius = '0';
      const blob = await toBlob(cardRef.current, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2, style: { transform: 'none' } });
      cardRef.current.style.borderRadius = originalRadius;
      
      if (!blob) throw new Error("Erro ao gerar imagem");
      
      const file = new File([blob], `oportunidade-caixa-${property.id || 'imovel'}.png`, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Oportunidade Caixa',
          text: formatted,
          files: [file]
        });
      } else {
        if (navigator.clipboard && navigator.clipboard.write) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert("A imagem da ficha foi copiada para sua área de transferência!\n\nVamos abrir o WhatsApp agora. Basta colar a imagem na conversa com seu cliente.");
          } catch(e) {
            console.error('Erro ao copiar imagem', e);
          }
        }
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(formatted)}`, '_blank');
      }
    } catch (err) {
      console.error('Erro ao compartilhar', err);
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(formatted)}`, '_blank');
    }
  };

  return (
    <>
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--primary-color)', color: 'white', padding: '0.75rem 1.5rem',
          borderRadius: '99px', fontSize: '0.9rem', fontWeight: 500, zIndex: 99999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {toastMessage}
        </div>
      )}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0', overflow: 'hidden'
      }} onClick={onClose}>
        
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          <div 
            className="card animate-fade-in" 
            style={{ width: '500px', backgroundColor: 'var(--bg-primary)', padding: 0, margin: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Compartilhar Imóvel</h3>
            <button className="btn btn-ghost" style={{ padding: '0.2rem' }} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          
          <div ref={cardRef} style={{ padding: '2rem', backgroundColor: '#ffffff', color: '#1a1e2b' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #f1f3f8', paddingBottom: '1.5rem' }}>
              <h2 style={{ color: '#0f172a', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Oportunidade de Leilão</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#5a6478' }}>
                <MapPin size={16} />
                <span>{property.neighborhood} | {property.city} - {property.uf || 'DF'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#5a6478', textTransform: 'uppercase', fontWeight: 600 }}>Endereço Completo</div>
                <div 
                  contentEditable 
                  suppressContentEditableWarning 
                  style={{ fontSize: '1rem', padding: '0.2rem 0', minHeight: '1.5rem', outline: 'none', borderBottom: '1px dashed #cbd5e1' }}
                >
                  {property.address || 'Clique para digitar o endereço...'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#5a6478', textTransform: 'uppercase', fontWeight: 600 }}>Descrição</div>
                <div 
                  contentEditable 
                  suppressContentEditableWarning 
                  style={{ fontSize: '1rem', outline: 'none', padding: '0.2rem 0', minHeight: '1.5rem' }}
                >
                  {property.description}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8f9fc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#5a6478' }}>Avaliação CAIXA:</span>
                <span style={{ textDecoration: 'line-through' }}>R$ {property.appraisalValue || property.appraisal || '0,00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Valor de Venda:</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#c49a45' }}>R$ {property.price || '0,00'}</span>
              </div>
              {property.discount && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <span style={{ backgroundColor: '#10b981', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 600, fontSize: '0.9rem' }}>
                    Desconto de {property.discount}%
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginTop: '0.5rem', marginBottom: '-1rem', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
              <img src={logoUrl} alt="Ruth Dias" style={{ height: '100px', objectFit: 'contain' }} />
            </div>
          </div>

            <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', borderRadius: '0 0 var(--radius-md) var(--radius-md)', flexWrap: 'wrap' }}>
              <button className="btn btn-outline" style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={shareOnWhatsapp}>
                <MessageCircle size={18} /> Compartilhar
              </button>
              <button className="btn btn-primary" style={{ flex: 1, minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={copyImageToClipboard}>
                <Copy size={18} /> Copiar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
