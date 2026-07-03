import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export default function FloatingWhatsApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) return;
    const url = `https://wa.me/5561996952795?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setIsOpen(false);
    setMessage('');
  };

  return (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      {isOpen && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '300px', marginBottom: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: '#25D366', color: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontWeight: 'bold' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid white' }}>
                <img src="/perfil-whatsapp.jpg" onError={(e) => { e.currentTarget.src = "/Foto-Principal-Ruth.webp"; }} alt="Ruth Dias" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '1.1rem', lineHeight: 1.2 }}>Ruth Dias</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 'normal', opacity: 0.9 }}>Online</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f0f2f5', flex: 1, minHeight: '100px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <div style={{ backgroundColor: 'white', padding: '0.8rem', borderRadius: '0 8px 8px 8px', alignSelf: 'flex-start', color: '#303030', fontSize: '0.9rem', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', maxWidth: '80%' }}>
               Olá, como posso te ajudar?
             </div>
          </div>
          <div style={{ padding: '0.8rem', backgroundColor: 'white', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Digite sua mensagem..." 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              style={{ flex: 1, padding: '0.8rem', border: 'none', backgroundColor: '#f0f2f5', borderRadius: '20px', outline: 'none', fontSize: '0.9rem' }}
            />
            <button onClick={handleSend} style={{ background: 'none', border: 'none', color: '#25D366', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem' }}>
              <Send size={20} />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#25D366', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(37, 211, 102, 0.4)', transition: 'transform 0.2s' }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle size={32} />
        </button>
      )}
    </div>
  );
}
