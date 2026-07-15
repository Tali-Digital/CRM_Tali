import { updateProspect } from '../services/firestoreService';
import { Prospect } from '../types';

export const tryGeocode = async (query: string): Promise<{ lat: number; lng: number } | null> => {
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

export const geocodeAndSaveProspect = async (prospectId: string, fullAddress: string | undefined, location: string | undefined) => {
  try {
    let coords = null;
    
    if (fullAddress && fullAddress.trim() !== '') {
      coords = await tryGeocode(fullAddress);
      
      // Clean Brazilian complex addresses (Quadra, Lote, Lt, Qd, etc)
      if (!coords) {
        const cleanedAddress = fullAddress
          .replace(/(?:Quadra|Qd|Q\.|Lote|Lt|L\.|Bloco|Bl|Sala|Sl|Loja|Lg|Conjunto|Cj)[^\,\-]+(?:,|-)?/gi, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/,\s*,/g, ',')
          .replace(/-\s*-/g, '-')
          .replace(/,\s*-/g, ' -')
          .trim();
          
        if (cleanedAddress !== fullAddress.trim()) {
          await new Promise(r => setTimeout(r, 1500));
          coords = await tryGeocode(cleanedAddress);
        }
      }
    }
    
    if (!coords && location) {
      await new Promise(r => setTimeout(r, 1500));
      coords = await tryGeocode(location);

      if (!coords) {
        const match = location.match(/([^,]+)\s*-\s*([A-Z]{2})/i);
        if (match) {
          await new Promise(r => setTimeout(r, 1500));
          const cityState = `${match[1].trim()}, ${match[2]}`;
          coords = await tryGeocode(cityState);
        }
      }
    }

    if (coords) {
      await updateProspect(prospectId, { lat: coords.lat, lng: coords.lng, geocodeFailed: false });
    } else {
      await updateProspect(prospectId, { geocodeFailed: true });
    }
  } catch (error) {
    console.error('Erro ao geocodificar prospect no background', error);
  }
};
