import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Camera, Mail, Save, Lock, Briefcase, Phone, MessageSquare } from 'lucide-react';
import Swal from 'sweetalert2';

export default function MyProfile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(user?.name || '');
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || '');
  const [isSaving, setIsSaving] = useState(false);

  // Professional settings
  const [brokerName, setBrokerName] = useState(() => localStorage.getItem('ruth_dias_broker_name') || 'Ruth Dias');
  const [brokerCreci, setBrokerCreci] = useState(() => localStorage.getItem('ruth_dias_broker_creci') || '50800F');
  const [brokerPhone, setBrokerPhone] = useState(() => localStorage.getItem('ruth_dias_broker_phone') || '');
  const [brokerMessage, setBrokerMessage] = useState(() => 
    localStorage.getItem('ruth_dias_broker_message') || 'Olá Ruth, gostei desse imóvel da Caixa no bairro {bairro} e gostaria de mais informações.'
  );

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhotoUrl(user.photoUrl || '');
    }
  }, [user]);

  if (!user) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Arquivo muito grande',
        text: 'A imagem de perfil deve ter no máximo 2MB.',
        confirmButtonColor: '#8a2346'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPhotoUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordReset = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user!.email })
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar email pelo servidor.');
      }

      Swal.fire({
        icon: 'success',
        title: 'E-mail Enviado!',
        text: 'E-mail de recuperação enviado! Verifique sua caixa de entrada.',
        confirmButtonColor: '#5c1b33'
      });
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: 'Não foi possível conectar ao servidor de e-mails. Verifique se o backend está rodando.',
        confirmButtonColor: '#5c1b33'
      });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      updateUser(user.id, { name, photoUrl });
      
      // Save professional settings
      if (user.role === 'admin' || user.role === 'corretor') {
        localStorage.setItem('ruth_dias_broker_name', brokerName);
        localStorage.setItem('ruth_dias_broker_creci', brokerCreci);
        localStorage.setItem('ruth_dias_broker_phone', brokerPhone);
        localStorage.setItem('ruth_dias_broker_message', brokerMessage);
        window.dispatchEvent(new Event('storage'));
      }

      Swal.fire({
        icon: 'success',
        title: 'Perfil Atualizado',
        text: 'Suas informações foram salvas com sucesso!',
        confirmButtonColor: '#5c1b33',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Erro ao salvar',
        text: 'Ocorreu um erro ao atualizar o perfil.',
        confirmButtonColor: '#5c1b33'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in-simple" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', color: '#0f172a', marginBottom: '0.5rem' }}>Meu Perfil</h1>
        <p style={{ color: '#64748b' }}>Gerencie suas informações pessoais e foto de perfil.</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Avatar Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ 
                width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#f1f5f9', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                border: '3px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}>
                {photoUrl ? (
                  <img src={photoUrl} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '3rem', color: '#94a3b8', fontWeight: 'bold' }}>{name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ 
                  position: 'absolute', bottom: 0, right: 0, width: '36px', height: '36px', 
                  borderRadius: '50%', backgroundColor: '#5c1b33', color: 'white', 
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                title="Mudar foto"
              >
                <Camera size={18} />
              </button>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                style={{ display: 'none' }} 
              />
            </div>
            <div>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem' }}>Foto de Perfil</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem', maxWidth: '250px' }}>
                Recomendamos uma imagem quadrada de no mínimo 200x200px (Máx. 2MB).
              </p>
              {photoUrl && (
                <button type="button" onClick={() => setPhotoUrl('')} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginTop: '0.5rem', fontWeight: 500 }}>
                  Remover foto atual
                </button>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

          {/* Form Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>Nome Completo</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem', color: '#0f172a' }}
                />
                <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>
                E-mail <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal', marginLeft: '0.5rem' }}>(Somente leitura)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="email" 
                  value={user.email} 
                  readOnly
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', outline: 'none', fontSize: '1rem', cursor: 'not-allowed' }}
                />
                <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <Lock size={16} color="#94a3b8" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <button 
                type="button" 
                onClick={handlePasswordReset}
                style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#5c1b33', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                Redefinir minha senha
              </button>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>Perfil de Acesso</label>
              <div style={{ display: 'inline-block', padding: '0.4rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '20px', color: '#475569', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'capitalize' }}>
                {user.role}
              </div>
            </div>
          </div>

          {(user.role === 'admin' || user.role === 'corretor') && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Briefcase size={20} color="#5c1b33" />
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem' }}>Perfil Profissional</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>Nome Comercial</label>
                    <div style={{ position: 'relative' }}>
                      <input type="text" value={brokerName} onChange={e => setBrokerName(e.target.value)} required style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem' }} />
                      <User size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>CRECI</label>
                    <div style={{ position: 'relative' }}>
                      <input type="text" value={brokerCreci} onChange={e => setBrokerCreci(e.target.value)} required style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem' }} />
                      <Briefcase size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>WhatsApp Comercial (DDD + número)</label>
                  <div style={{ position: 'relative' }}>
                    <input type="tel" value={brokerPhone} onChange={e => setBrokerPhone(e.target.value.replace(/\D/g, ''))} style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem' }} />
                    <Phone size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: '#334155' }}>Mensagem Padrão de Contato</label>
                  <div style={{ position: 'relative' }}>
                    <textarea value={brokerMessage} onChange={e => setBrokerMessage(e.target.value)} style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem', minHeight: '80px', fontFamily: 'inherit' }} />
                    <MessageSquare size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '1rem' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Use <strong>{`{bairro}`}</strong> ou <strong>{`{cidade}`}</strong>.</span>
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button 
              type="submit" 
              disabled={isSaving}
              style={{ 
                backgroundColor: '#5c1b33', color: 'white', border: 'none', padding: '0.8rem 2rem', 
                borderRadius: '6px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', 
                display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isSaving ? 0.7 : 1,
                boxShadow: '0 4px 6px -1px rgba(92, 27, 51, 0.2)'
              }}
            >
              <Save size={18} /> {isSaving ? 'Salvando...' : 'Salvar Perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
