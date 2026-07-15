import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import { subscribeToProspects, updateProspect } from '../services/firestoreService';
import { Prospect } from '../types';
import { Map as MapIcon, Search, User, Navigation, CheckCircle2, Copy, RefreshCw, Filter, MapPin, X, Route } from 'lucide-react';
import Swal from 'sweetalert2';
import { auth } from '../firebase';
// Custom Icons
const pendingIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const deliveredIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const selectedIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export const RotaProspeccaoView = ({ companyId }: { companyId: string }) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocodingProgress, setGeocodingProgress] = useState<{current: number, total: number} | null>(null);
  
  // Filters
  const getSavedFilter = (key: string, defaultValue: any) => {
    try {
      const uid = auth?.currentUser?.uid || 'guest';
      const saved = localStorage.getItem(`rota_filters_${uid}_${key}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return defaultValue;
  };

  const [searchLocation, setSearchLocation] = useState<string>(() => getSavedFilter('searchLocation', ''));
  const [selectedResponsible, setSelectedResponsible] = useState<string>(() => getSavedFilter('selectedResponsible', ''));
  const [showDelivered, setShowDelivered] = useState<boolean>(() => getSavedFilter('showDelivered', false));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedCities, setSelectedCities] = useState<string[]>(() => getSavedFilter('selectedCities', []));
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [citySearchTerm, setCitySearchTerm] = useState('');
  
  // Route Selection
  const [isRouteSelectionMode, setIsRouteSelectionMode] = useState(false);
  const [selectedRoutePoints, setSelectedRoutePoints] = useState<Prospect[]>([]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid || 'guest';
    localStorage.setItem(`rota_filters_${uid}_searchLocation`, JSON.stringify(searchLocation));
    localStorage.setItem(`rota_filters_${uid}_selectedResponsible`, JSON.stringify(selectedResponsible));
    localStorage.setItem(`rota_filters_${uid}_showDelivered`, JSON.stringify(showDelivered));
    localStorage.setItem(`rota_filters_${uid}_selectedCities`, JSON.stringify(selectedCities));
  }, [searchLocation, selectedResponsible, showDelivered, selectedCities]);

  useEffect(() => {
    if (!companyId) return;
    const unsubscribe = subscribeToProspects(companyId, (data) => {
      setProspects(data.filter(p => (p.isInPerson || p.hasPresencialFicha) && !p.isDeleted));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [companyId]);

  const geocodingRef = useRef(false);

  // Background geocoding for prospects without lat/lng
  useEffect(() => {
    const geocodeMissing = async () => {
      if (geocodingRef.current) return;
      
      const missing = prospects.filter(p => p.fullAddress && p.fullAddress.trim() !== '' && !p.geocodeFailed && (!p.lat || !p.lng || p.lng > 0));
      if (missing.length === 0) return;
      
      geocodingRef.current = true;
      setGeocodingProgress({ current: 0, total: missing.length });
      
      let processed = 0;
      for (const p of missing) {
        processed++;
        setGeocodingProgress({ current: processed, total: missing.length });
        try {
          await new Promise(r => setTimeout(r, 2000));
          
          const tryGeocode = async (query: string) => {
            try {
              const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(query)}&maxLocations=1`);
              const data = await response.json();
              if (data && data.candidates && data.candidates.length > 0) {
                return {
                  lat: data.candidates[0].location.y,
                  lng: data.candidates[0].location.x
                };
              }
            } catch (e) {
              console.error("Geocode error", e);
            }
            return null;
          };

          let coords = null;
          
          if (p.fullAddress && p.fullAddress.trim() !== '') {
            coords = await tryGeocode(p.fullAddress);
            
            // Clean Brazilian complex addresses (Quadra, Lote, Lt, Qd, etc)
            // e.g., "Avenida Comercial, Quadra 06 - Lote 28 - Valparaizo II, Valparaíso de Goiás - GO"
            if (!coords) {
              const cleanedAddress = p.fullAddress
                .replace(/(?:Quadra|Qd|Q\.|Lote|Lt|L\.|Bloco|Bl|Sala|Sl|Loja|Lg|Conjunto|Cj)[^\,\-]+(?:,|-)?/gi, '')
                .replace(/\s{2,}/g, ' ') // remove extra spaces
                .replace(/,\s*,/g, ',') // remove empty commas
                .replace(/-\s*-/g, '-') // remove double dashes
                .replace(/,\s*-/g, ' -')
                .trim();
                
              // Only try again if the address was actually changed
              if (cleanedAddress !== p.fullAddress.trim()) {
                await new Promise(r => setTimeout(r, 1500));
                coords = await tryGeocode(cleanedAddress);
              }
            }
          }
          
          if (!coords && p.location) {
            // Fallback to simpler location if full address fails
            await new Promise(r => setTimeout(r, 1500));
            coords = await tryGeocode(p.location);

            // Third fallback: Regex to extract just City and State (e.g. "Valparaíso de Goiás, GO")
            if (!coords) {
              const match = p.location.match(/([^,]+)\s*-\s*([A-Z]{2})/i);
              if (match) {
                await new Promise(r => setTimeout(r, 1500));
                const cityState = `${match[1].trim()}, ${match[2]}`;
                coords = await tryGeocode(cityState);
              }
            }
          }

          if (coords) {
            await updateProspect(p.id, { lat: coords.lat, lng: coords.lng, geocodeFailed: false });
          } else {
            // Mark as failed so it doesn't loop forever
            await updateProspect(p.id, { geocodeFailed: true });
          }

          // Small delay to respect API limits
          await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
          console.error('Erro ao geocodificar', p.fullAddress, error);
        }
      }
      
      geocodingRef.current = false;
      setGeocodingProgress(null);
    };
    
    // Only run if we have missing prospects and not currently geocoding
    if (prospects.some(p => p.fullAddress && p.fullAddress.trim() !== '' && !p.geocodeFailed && (!p.lat || !p.lng || p.lng > 0))) {
      geocodeMissing();
    }
  }, [prospects, isRetrying]);

  const responsibles = useMemo(() => {
    const resps = new Set(prospects.map(p => p.responsible).filter(Boolean));
    return Array.from(resps);
  }, [prospects]);

  const availableCities = useMemo(() => {
    const cityMap = new Map<string, string>();
    prospects.forEach(p => {
      if (!p.isEntregue && p.location) {
        const match = p.location.match(/^([^,-]+)/);
        const rawCity = match ? match[1].trim() : p.location.trim();
        const normCity = rawCity.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        
        if (!cityMap.has(normCity)) {
          cityMap.set(normCity, rawCity);
        } else {
          // Prefere a versão com acentos/capitalizada
          if (rawCity !== normCity && cityMap.get(normCity) === normCity) {
            cityMap.set(normCity, rawCity);
          }
        }
      }
    });
    return Array.from(cityMap.values()).sort();
  }, [prospects]);

  const filteredProspects = useMemo(() => {
    const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const normalizedSelectedCities = selectedCities.map(normalizeString);
    
    const filtered = prospects.filter(p => {
      const matchDelivery = showDelivered ? true : !p.isEntregue;
      const matchLocation = searchLocation === '' || (p.fullAddress && normalizeString(p.fullAddress).includes(normalizeString(searchLocation)));
      const matchResponsible = selectedResponsible === '' || p.responsible === selectedResponsible;
      
      let matchCity = true;
      if (normalizedSelectedCities.length > 0) {
        const pCityMatch = p.location ? p.location.match(/^([^,-]+)/) : null;
        const pCityRaw = pCityMatch ? pCityMatch[1].trim() : (p.location ? p.location.trim() : '');
        const pCityNorm = normalizeString(pCityRaw);
        matchCity = normalizedSelectedCities.includes(pCityNorm);
      }
      
      return matchDelivery && matchLocation && matchResponsible && matchCity && p.lat && p.lng && p.lng < 0;
    });

    // Add tiny jitter to identical coordinates so they spread out slightly instead of perfectly overlapping
    const coordsMap = new Map<string, number>();
    return filtered.map(p => {
      const key = `${p.lat},${p.lng}`;
      const count = coordsMap.get(key) || 0;
      coordsMap.set(key, count + 1);
      
      const jitterLat = count > 0 ? (Math.random() - 0.5) * 0.0015 * count : 0;
      const jitterLng = count > 0 ? (Math.random() - 0.5) * 0.0015 * count : 0;
      
      return {
        ...p,
        visualLat: p.lat! + jitterLat,
        visualLng: p.lng! + jitterLng
      };
    });
  }, [prospects, showDelivered, searchLocation, selectedResponsible, selectedCities]);

  const handleForceRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    
    // Use toast so we don't block the screen
    Swal.fire({ 
      title: 'Recalculando Rotas...', 
      text: 'Buscando os endereços em segundo plano. Você já pode usar o sistema normalmente enquanto os pinos aparecem.', 
      icon: 'info', 
      toast: true,
      position: 'top-end',
      timer: 5000,
      showConfirmButton: false 
    });
    
    // Process in batches of 10 to avoid hanging the browser
    const prospectsToUpdate = prospects.filter(p => !p.isEntregue);
    for (let i = 0; i < prospectsToUpdate.length; i += 10) {
      const batch = prospectsToUpdate.slice(i, i + 10);
      await Promise.all(batch.map(p => updateProspect(p.id, { geocodeFailed: false, lat: null, lng: null })));
    }
    
    setIsRetrying(false);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    Swal.fire({ title: 'Copiado!', text: 'Endereço copiado para a área de transferência', icon: 'success', timer: 1500, showConfirmButton: false });
  };

  const handleOpenGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const handleOpenWaze = (lat: number, lng: number) => {
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  const toggleRoutePoint = (prospect: Prospect) => {
    setSelectedRoutePoints(prev => {
      if (prev.find(p => p.id === prospect.id)) {
        return prev.filter(p => p.id !== prospect.id);
      }
      return [...prev, prospect];
    });
  };

  const handleGenerateRoute = () => {
    if (selectedRoutePoints.length === 0) return;
    
    let url = 'https://www.google.com/maps/dir/?api=1';
    const points = [...selectedRoutePoints];
    const destination = points.pop(); // Remove and get the last element
    
    if (destination) {
      url += `&destination=${destination.lat},${destination.lng}`;
    }
    
    if (points.length > 0) {
      const waypoints = points.map(p => `${p.lat},${p.lng}`).join('|');
      url += `&waypoints=${waypoints}`;
    }
    
    window.open(url, '_blank');
  };

  const center: [number, number] = filteredProspects.length > 0 
    ? [filteredProspects[0].lat!, filteredProspects[0].lng!] 
    : [-15.793889, -47.882778]; // Default to Brasília

  if (loading) {
    return <div className="p-8 flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 relative z-0">
      <div className="bg-white border-b border-slate-200 px-6 py-4 relative z-[10]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <MapIcon size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800">Rota de Prospecção</h1>
              <p className="text-sm font-medium text-slate-500">Visualização no mapa dos clientes para visita presencial</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setIsRouteSelectionMode(!isRouteSelectionMode);
                if (isRouteSelectionMode) {
                  setSelectedRoutePoints([]);
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-semibold shadow-sm ${
                isRouteSelectionMode 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <MapPin size={16} />
              {isRouteSelectionMode ? 'Cancelar Rota' : 'Definir Entrega'}
            </button>
            
            <button
              onClick={handleForceRetry}
              disabled={isRetrying}
              className={`flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-semibold shadow-sm ${isRetrying ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
              {isRetrying ? 'Buscando...' : 'Recalcular Rotas'}
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Filtrar por endereço..."
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedResponsible}
                onChange={(e) => setSelectedResponsible(e.target.value)}
                className="pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="">Todos os Responsáveis</option>
                {responsibles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                className="flex items-center justify-between gap-2 pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white w-[200px] text-left hover:bg-slate-50 transition-colors"
              >
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <span className="truncate">
                  {selectedCities.length === 0 ? 'Todas as Cidades' : `${selectedCities.length} selecionada(s)`}
                </span>
                <Filter size={14} className="text-slate-400 flex-shrink-0" />
              </button>
              
              {isCityDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCityDropdownOpen(false)}></div>
                  <div className="absolute top-full left-0 mt-1 w-[280px] bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-[22rem] overflow-y-auto flex flex-col">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10 flex flex-col gap-2 shadow-sm">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-semibold text-slate-500">Filtrar Cidades</span>
                        <button 
                          onClick={() => setSelectedCities([])}
                          className="text-xs text-blue-600 font-semibold hover:underline"
                        >
                          Limpar
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Buscar cidade..."
                          value={citySearchTerm}
                          onChange={(e) => setCitySearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {availableCities
                        .filter(city => {
                          const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                          return normalize(city).includes(normalize(citySearchTerm));
                        })
                        .map(city => {
                          const isSelected = selectedCities.includes(city);
                          return (
                            <label key={city} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedCities(prev => prev.filter(c => c !== city));
                                  } else {
                                    setSelectedCities(prev => [...prev, city]);
                                  }
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                              />
                              <span className="text-sm text-slate-700 font-medium truncate" title={city}>{city}</span>
                            </label>
                          );
                      })}
                      {availableCities.filter(city => {
                          const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                          return normalize(city).includes(normalize(citySearchTerm));
                        }).length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400">Nenhuma cidade encontrada</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition-all">
              <input
                type="checkbox"
                checked={showDelivered}
                onChange={(e) => setShowDelivered(e.target.checked)}
                className="rounded text-blue-600 w-4 h-4"
              />
              <span className="text-sm font-semibold text-slate-700">Mostrar Entregues</span>
            </label>
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative z-[5]">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', zIndex: 1 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredProspects.map((p: any) => {
            const isSelected = selectedRoutePoints.some(selected => selected.id === p.id);
            return (
              <Marker 
                key={p.id} 
                position={[p.visualLat, p.visualLng]} 
                icon={isSelected ? selectedIcon : (p.isEntregue ? deliveredIcon : pendingIcon)}
                eventHandlers={{
                  click: () => {
                    if (isRouteSelectionMode) {
                      toggleRoutePoint(p);
                    }
                  }
                }}
              >
                {!isRouteSelectionMode && (
                  <Popup>
                    <div className="p-1 min-w-[200px]">
                      <h3 className="font-bold text-slate-800 text-sm mb-1">{p.clinicName}</h3>
                      {p.ownerName && <p className="text-xs text-slate-600 mb-2">Resp: {p.ownerName}</p>}
                      
                      <div className="bg-slate-50 p-2 rounded border border-slate-100 mb-3 text-xs text-slate-700">
                        {p.fullAddress}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleOpenGoogleMaps(p.lat!, p.lng!)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white py-1.5 rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                          >
                            <Navigation size={12} /> Maps
                          </button>
                          <button 
                            onClick={() => handleOpenWaze(p.lat!, p.lng!)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-sky-500 text-white py-1.5 rounded text-xs font-semibold hover:bg-sky-600 transition-colors"
                          >
                            <Navigation size={12} /> Waze
                          </button>
                        </div>
                        <button 
                          onClick={() => handleCopyAddress(p.fullAddress!)}
                          className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 py-1.5 rounded text-xs font-semibold hover:bg-slate-50 transition-colors"
                        >
                          <Copy size={14} /> Copiar Endereço
                        </button>
                        {p.isEntregue && (
                          <div className="mt-1 flex items-center justify-center gap-1 text-green-600 text-xs font-bold bg-green-50 py-1 rounded">
                            <CheckCircle2 size={14} /> Entregue
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                )}
              </Marker>
            );
          })}
        </MapContainer>
        
        {/* Route Panel */}
        {isRouteSelectionMode && (
          <div className="absolute top-4 right-4 z-[1000] w-80 bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col max-h-[80%]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-xl flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Route size={18} className="text-blue-600" /> 
                  Montar Rota
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedRoutePoints.length === 0 
                    ? 'Clique nos pinos no mapa para adicionar' 
                    : `${selectedRoutePoints.length} pontos selecionados`}
                </p>
              </div>
              <button 
                onClick={() => setIsRouteSelectionMode(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 max-h-64">
              {selectedRoutePoints.length === 0 ? (
                <div className="text-center p-6 text-sm text-slate-400">
                  Nenhum ponto selecionado ainda.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedRoutePoints.map((p, index) => (
                    <div key={p.id} className="flex items-start gap-2 p-2 bg-slate-50 border border-slate-100 rounded-lg group">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 text-sm truncate">{p.clinicName}</p>
                        <p className="text-xs text-slate-500 truncate">{p.fullAddress}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenWaze(p.lat!, p.lng!);
                          }}
                          title="Abrir no Waze"
                          className="text-sky-500 hover:text-sky-600 p-1.5 rounded hover:bg-sky-50 transition-colors"
                        >
                          <Navigation size={14} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRoutePoint(p);
                          }}
                          title="Remover da Rota"
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white rounded-b-xl">
              <button
                onClick={handleGenerateRoute}
                disabled={selectedRoutePoints.length === 0}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  selectedRoutePoints.length > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Navigation size={18} />
                Gerar Rota no Maps ({selectedRoutePoints.length})
              </button>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {geocodingProgress && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] bg-white px-5 py-2.5 rounded-full shadow-lg border border-slate-200 flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm font-semibold text-slate-700">
              Processando endereços: {geocodingProgress.current} de {geocodingProgress.total}
            </span>
          </div>
        )}
        
        {/* Summary Legend (when finished/always showing) */}
        {!geocodingProgress && filteredProspects.length > 0 && (
          <div className="absolute bottom-6 right-6 z-[1000] bg-white p-4 rounded-xl shadow-lg border border-slate-200 flex flex-col gap-3 max-h-[16rem] w-72">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-2">
              <MapPin size={16} className="text-blue-600" /> Resumo das Rotas
            </h4>
            <div className="text-sm font-semibold text-slate-700 pb-2 border-b border-slate-100">
              Total: {filteredProspects.length} clínicas
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-2">
              {Object.entries(
                filteredProspects.reduce((acc, p) => {
                  const cityMatch = p.location ? p.location.match(/^([^,-]+)/) : null;
                  const city = cityMatch ? cityMatch[1].trim() : (p.location ? p.location.trim() : 'Desconhecido');
                  acc[city] = (acc[city] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([city, count]) => (
                <div key={city} className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 truncate mr-2 font-medium" title={city}>{city}</span>
                  <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md min-w-[28px] text-center">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Info Legend */}
        <div className="absolute bottom-6 left-6 z-[1000] bg-white p-3 rounded-xl shadow-lg border border-slate-200 flex flex-col gap-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Legenda</h4>
          <div className="flex items-center gap-2">
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" alt="Pendente" className="w-4 h-6 object-contain" />
            <span className="text-sm font-semibold text-slate-600">Pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png" alt="Entregue" className="w-4 h-6 object-contain" />
            <span className="text-sm font-semibold text-slate-600">Entregue</span>
          </div>
        </div>
      </div>
    </div>
  );
};
