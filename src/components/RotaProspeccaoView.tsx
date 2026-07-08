import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from 'leaflet';
import { subscribeToProspects, updateProspect } from '../services/firestoreService';
import { Prospect } from '../types';
import { Map as MapIcon, Search, User, Navigation, CheckCircle2, Copy, RefreshCw, Filter } from 'lucide-react';
import Swal from 'sweetalert2';

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

export const RotaProspeccaoView = ({ companyId }: { companyId: string }) => {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedResponsible, setSelectedResponsible] = useState('');
  const [showDelivered, setShowDelivered] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

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
      
      for (const p of missing) {
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

  const filteredProspects = useMemo(() => {
    const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    const filtered = prospects.filter(p => {
      const matchDelivery = showDelivered ? true : !p.isEntregue;
      const matchLocation = searchLocation === '' || (p.fullAddress && normalizeString(p.fullAddress).includes(normalizeString(searchLocation)));
      const matchResponsible = selectedResponsible === '' || p.responsible === selectedResponsible;
      
      return matchDelivery && matchLocation && matchResponsible && p.lat && p.lng && p.lng < 0;
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
  }, [prospects, showDelivered, searchLocation, selectedResponsible]);

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
          {filteredProspects.map((p: any) => (
            <Marker key={p.id} position={[p.visualLat, p.visualLng]} icon={p.isEntregue ? deliveredIcon : pendingIcon}>
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-slate-800 text-sm mb-1">{p.clinicName}</h3>
                  {p.ownerName && <p className="text-xs text-slate-600 mb-2">Resp: {p.ownerName}</p>}
                  
                  <div className="bg-slate-50 p-2 rounded border border-slate-100 mb-3 text-xs text-slate-700">
                    {p.fullAddress}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleOpenGoogleMaps(p.lat!, p.lng!)}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-1.5 rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                    >
                      <Navigation size={14} /> Rotas no Maps
                    </button>
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
            </Marker>
          ))}
        </MapContainer>
        
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
