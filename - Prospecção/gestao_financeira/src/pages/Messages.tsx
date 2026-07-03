import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Calendar, User, Phone, Mail, Link as LinkIcon, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';

interface Message {
  id: string;
  propertyId: string;
  brokerId?: string; // the ID of the broker who registered the property
  name: string;
  email: string;
  phone: string;
  message: string;
  date: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = () => {
    setLoading(true);
    fetch('/api.php?key=ruth_dias_messages')
      .then(res => res.text())
      .then(text => {
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (Array.isArray(parsed)) {
          // Filter messages based on role
          if (user?.role === 'admin') {
            setMessages(parsed); // Admin sees all
          } else if (user?.role === 'corretor') {
            // Broker sees only messages for properties they created
            setMessages(parsed.filter((m: Message) => m.brokerId === user.id));
          } else {
            setMessages([]);
          }
        }
      })
      .catch(() => {
        const local = localStorage.getItem('ruth_dias_messages');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          if (Array.isArray(parsed)) {
             if (user?.role === 'admin') {
               setMessages(parsed);
             } else if (user?.role === 'corretor') {
               setMessages(parsed.filter((m: Message) => m.brokerId === user.id));
             } else {
               setMessages([]);
             }
          }
        }
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = (id: string) => {
    Swal.fire({
      title: 'Excluir Mensagem?',
      text: "Você não poderá reverter isso!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const newMessages = messages.filter(m => m.id !== id);
        setMessages(newMessages);
        
        // Em um sistema real, não pegaríamos e sobrescreveríamos tudo filtrado
        // Aqui atualizamos no backend
        fetch('/api.php?key=ruth_dias_messages')
          .then(res => res.text())
          .then(text => {
             let parsed = JSON.parse(text);
             if (typeof parsed === 'string') parsed = JSON.parse(parsed);
             let allMessages = Array.isArray(parsed) ? parsed : [];
             allMessages = allMessages.filter((m: Message) => m.id !== id);
             
             return fetch('/api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'ruth_dias_messages', value: JSON.stringify(allMessages) })
             });
          })
          .catch(() => {
             // Fallback local storage se API falhar
             const local = localStorage.getItem('ruth_dias_messages');
             let allMessages = [];
             if (local) {
               let parsed = JSON.parse(local);
               if (typeof parsed === 'string') parsed = JSON.parse(parsed);
               allMessages = Array.isArray(parsed) ? parsed : [];
             }
             allMessages = allMessages.filter((m: Message) => m.id !== id);
             localStorage.setItem('ruth_dias_messages', JSON.stringify(allMessages));
          });

        Swal.fire('Excluído!', 'A mensagem foi excluída.', 'success');
      }
    });
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Carregando mensagens...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MessageSquare size={32} color="var(--primary-color)" />
            Mensagens Recebidas
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {user?.role === 'admin' 
              ? 'Todas as mensagens enviadas pelos clientes nos imóveis.' 
              : 'Mensagens recebidas nos imóveis que você cadastrou.'}
          </p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div style={{ backgroundColor: 'white', padding: '4rem 2rem', textAlign: 'center', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <MessageSquare size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.5rem', color: '#334155', marginBottom: '0.5rem' }}>Nenhuma mensagem</h3>
          <p style={{ color: '#64748b' }}>Ainda não há mensagens de clientes interessados nos imóveis.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(msg => (
            <div key={msg.id} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
              
              <button onClick={() => handleDelete(msg.id)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <Trash2 size={18} />
              </button>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingRight: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155', fontWeight: 'bold' }}>
                  <User size={16} color="var(--primary-color)" /> {msg.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                  <Mail size={16} /> {msg.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                  <Phone size={16} /> {msg.phone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                  <Calendar size={16} /> {new Date(msg.date).toLocaleString('pt-BR')}
                </div>
              </div>
              
              <div style={{ color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                {msg.message}
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <a href={`/imovel/${msg.propertyId}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold' }}>
                  <LinkIcon size={16} /> Ver Imóvel Referente
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
