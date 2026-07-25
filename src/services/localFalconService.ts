import { getGlobalSettings } from './firestoreService';

export interface LocalFalconScanParams {
  keyword: string;
  locationName: string;       // Nome da empresa (ex: Ianara Pinho Odontologia)
  cityName?: string;          // Cidade/Proximidade (ex: Brasília, DF)
  placeId?: string;           // Google Place ID (se já conhecido)
  gridSize?: '3' | '5' | '7' | '3x3' | '5x5' | '7x7'; // Tamanho da grade
  radius?: number;            // Raio em km
}

export interface LocalFalconCompetitor {
  placeId: string;
  nome: string;
  posicao: number;     // Posição média
  aparecimentos: number; // Quantas vezes apareceu nos grid points
}

export interface LocalFalconResult {
  success: boolean;
  solv?: number;              // Share of Local Voice %
  avgRank?: number;           // Average Rank Position (arp)
  gridPoints?: Array<{ lat: number; lng: number; rank: number | false }>;
  scanId?: string;            // report_key
  mapImageUrl?: string;       // URL da imagem do mapa
  heatmapUrl?: string;
  creditsUsed?: number;
  competitors?: LocalFalconCompetitor[]; // Concorrentes reais extraídos dos data_points
  error?: string;
}

// Faz uma requisição POST com corpo x-www-form-urlencoded (formato exigido pela API do Local Falcon)
const postForm = async (path: string, params: Record<string, string>) => {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  return res;
};

/**
 * Testa se a API Key do Local Falcon está configurada e retorna o status da conta
 */
export const checkLocalFalconStatus = async (): Promise<{ configured: boolean; credits?: number; error?: string }> => {
  const settings = await getGlobalSettings('gemini');
  const key = settings?.localFalconKey || '';

  if (!key) {
    return { configured: false, error: 'Chave da API do Local Falcon não informada no Admin.' };
  }

  try {
    const res = await fetch(`/api-proxy/localfalcon/v1/account/?api_key=${encodeURIComponent(key)}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      return {
        configured: true,
        credits: data?.data?.credits || data?.data?.credit_balance || data?.credits || 0
      };
    }
    return { configured: true };
  } catch (err: any) {
    return { configured: true, error: err.message };
  }
};

/**
 * Busca a localização nas Saved Locations do Local Falcon pelo nome da empresa.
 */
const findSavedLocation = async (key: string, locationName: string): Promise<{ placeId: string; lat: string; lng: string; name: string } | null> => {
  try {
    const res = await postForm('/api-proxy/localfalcon/v1/locations/', {
      api_key: key,
      query: locationName,
      limit: '20'
    });

    if (!res.ok) return null;

    const data = await res.json();
    const locations = data?.data?.locations || [];
    if (locations.length === 0) return null;

    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const target = norm(locationName);

    const matchedLoc = locations.find((loc: any) => {
      const name = norm(loc.name || '');
      return name.includes(target) || target.includes(name) || name.slice(0, 8) === target.slice(0, 8);
    });

    if (!matchedLoc) return null;

    return {
      placeId: matchedLoc.place_id || matchedLoc.id,
      lat: String(matchedLoc.lat),
      lng: String(matchedLoc.lng),
      name: matchedLoc.name
    };
  } catch (e: any) {
    console.error('[LocalFalcon] Exceção em findSavedLocation:', e);
    return null;
  }
};

/**
 * CADASTRO AUTOMÁTICO VIA API:
 * 1. Pesquisa a empresa no Google Maps via POST /v2/locations/search
 * 2. Adiciona a empresa encontrada às Saved Locations via POST /v2/locations/add
 */
const autoAddLocationToLocalFalcon = async (
  key: string,
  locationName: string,
  proximity?: string
): Promise<{ placeId: string; lat: string; lng: string; name: string } | null> => {
  try {
    console.log('[LocalFalcon AUTO] Pesquisando empresa via API:', locationName, '| proximidade:', proximity);

    // 1. Pesquisar empresa no Google Maps via Local Falcon API
    const searchRes = await postForm('/api-proxy/localfalcon/v2/locations/search', {
      api_key: key,
      name: locationName,
      proximity: proximity || 'Brasília, DF',
      platform: 'google'
    });

    if (!searchRes.ok) {
      const errTxt = await searchRes.text();
      console.error('[LocalFalcon AUTO] Erro na busca /v2/locations/search:', searchRes.status, errTxt);
      return null;
    }

    const searchData = await searchRes.json();
    const results = searchData?.data?.results || [];
    console.log('[LocalFalcon AUTO] Resultados retornados da busca:', results);

    if (results.length === 0) {
      console.warn('[LocalFalcon AUTO] Nenhuma empresa encontrada com esse nome:', locationName);
      return null;
    }

    // Pega a primeira empresa correspondente
    const found = results[0];
    const placeId = found.place_id;
    const lat = String(found.lat);
    const lng = String(found.lng);
    const name = found.name;

    console.log('[LocalFalcon AUTO] Empresa localizada no Google Maps:', name, 'Place ID:', placeId);

    // 2. Salvar a empresa automaticamente na conta via POST /v2/locations/add
    console.log('[LocalFalcon AUTO] Adicionando às Saved Locations via API...');
    const addRes = await postForm('/api-proxy/localfalcon/v2/locations/add', {
      api_key: key,
      platform: 'google',
      place_id: placeId
    });

    if (addRes.ok) {
      console.log('[LocalFalcon AUTO] ✅ Empresa adicionada às Saved Locations com sucesso!');
    } else {
      const addErr = await addRes.text();
      console.log('[LocalFalcon AUTO] Resposta da adição (pode já estar cadastrada):', addRes.status, addErr);
    }

    return { placeId, lat, lng, name };
  } catch (e: any) {
    console.error('[LocalFalcon AUTO] Exceção no cadastro automático:', e);
    return null;
  }
};

/**
 * Executa uma varredura real no Local Falcon usando POST /v2/run-scan/
 * 100% AUTOMÁTICO: se a empresa não estiver salva, ela é pesquisada e adicionada automaticamente pela API!
 */
export const runLocalFalconScan = async (params: LocalFalconScanParams): Promise<LocalFalconResult> => {
  const settings = await getGlobalSettings('gemini');
  const key = settings?.localFalconKey || '';

  if (!key) {
    return { success: false, error: 'Chave API do Local Falcon não configurada no menu Admin.' };
  }

  // Converte "3x3" → "3", "5x5" → "5", "7x7" → "7"
  const rawGrid = String(params.gridSize || settings?.localFalconGridSize || '3x3');
  const gridSize = rawGrid.includes('5') ? '5' : rawGrid.includes('7') ? '7' : '3';
  const creditsMap: Record<string, number> = { '3': 9, '5': 25, '7': 49 };
  const creditsUsed = creditsMap[gridSize] || 9;

  try {
    let placeId = params.placeId || '';
    let lat = '';
    let lng = '';

    // 1. Tentar encontrar entre as localizações já salvas na conta
    if (!placeId) {
      console.log('[LocalFalcon] Verificando se empresa já está salva:', params.locationName);
      const savedLoc = await findSavedLocation(key, params.locationName);

      if (savedLoc && savedLoc.placeId) {
        placeId = savedLoc.placeId;
        lat = savedLoc.lat;
        lng = savedLoc.lng;
        console.log('[LocalFalcon] Empresa já salva encontrada:', savedLoc.name, placeId);
      } else {
        // 2. Se NÃO estiver salva, faz o CADASTRO AUTOMÁTICO via API!
        console.log('[LocalFalcon] Empresa não encontrada nas salvas. Fazendo busca e cadastro AUTOMÁTICO via API...');
        const autoLoc = await autoAddLocationToLocalFalcon(key, params.locationName, params.cityName);

        if (!autoLoc || !autoLoc.placeId) {
          return {
            success: false,
            error: `Não foi possível localizar a empresa "${params.locationName}" no Google Maps via Local Falcon API. Verifique se o nome está correto.`
          };
        }

        placeId = autoLoc.placeId;
        lat = autoLoc.lat;
        lng = autoLoc.lng;
        console.log('[LocalFalcon] Cadastro automático efetuado com sucesso:', autoLoc.name, placeId);
      }
    }

    // 3. Rodar o scan via POST /v2/run-scan/
    const formParams: Record<string, string> = {
      api_key: key,
      place_id: placeId,
      keyword: params.keyword,
      lat: lat,
      lng: lng,
      grid_size: gridSize,
      radius: String(params.radius || 5),
      measurement: 'km',
      platform: 'google'
    };

    console.log('[LocalFalcon] Rodando scan v2/run-scan com params:', { ...formParams, api_key: '***' });

    const res = await postForm('/api-proxy/localfalcon/v2/run-scan/', formParams);

    console.log('[LocalFalcon] Status do scan:', res.status, res.statusText);

    if (res.ok || res.status === 202) {
      const data = await res.json();
      console.log('[LocalFalcon] Resposta do scan:', JSON.stringify(data, null, 2));

      const scanData = data?.data || {};
      const reportKey = scanData.report_key;
      const mapImageUrl = scanData.image || (reportKey ? `https://lf-static-v2.localfalcon.com/image/${reportKey}` : '');
      const heatmapUrl = scanData.heatmap || (reportKey ? `https://lf-static-v2.localfalcon.com/heatmap-img/${reportKey}` : '');
      const solv = parseFloat(scanData.solv || '0');
      const avgRank = parseFloat(scanData.arp || scanData.atrp || '0');

      // Extrair concorrentes únicos dos data_points
      const competitorMap: Record<string, { nome: string; totalRank: number; count: number }> = {};
      for (const pt of (scanData.data_points || [])) {
        for (const result of (pt.results || [])) {
          if (!result.place_id || !result.name) continue;
          if (!competitorMap[result.place_id]) {
            competitorMap[result.place_id] = { nome: result.name, totalRank: 0, count: 0 };
          }
          competitorMap[result.place_id].totalRank += result.rank || 0;
          competitorMap[result.place_id].count += 1;
        }
      }

      const competitors = Object.entries(competitorMap)
        .map(([cPlaceId, v]) => ({
          placeId: cPlaceId,
          nome: v.nome,
          posicao: Math.round(v.totalRank / v.count),
          aparecimentos: v.count
        }))
        .sort((a, b) => a.posicao - b.posicao)
        .slice(0, 10);

      return {
        success: true,
        solv: isNaN(solv) ? 0 : solv,
        avgRank: isNaN(avgRank) ? 0 : avgRank,
        gridPoints: (scanData.data_points || []).map((pt: any) => ({
          lat: parseFloat(pt.lat),
          lng: parseFloat(pt.lng),
          rank: pt.rank
        })),
        scanId: reportKey,
        mapImageUrl,
        heatmapUrl,
        creditsUsed,
        competitors
      };
    } else {
      const errTxt = await res.text();
      console.error('[LocalFalcon] Erro no scan:', res.status, errTxt);
      return { success: false, error: `Local Falcon API: ${res.status} - ${errTxt}` };
    }
  } catch (e: any) {
    console.error('[LocalFalcon] Exceção no scan:', e);
    return { success: false, error: e.message || 'Erro de conexão com Local Falcon' };
  }
};
