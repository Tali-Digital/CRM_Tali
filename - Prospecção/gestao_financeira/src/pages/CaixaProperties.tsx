import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { UploadCloud, Search, MapPin, X, Share2, Plus, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Swal from 'sweetalert2';
import { initialCaixaData } from '../data/initialData';
import CaixaShareModal from '../components/CaixaShareModal';

interface Property {
  id: string;
  uf: string;
  city: string;
  neighborhood: string;
  address: string;
  price: string;
  appraisalValue: string;
  discount: string;
  financing: string;
  description: string;
  saleType: string;
  link: string;
}

const getModalidadeColor = (saleType: string) => {
  const type = saleType.toLowerCase();
  if (type.includes('venda direta')) return { bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--success)' }; // Verde
  if (type.includes('licitação aberta') || type.includes('leilão')) return { bg: 'rgba(59, 130, 246, 0.15)', text: 'var(--info)' }; // Azul
  if (type.includes('licitação fechada')) return { bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--warning)' }; // Laranja
  return { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)' }; // Padrão
};

const CaixaProperties = () => {
  const navigate = useNavigate();
  const [propertiesDb, setPropertiesDb] = useState<Record<string, Property[]>>({});
  const [selectedState, setSelectedState] = useState<string>('DF');
  const [statesList, setStatesList] = useState<string[]>(['DF', 'GO']);
  const [updateDates, setUpdateDates] = useState<Record<string, string>>({});
  const [isAddingState, setIsAddingState] = useState(false);
  const [newStateName, setNewStateName] = useState('');

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterDiscount, setFilterDiscount] = useState('');
  const [filterSaleType, setFilterSaleType] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    // Tenta carregar do MySQL via API PHP
    fetch('/api.php?key=ruth_dias_properties')
      .then(res => res.text())
      .then(text => {
        if (!text || text.trim().startsWith('<')) throw new Error('API não rodando PHP');
        let parsed = JSON.parse(text);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        return parsed;
      })
      .catch(() => {
        const local = localStorage.getItem('ruth_dias_properties');
        if (local) {
          let parsed = JSON.parse(local);
          if (typeof parsed === 'string') parsed = JSON.parse(parsed);
          return parsed;
        }
        return null;
      })
      .then(parsed => {
        if (parsed && parsed.db && Object.keys(parsed.db).length > 0) {
          setPropertiesDb(parsed.db || {});
          if (parsed.states) setStatesList(parsed.states);
          if (parsed.updateDates) setUpdateDates(prev => ({ ...prev, ...parsed.updateDates }));
        } else {
          setPropertiesDb(initialCaixaData.db || {});
          setStatesList(initialCaixaData.states || ['DF', 'GO']);
        }
      })
      .catch(e => console.error('Falha ao carregar propriedades da Caixa do BD', e));
  }, []);

  const saveToDb = (db: Record<string, Property[]>, states: string[], newDates?: Record<string, string>) => {
    const datesToSave = newDates || updateDates;
    setPropertiesDb(db);
    setStatesList(states);
    setUpdateDates(datesToSave);
    
    const dataString = JSON.stringify({ db, states, updateDates: datesToSave });
    
    // Tenta salvar no MySQL via API PHP
    fetch('/api.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ruth_dias_properties', value: dataString })
    }).catch(e => console.log('Sincronização com MySQL falhou.', e));
    
    // Fallback: Salva no localStorage para testes locais
    localStorage.setItem('ruth_dias_properties', dataString);
  };

  const handleAddState = () => {
    if (newStateName.trim() && !statesList.includes(newStateName.toUpperCase())) {
      const newStates = [...statesList, newStateName.toUpperCase()];
      saveToDb({ ...propertiesDb, [newStateName.toUpperCase()]: [] }, newStates);
      setSelectedState(newStateName.toUpperCase());
    }
    setIsAddingState(false);
    setNewStateName('');
  };

  const processFile = (file: File) => {
    setLoading(true);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      delimiter: ';',
      encoding: 'ISO-8859-1', // Comum em planilhas da Caixa
      complete: (results) => {
        const rows = results.data as string[][];
        let startIndex = 0;
        
        for (let i = 0; i < rows.length; i++) {
          if (rows[i][0] && rows[i][0].includes('N') && rows[i][0].includes('im')) {
            startIndex = i + 1; // Dados começam após o cabeçalho
            break;
          }
        }

        if (startIndex === 0) startIndex = 2;

        const parsedProperties: Property[] = [];

        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 11 && row[0].trim() !== '') {
            parsedProperties.push({
              id: row[0].trim(),
              uf: row[1]?.trim() || '',
              city: row[2]?.trim() || '',
              neighborhood: row[3]?.trim() || '',
              address: row[4]?.trim() || '',
              price: row[5]?.trim() || '',
              appraisalValue: row[6]?.trim() || '',
              discount: row[7]?.trim() || '',
              financing: row[8]?.trim() || '',
              description: row[9]?.trim() || '',
              saleType: row[10]?.trim() || '',
              link: row[11]?.trim() || '',
            });
          }
        }

        const today = new Date().toLocaleDateString('pt-BR');
        const newDates = { ...updateDates, [selectedState]: today };
        saveToDb({ ...propertiesDb, [selectedState]: parsedProperties }, statesList, newDates);
        setLoading(false);
      },
      error: (error) => {
        console.error('Erro ao processar CSV:', error);
        setLoading(false);
        Swal.fire('Erro', 'Erro ao processar o arquivo. Verifique se é um CSV válido da Caixa.', 'error');
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.csv')) {
        processFile(file);
      } else {
        Swal.fire('Formato Incorreto', 'Por favor, envie apenas arquivos com a extensão .csv.', 'error');
      }
    }
  };



  const currentProperties = propertiesDb[selectedState] || [];
  
  const filteredProperties = currentProperties.filter(prop => {
    const matchesSearch = 
      prop.city.toLowerCase().includes(searchTerm.toLowerCase()) || 
      prop.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prop.price.includes(searchTerm);
    
    const matchesDiscount = filterDiscount ? parseFloat(prop.discount) >= parseFloat(filterDiscount) : true;
    const matchesSaleType = filterSaleType ? prop.saleType.toLowerCase().includes(filterSaleType.toLowerCase()) : true;
    const matchesType = filterType ? prop.description.toLowerCase().includes(filterType.toLowerCase()) : true;
    
    const propPrice = parseFloat(prop.price.replace(/\./g, '').replace(',', '.')) || 0;
    const minPrice = filterPriceMin ? parseFloat(filterPriceMin) : 0;
    const maxPrice = filterPriceMax ? parseFloat(filterPriceMax) : Infinity;
    const matchesPrice = propPrice >= minPrice && propPrice <= maxPrice;

    return matchesSearch && matchesDiscount && matchesSaleType && matchesType && matchesPrice;
  });

  const sortedProperties = [...filteredProperties].sort((a, b) => {
    if (!sortConfig) return 0;
    
    let aValue: any = '';
    let bValue: any = '';

    switch (sortConfig.key) {
      case 'city':
        aValue = a.city.toLowerCase();
        bValue = b.city.toLowerCase();
        break;
      case 'type':
        aValue = a.description.split(',')[0].toLowerCase();
        bValue = b.description.split(',')[0].toLowerCase();
        break;
      case 'price':
        aValue = parseFloat(a.price.replace(/\./g, '').replace(',', '.')) || 0;
        bValue = parseFloat(b.price.replace(/\./g, '').replace(',', '.')) || 0;
        break;
      case 'discount':
        aValue = parseFloat(a.discount) || 0;
        bValue = parseFloat(b.discount) || 0;
        break;
      case 'saleType':
        aValue = a.saleType.toLowerCase();
        bValue = b.saleType.toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  return (
    <div 
      className="animate-fade-in" 
      style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.5rem', position: 'relative' }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          border: '3px dashed var(--accent-color)',
          borderRadius: 'var(--radius-md)',
          margin: '0.2rem',
          transition: 'all 0.3s ease',
          pointerEvents: 'none'
        }}>
          <UploadCloud size={64} style={{ color: 'var(--accent-color)', marginBottom: '1.5rem', animation: 'bounce 1s infinite' }} />
          <h2 style={{ color: 'white', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Solte o arquivo para importar</h2>
          <p style={{ color: '#94a3b8' }}>Atualizando imóveis do estado: <strong>{selectedState}</strong></p>
          <style>{`
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
          `}</style>
        </div>
      )}
      <div className="caixa-header-mobile" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div className="desktop-only">
          <h1 style={{ fontSize: '1.25rem', marginBottom: 0 }}>Imóveis Caixa</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {statesList.map(st => (
            <button 
              key={st}
              onClick={() => setSelectedState(st)}
              className={`btn ${selectedState === st ? 'btn-primary' : 'btn-outline'}`}
              style={{ minWidth: '60px', flex: '1 1 auto', maxWidth: '100px' }}
            >
              {st}
            </button>
          ))}
          {isAddingState ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="UF" 
                maxLength={2}
                style={{ width: '80px', textTransform: 'uppercase' }}
                value={newStateName}
                onChange={e => setNewStateName(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddState()}
              />
              <button className="btn btn-primary" onClick={handleAddState}>Salvar</button>
              <button className="btn btn-ghost" onClick={() => setIsAddingState(false)}><X size={18} /></button>
            </div>
          ) : (
            <button className="btn btn-outline" onClick={() => setIsAddingState(true)} title="Adicionar Novo Estado" style={{ flex: '1 1 auto', maxWidth: '120px' }}>
              <Plus size={18} /> Novo UF
            </button>
          )}
        </div>
      </div>

      {!currentProperties.length && !loading && (
        <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <label className="upload-zone" style={{ width: '100%', maxWidth: '600px' }}>
            <input 
              type="file" 
              accept=".csv" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
            <UploadCloud className="upload-icon" />
            <div className="upload-title">Base vazia para {selectedState}</div>
            <div className="upload-desc">Clique para enviar ou arraste a lista CSV atualizada aqui.</div>
          </label>
        </div>
      )}

      {loading && (
        <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p>Processando lista de imóveis...</p>
          </div>
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}

      {currentProperties.length > 0 && !loading && (
        <>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '150px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Buscar (cidade, preço)..." 
                    style={{ paddingLeft: '2.2rem', width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.2rem', fontSize: '0.9rem' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'}`}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={16} />
                  Filtros
                </button>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <span className="desktop-only" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <strong>{filteredProperties.length}</strong> imóveis
                </span>
                <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  <UploadCloud size={16} />
                  <span className="desktop-only">Atualizar Lista</span>
                  <span className="mobile-only" style={{ display: 'none' }}>Atualizar</span>
                  <input 
                    type="file" 
                    accept=".csv" 
                    style={{ display: 'none' }} 
                    onChange={handleFileUpload} 
                  />
                </label>
              </div>
            </div>

            {/* Painel de Filtros Avançados */}
            {showFilters && (
              <div className="animate-fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Desconto Mínimo (%)</label>
                  <select className="input" value={filterDiscount} onChange={e => setFilterDiscount(e.target.value)}>
                    <option value="">Qualquer desconto</option>
                    <option value="10">Acima de 10%</option>
                    <option value="20">Acima de 20%</option>
                    <option value="30">Acima de 30%</option>
                    <option value="40">Acima de 40%</option>
                    <option value="50">Acima de 50%</option>
                    <option value="60">Acima de 60%</option>
                    <option value="70">Acima de 70%</option>
                    <option value="80">Acima de 80%</option>
                    <option value="90">Acima de 90%</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Modalidade</label>
                  <select className="input" value={filterSaleType} onChange={e => setFilterSaleType(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="venda direta">Venda Direta</option>
                    <option value="licitação aberta">Licitação Aberta / Leilão</option>
                    <option value="licitação fechada">Licitação Fechada</option>
                    <option value="venda online">Venda Online</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Tipo de Imóvel</label>
                  <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">Todos</option>
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                    <option value="terreno">Terreno</option>
                    <option value="sala">Sala</option>
                    <option value="loja">Loja</option>
                    <option value="gleba">Gleba</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 300px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Preço (R$)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="number" className="input" placeholder="Mínimo" value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)} />
                    <input type="number" className="input" placeholder="Máximo" value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: '0.5rem' }}>
                  <button className="btn btn-ghost" onClick={() => { setFilterDiscount(''); setFilterSaleType(''); setFilterType(''); setFilterPriceMin(''); setFilterPriceMax(''); setSearchTerm(''); }}>
                    Limpar Filtros
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="data-table-wrapper" style={{ flex: 1, overflow: 'auto' }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th onClick={() => handleSort('city')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Cidade / Bairro {getSortIcon('city')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('type')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Tipo {getSortIcon('type')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('price')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Preço {getSortIcon('price')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('discount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Desconto {getSortIcon('discount')}
                    </div>
                  </th>
                  <th onClick={() => handleSort('saleType')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Modalidade {getSortIcon('saleType')}
                    </div>
                  </th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedProperties.map((prop, i) => {
                  const modColor = getModalidadeColor(prop.saleType);
                  return (
                    <tr key={prop.id || i}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{prop.city}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{prop.neighborhood}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prop.description}>
                          {prop.description.split(',')[0]}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--accent-color)' }}>R$ {prop.price}</div>
                        <div style={{ fontSize: '0.75rem', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>R$ {prop.appraisalValue}</div>
                      </td>
                      <td>
                        <span style={{ backgroundColor: 'var(--success)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                          {prop.discount}%
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          padding: '0.3rem 0.6rem', 
                          backgroundColor: modColor.bg, 
                          color: modColor.text,
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          {prop.saleType}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            onClick={() => setSelectedProperty(prop)}
                          >
                            <Share2 size={14} /> Detalhes
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', gap: '0.25rem' }}
                            onClick={() => navigate(`/mapa?id=${prop.id}`)}
                          >
                            <MapPin size={14} /> Ver no Mapa
                          </button>
                          <a href={prop.link} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                            Ver Edital
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}



      {/* Modal de Detalhes e Compartilhamento */}
      {selectedProperty && (
        <CaixaShareModal 
          property={selectedProperty} 
          onClose={() => setSelectedProperty(null)} 
        />
      )}
    </div>
  );
};

export default CaixaProperties;
