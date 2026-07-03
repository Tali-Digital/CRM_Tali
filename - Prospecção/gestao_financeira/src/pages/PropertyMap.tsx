import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import CaixaShareModal from '../components/CaixaShareModal';
const L = (window as any).L;

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

const REGION_COORDINATES: Record<string, [number, number]> = {
  // Distrito Federal
  'BRASILIA': [-15.7975, -47.8860],
  'SAMAMBAIA': [-15.8906, -48.0872],
  'CEILANDIA': [-15.8202, -48.1156],
  'TAGUATINGA': [-15.8339, -48.0567],
  'SOBRADINHO': [-15.6569, -47.7944],
  'PLANALTINA': [-15.6178, -47.6908],
  'GUARA': [-15.8172, -47.9794],
  'GAMA': [-16.0195, -48.0678],
  'RECANTO DAS EMAS': [-15.9011, -48.1402],
  'SANTA MARIA': [-16.0142, -47.9839],
  'RIACHO FUNDO': [-15.8837, -48.0163],
  'AGUAS CLARAS': [-15.8398, -48.0264],
  'SUDOESTE': [-15.7997, -47.9255],
  'OCTOGONAL': [-15.7997, -47.9255],
  'CRUZEIRO': [-15.7891, -47.9409],
  'LAGO NORTE': [-15.7483, -47.8488],
  'LAGO SUL': [-15.8458, -47.8687],
  'PARANOA': [-15.7725, -47.7772],
  'SAO SEBASTIAO': [-15.9125, -47.7733],
  'NUCLEO BANDEIRANTE': [-15.8728, -47.9678],
  'VICENTE PIRES': [-15.8078, -48.0292],

  // Goiás - Cidades
  'GOIANIA': [-16.6869, -49.2648],
  'APARECIDA DE GOIAS': [-16.8231, -49.2458],
  'APARECIDA DE GOIANIA': [-16.8231, -49.2458],
  'ANAPOLIS': [-16.3267, -48.9528],
  'RIO VERDE': [-17.7915, -50.9213],
  'LUZIANIA': [-16.2522, -47.9503],
  'AGUAS LINDAS DE GOIAS': [-15.7608, -48.2831],
  'VALPARAISO DE GOIAS': [-16.0683, -47.9767],
  'TRINDADE': [-16.6494, -49.4933],
  'FORMOSA': [-15.5397, -47.3347],
  'NOVO GAMA': [-16.0592, -48.0417],
  'SENADOR CANEDO': [-16.7083, -49.1122],
  'CATALAO': [-18.1706, -47.9428],
  'ITUMBIARA': [-18.4203, -49.2183],
  'JATAI': [-17.8814, -51.7144],
  'CALDAS NOVAS': [-17.7419, -48.6253],
  'PLANALTINA DE GOIAS': [-15.4542, -47.6167],
  'SANTO ANTONIO DO DESCOBERTO': [-15.9406, -48.2575],
  'ABADIA DE GOIAS': [-16.7572, -49.4386],
  'ABADIANIA': [-16.2042, -48.7069],
};

const STATE_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  'DF': { center: [-15.7975, -47.8860], zoom: 11 },
  'GO': { center: [-16.3267, -48.9528], zoom: 8 }
};

// Helpers para cache de geolocalização no localStorage
const getGeoCache = (): Record<string, [number, number]> => {
  try {
    return JSON.parse(localStorage.getItem('ruth_dias_geo_cache') || '{}');
  } catch {
    return {};
  }
};

const saveGeoCache = (cache: Record<string, [number, number]>) => {
  localStorage.setItem('ruth_dias_geo_cache', JSON.stringify(cache));
};

const applyJitter = (coords: [number, number], id: string): [number, number] => {
  const seed = parseInt(id.replace(/\D/g, '').substring(0, 6) || '0') || 123;
  const hashLat = Math.sin(seed) * 10000;
  const hashLng = Math.cos(seed) * 10000;
  
  // Jitter reduzido para manter o pin mais próximo da coordenada real (cerca de 500m)
  const jitterLat = (hashLat - Math.floor(hashLat) - 0.5) * 0.008;
  const jitterLng = (hashLng - Math.floor(hashLng) - 0.5) * 0.008;

  return [coords[0] + jitterLat, coords[1] + jitterLng];
};

// Gera coordenadas determinísticas baseadas no ID do imóvel para evitar empilhamento perfeito
const getPropertyCoordinates = (prop: Property, cache: Record<string, [number, number]>): [number, number] | null => {
  const uf = prop.uf.trim().toUpperCase();
  const city = prop.city.trim().toUpperCase();
  const neighborhood = prop.neighborhood.trim().toUpperCase();
  const cacheKey = `${uf}:${city}:${neighborhood}`;

  // 1. Tenta buscar no cache dinâmico da API Nominatim
  if (cache[cacheKey]) {
    return applyJitter(cache[cacheKey], prop.id);
  }

  // 2. Fallback para dicionário estático regional
  let baseCoords: [number, number] | undefined;

  if (uf === 'DF') {
    // No DF, buscamos por bairro (Região Administrativa)
    for (const key of Object.keys(REGION_COORDINATES)) {
      if (neighborhood.includes(key) || key.includes(neighborhood)) {
        baseCoords = REGION_COORDINATES[key];
        break;
      }
    }
    // Fallback para Brasília se não achar o bairro específico
    if (!baseCoords) baseCoords = REGION_COORDINATES['BRASILIA'];
  } else {
    // Em GO, buscamos por cidade
    for (const key of Object.keys(REGION_COORDINATES)) {
      if (city.includes(key) || key.includes(city)) {
        baseCoords = REGION_COORDINATES[key];
        break;
      }
    }
    // Fallback para Goiânia se não achar a cidade
    if (!baseCoords) baseCoords = REGION_COORDINATES['GOIANIA'];
  }

  if (!baseCoords) {
    const stateConfig = STATE_CENTERS[uf];
    if (stateConfig) baseCoords = stateConfig.center;
  }

  if (!baseCoords) return null;

  return applyJitter(baseCoords, prop.id);
};

const PropertyMap = () => {
  const location = useLocation();
  const focusId = useMemo(() => {
    return new URLSearchParams(location.search).get('id');
  }, [location.search]);

  const [propertiesDb, setPropertiesDb] = useState<Record<string, Property[]>>({});
  const [selectedState, setSelectedState] = useState<string>('DF');
  const [statesList, setStatesList] = useState<string[]>(['DF', 'GO']);
  const [updateDates, setUpdateDates] = useState<Record<string, string>>({
    'DF': '23/06/2026',
    'GO': 'Aguardando atualização'
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filtros
  const [minDiscount, setMinDiscount] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [radarMode, setRadarMode] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [visibleProperties, setVisibleProperties] = useState<Property[]>([]);
  const [geoCache, setGeoCache] = useState<Record<string, [number, number]>>(() => getGeoCache());

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  // Carrega do localStorage/DB
  useEffect(() => {
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
        if (parsed) {
          setPropertiesDb(parsed.db || {});
          if (parsed.states) setStatesList(parsed.states);
          if (parsed.updateDates) setUpdateDates(prev => ({ ...prev, ...parsed.updateDates }));
        }
      })
      .catch(e => console.error("Erro ao carregar dados pro mapa:", e));
  }, []);

  // Efeito de geocodificação dinâmica em background (limite de 1 requisicao por 1.2s para bom comportamento da API Nominatim)
  useEffect(() => {
    const uniqueLocations: { uf: string; city: string; neighborhood: string; key: string }[] = [];
    const keysSeen = new Set<string>();

    Object.values(propertiesDb).forEach(list => {
      list.forEach(prop => {
        const uf = prop.uf.trim().toUpperCase();
        const city = prop.city.trim().toUpperCase();
        const neighborhood = prop.neighborhood.trim().toUpperCase();
        const key = `${uf}:${city}:${neighborhood}`;

        if (!keysSeen.has(key) && !geoCache[key]) {
          keysSeen.add(key);
          uniqueLocations.push({ uf, city, neighborhood, key });
        }
      });
    });

    if (uniqueLocations.length === 0) return;

    let isMounted = true;
    let index = 0;

    const geocodeNext = async () => {
      if (!isMounted || index >= uniqueLocations.length) return;
      
      const loc = uniqueLocations[index];
      
      // Query do Nominatim (Bairro, Cidade, Estado, Brasil)
      let query = '';
      if (loc.uf === 'DF') {
        query = `${loc.neighborhood}, Brasilia, DF, Brazil`;
      } else {
        query = `${loc.neighborhood}, ${loc.city}, ${loc.uf}, Brazil`;
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Ruth-Dias-Sistema-Imobiliario'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            
            const currentCache = getGeoCache();
            const newCache = { ...currentCache, [loc.key]: [lat, lon] as [number, number] };
            saveGeoCache(newCache);
            if (isMounted) {
              setGeoCache(newCache);
            }
          } else {
            // Fallback: Tenta geocodificar apenas com a Cidade se falhar com Bairro + Cidade
            const fallbackQuery = loc.uf === 'DF' ? 'Brasilia, DF, Brazil' : `${loc.city}, ${loc.uf}, Brazil`;
            const fallbackResponse = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}&limit=1`,
              {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Ruth-Dias-Sistema-Imobiliario'
                }
              }
            );
            if (fallbackResponse.ok) {
              const fbData = await fallbackResponse.json();
              if (fbData && fbData.length > 0) {
                const lat = parseFloat(fbData[0].lat);
                const lon = parseFloat(fbData[0].lon);
                
                const currentCache = getGeoCache();
                const newCache = { ...currentCache, [loc.key]: [lat, lon] as [number, number] };
                saveGeoCache(newCache);
                if (isMounted) {
                  setGeoCache(newCache);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Erro na geocodificação Nominatim:', err);
      }

      index++;
      setTimeout(geocodeNext, 1200);
    };

    geocodeNext();

    return () => {
      isMounted = false;
    };
  }, [propertiesDb, geoCache]);

  // Efeito para focar em um imóvel específico se houver query param `id` na URL
  useEffect(() => {
    if (!focusId || Object.keys(propertiesDb).length === 0 || !mapRef.current) return;

    let foundProp: Property | null = null;
    let foundUf = '';

    for (const [uf, list] of Object.entries(propertiesDb)) {
      const match = list.find(p => p.id === focusId);
      if (match) {
        foundProp = match;
        foundUf = uf;
        break;
      }
    }

    if (foundProp) {
      // 1. Muda a UF se for diferente
      if (selectedState !== foundUf) {
        setSelectedState(foundUf);
        const config = STATE_CENTERS[foundUf];
        if (config) {
          mapRef.current.setView(config.center, config.zoom);
        }
      }

      // 2. Calcula as coordenadas do imóvel
      const coords = getPropertyCoordinates(foundProp, geoCache);
      if (coords) {
        // Pequeno delay para garantir que o mapa e os pins foram desenhados na tela
        setTimeout(() => {
          if (!mapRef.current) return;
          mapRef.current.setView(coords, 16);
          
          markersLayerRef.current?.eachLayer((layer: any) => {
            if (layer.getLatLng().lat === coords[0] && layer.getLatLng().lng === coords[1]) {
              layer.openPopup();
            }
          });
        }, 600);
      }
    }
  }, [focusId, propertiesDb, geoCache]);

  // Filtra propriedades baseado nos filtros do formulário
  const filteredProperties = useMemo(() => {
    const list = propertiesDb[selectedState] || [];
    return list.map(p => ({
      ...p,
      coords: getPropertyCoordinates(p, geoCache)
    })).filter(prop => {
      if (!prop.coords) return false;
      
      const priceVal = parseFloat(prop.price.replace(/\./g, '').replace(',', '.'));
      const discountVal = parseFloat(prop.discount);

      const matchesSearch = 
        prop.city.toLowerCase().includes(searchTerm.toLowerCase()) || 
        prop.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prop.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDiscount = minDiscount ? discountVal >= parseFloat(minDiscount) : true;
      const matchesPrice = maxPrice ? priceVal <= parseFloat(maxPrice) * 1000 : true;

      return matchesSearch && matchesDiscount && matchesPrice;
    }) as (Property & { coords: [number, number] })[];
  }, [propertiesDb, selectedState, searchTerm, minDiscount, maxPrice, geoCache]);

  // Inicializa e atualiza o mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Se o mapa não foi criado, inicializa
    if (!mapRef.current) {
      const config = STATE_CENTERS[selectedState] || STATE_CENTERS['DF'];
      
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false // Vamos adicionar o controle de zoom em posição customizada
      }).setView(config.center, config.zoom);

      // Adiciona blocos de mapas elegantes (Slick light-mode de CartoDB)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapRef.current);

      L.control.zoom({
        position: 'topright'
      }).addTo(mapRef.current);

      // Cria a layer de marcadores
      markersLayerRef.current = L.featureGroup().addTo(mapRef.current);

      // Listener para atualizar a lista lateral quando mover o mapa
      const updateVisibleList = () => {
        if (!mapRef.current || !filteredProperties.length) return;
        const bounds = mapRef.current.getBounds();
        
        const inBounds = filteredProperties.filter(prop => {
          return bounds.contains(L.latLng(prop.coords));
        });
        
        setVisibleProperties(inBounds);
      };

      mapRef.current.on('moveend', updateVisibleList);
      mapRef.current.on('zoomend', updateVisibleList);
    }

    return () => {
      // Cleanup no unmount
      if (mapRef.current) {
        mapRef.current.off();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedState]);

  // Atualiza os marcadores no mapa sempre que as propriedades filtradas mudarem
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    // Limpa marcadores anteriores
    markersLayerRef.current.clearLayers();

    if (filteredProperties.length === 0) {
      setVisibleProperties([]);
      return;
    }

    filteredProperties.forEach(prop => {
      // Formata preço amigável, ex: 246k ao invés de 246.832,25
      const priceVal = parseFloat(prop.price.replace(/\./g, '').replace(',', '.'));
      let priceLabel = '';
      if (priceVal >= 1000000) {
        priceLabel = `${(priceVal / 1000000).toFixed(1)}M`;
      } else {
        priceLabel = `${Math.round(priceVal / 1000)}k`;
      }

      // Lógica de "Mapa de Calor" - Cor baseada no desconto
      const discountVal = parseFloat(prop.discount);
      let bgColor = 'var(--primary-color)';
      let borderColor = 'var(--accent-color)';
      let textColor = 'var(--accent-color)';
      let icon = '🏠';

      if (discountVal >= 40) {
        bgColor = '#ef4444'; // Vermelho (Quente)
        borderColor = '#7f1d1d';
        textColor = '#ffffff';
        icon = '🔥';
      } else if (discountVal >= 25) {
        bgColor = '#f59e0b'; // Laranja
        borderColor = '#92400e';
        textColor = '#ffffff';
      } else {
        bgColor = '#3b82f6'; // Azul
        borderColor = '#1e3a8a';
        textColor = '#ffffff';
      }

      // Ícone premium customizado com o valor do imóvel
      const customMarkerIcon = L.divIcon({
        className: 'custom-property-marker-wrapper',
        html: `
          <div class="custom-marker" style="
            background-color: ${bgColor};
            color: #ffffff;
            border: 2px solid ${borderColor};
            border-radius: var(--radius-sm);
            padding: 4px 8px;
            font-size: 0.75rem;
            font-weight: 600;
            box-shadow: var(--shadow-md);
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            transition: all var(--transition-normal);
            transform: translate(-50%, -50%);
            width: max-content;
          ">
            <span style="color: ${textColor};">${icon}</span> R$ ${priceLabel}
          </div>
        `
      });

      const marker = L.marker(prop.coords, { icon: customMarkerIcon });
      
      // Popup estilizado e premium do Leaflet
      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = 'var(--font-sans)';
      popupContent.style.padding = '0.5rem';
      popupContent.style.maxWidth = '250px';
      
      popupContent.innerHTML = `
        <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; font-weight: 600; color: var(--text-primary);">${prop.neighborhood}</h4>
        <p style="margin: 0 0 0.25rem 0; font-size: 0.8rem; color: var(--text-secondary);">${prop.city} - ${prop.uf}</p>
        <p style="margin: 0 0 0.5rem 0; font-size: 0.75rem; color: var(--text-secondary); line-height: 1.2;">${prop.address || 'Endereço não informado'}</p>
        
        <div style="background-color: var(--bg-tertiary); padding: 0.5rem; border-radius: 6px; margin-bottom: 0.75rem; border: 1px solid var(--border-color)">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 0.2rem;">
            <span style="color: var(--text-secondary);">Avaliação:</span>
            <span style="text-decoration: line-through;">R$ ${prop.appraisalValue}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 700;">
            <span style="color: var(--text-primary);">Preço:</span>
            <span style="color: var(--accent-color);">R$ ${prop.price}</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
          <span style="background-color: var(--success); color: white; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.75rem; fontWeight: 600;">
            -${prop.discount}% desc.
          </span>
          <button id="marker-btn-details-${prop.id}" style="
            background-color: var(--primary-color);
            color: white;
            border: none;
            padding: 0.3rem 0.6rem;
            border-radius: 4px;
            font-size: 0.75rem;
            cursor: pointer;
            font-weight: 500;
          ">Ver Detalhes</button>
        </div>
      `;

      // Evento para abrir o modal de detalhes pelo botão do popup
      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: L.point(0, -10)
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`marker-btn-details-${prop.id}`);
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedProperty(prop);
          });
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // Centraliza o mapa no grupo de marcadores ou no centro do estado
    if (filteredProperties.length > 0 && mapRef.current) {
      const bounds = markersLayerRef.current.getBounds();
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }

    // Atualiza a lista inicial
    setTimeout(() => {
      if (mapRef.current && markersLayerRef.current) {
        const bounds = mapRef.current.getBounds();
        const inBounds = filteredProperties.filter(prop => bounds.contains(L.latLng(prop.coords)));
        setVisibleProperties(inBounds);
      }
    }, 300);

  }, [filteredProperties]);

  const handleStateChange = (state: string) => {
    setSelectedState(state);
    if (mapRef.current) {
      const config = STATE_CENTERS[state] || STATE_CENTERS['DF'];
      mapRef.current.setView(config.center, config.zoom);
    }
  };

  const handlePropertyClick = (prop: Property & { coords: [number, number] }) => {
    if (!mapRef.current) return;
    mapRef.current.setView(prop.coords, 16);
    
    // Procura o marker correspondente e abre o popup
    markersLayerRef.current?.eachLayer((layer: any) => {
      if (layer.getLatLng().lat === prop.coords[0] && layer.getLatLng().lng === prop.coords[1]) {
        layer.openPopup();
      }
    });
  };



  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem' }}>
      
      {/* Filtros e Seleção de Estado */}
      <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {statesList.map(st => (
              <button 
                key={st}
                onClick={() => handleStateChange(st)}
                className={`btn ${selectedState === st ? 'btn-primary' : 'btn-outline'}`}
                style={{ minWidth: '60px', padding: '0.5rem 0.75rem' }}
              >
                {st}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', paddingLeft: '0.5rem' }}>
            {updateDates[selectedState] ? (
              updateDates[selectedState] === 'Aguardando atualização' ? (
                <span style={{ color: '#ef4444' }}>Aguardando atualização da lista</span>
              ) : (
                <>Lista atualizada em: <strong>{updateDates[selectedState]}</strong></>
              )
            ) : (
              <span style={{ opacity: 0.7 }}>Data de atualização não informada</span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'flex-end' }}>
            
            {/* Busca por texto */}
            <div style={{ position: 'relative', minWidth: '180px', flex: '1 1 auto', maxWidth: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                className="input" 
                placeholder="Buscar (cidade, bairro)..." 
                style={{ paddingLeft: '2.2rem', padding: '0.45rem 0.45rem 0.45rem 2.2rem', fontSize: '0.85rem' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Botão Radar de Oportunidades */}
            <button
              className={`btn ${radarMode ? 'btn-primary' : 'btn-outline'}`}
              style={{ 
                padding: '0.45rem 0.75rem', 
                fontSize: '0.85rem',
                backgroundColor: radarMode ? '#ef4444' : 'transparent',
                borderColor: radarMode ? '#ef4444' : 'var(--border-color)',
                color: radarMode ? 'white' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onClick={() => {
                const newMode = !radarMode;
                setRadarMode(newMode);
                if (newMode) {
                  setMinDiscount('40');
                  setMaxPrice('200');
                } else {
                  setMinDiscount('');
                  setMaxPrice('');
                }
              }}
            >
              🔥 Radar de Oportunidades
            </button>

            {/* Desconto Mínimo */}
            <select 
              className="input" 
              style={{ width: 'auto', minWidth: '130px', padding: '0.45rem', fontSize: '0.85rem' }}
              value={minDiscount}
              onChange={e => { setMinDiscount(e.target.value); setRadarMode(false); }}
            >
              <option value="">Qualquer desc.</option>
              <option value="20">Mínimo 20%</option>
              <option value="30">Mínimo 30%</option>
              <option value="40">Mínimo 40%</option>
              <option value="50">Mínimo 50%</option>
              <option value="60">Mínimo 60%</option>
            </select>

            {/* Preço Máximo */}
            <select 
              className="input" 
              style={{ width: 'auto', minWidth: '130px', padding: '0.45rem', fontSize: '0.85rem' }}
              value={maxPrice}
              onChange={e => { setMaxPrice(e.target.value); setRadarMode(false); }}
            >
              <option value="">Qualquer preço</option>
              <option value="100">Até R$ 100k</option>
              <option value="150">Até R$ 150k</option>
              <option value="200">Até R$ 200k</option>
              <option value="300">Até R$ 300k</option>
              <option value="500">Até R$ 500k</option>
              <option value="1000">Até R$ 1M</option>
            </select>

          </div>
        </div>
      </div>

      {/* Área Principal: Mapa + Lista Lateral */}
      <div style={{ flex: 1, display: 'flex', gap: '0.75rem', height: '100%', minHeight: '450px', position: 'relative' }}>
        
        {/* Container do Mapa */}
        <div className="card" style={{ flex: 2, padding: 0, overflow: 'hidden', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
          
          {/* Legenda de quantidade */}
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            backgroundColor: 'var(--bg-secondary)',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            fontSize: '0.8rem',
            fontWeight: 600,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-color)' }} />
            <span>{filteredProperties.length} imóveis no estado</span>
          </div>
        </div>

        {/* Lista Lateral de Imóveis Visíveis (Desktop) */}
        <div className="card desktop-only" style={{
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 0.5rem 1rem 1rem',
          gap: '0.75rem'
        }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem', paddingRight: '0.5rem' }}>
            Na tela do mapa ({visibleProperties.length})
          </h3>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.5rem' }}>
            {visibleProperties.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                <MapPin size={28} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.85rem' }}>Mova ou aproxime o mapa para encontrar imóveis nesta região.</p>
              </div>
            ) : (
              visibleProperties.map((prop) => (
                <div 
                  key={prop.id}
                  onClick={() => handlePropertyClick(prop as any)}
                  style={{
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-normal)',
                    backgroundColor: 'var(--bg-secondary)'
                  }}
                  className="nav-item-map-card"
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{prop.neighborhood}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{prop.city} - {prop.uf}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prop.address || 'Endereço não informado'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-color)', fontSize: '0.95rem' }}>R$ {prop.price}</span>
                    <span style={{ backgroundColor: 'var(--success)', color: 'white', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                      -{prop.discount}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Estilos dinâmicos do Leaflet para os Marcadores e Popups */}
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: var(--radius-md) !important;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-lg) !important;
          background-color: var(--bg-secondary) !important;
        }
        .leaflet-popup-tip {
          background-color: var(--bg-secondary) !important;
          border: 1px solid var(--border-color);
        }
        .custom-property-marker-wrapper {
          border: none !important;
          background: transparent !important;
          width: 0 !important;
          height: 0 !important;
        }
        .custom-marker:hover {
          transform: translate(-50%, -50%) scale(1.1) !important;
          border-color: #ffffff !important;
          background-color: var(--accent-color) !important;
          color: var(--primary-color) !important;
        }
        .nav-item-map-card:hover {
          border-color: var(--accent-color) !important;
          box-shadow: var(--shadow-sm);
          background-color: var(--bg-tertiary) !important;
        }
      `}</style>



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

export default PropertyMap;
