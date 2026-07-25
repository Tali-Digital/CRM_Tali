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

// Helper: fetch com timeout (padrão 60s)
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 60000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
};

// Helper: garante que data_points seja SEMPRE retornado como Array mesmo se for um Objeto {"0": {...}} ou undefined
const extractDataPointsArray = (dataObj: any): any[] => {
  if (!dataObj) return [];
  const raw = dataObj.data_points || dataObj.dataPoints || dataObj.scan_data || dataObj.grid_points || dataObj.points || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object' && raw !== null) return Object.values(raw);
  return [];
};

// Faz uma requisição POST com corpo x-www-form-urlencoded (formato exigido pela API do Local Falcon)
const postForm = async (path: string, params: Record<string, string>, timeoutMs = 60000) => {
  const body = new URLSearchParams(params).toString();
  const res = await fetchWithTimeout(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  }, timeoutMs);
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
    const res = await fetchWithTimeout(`/api-proxy/localfalcon/v1/account/?api_key=${encodeURIComponent(key)}`, {}, 15000).catch(() => null);
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

    let scanErrorMsg = '';
    try {
      // Timeout de 75s para a conexão direta
      const res = await postForm('/api-proxy/localfalcon/v2/run-scan/', formParams, 75000);
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

        const dataPoints = extractDataPointsArray(scanData);
        if (dataPoints.length > 0) {
          const competitorMap: Record<string, { nome: string; totalRank: number; count: number }> = {};
          for (const pt of dataPoints) {
            const results = Array.isArray(pt.results) ? pt.results : typeof pt.results === 'object' && pt.results !== null ? Object.values(pt.results) : [];
            for (const result of (results as any[])) {
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
            gridPoints: dataPoints.map((pt: any) => ({
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
        }
      } else {
        const errTxt = await res.text();
        scanErrorMsg = `API Status ${res.status}: ${errTxt}`;
      }
    } catch (e: any) {
      console.warn('[LocalFalcon] Conexão direta v2/run-scan expirou/falhou:', e.message);
      scanErrorMsg = e.message;
    }

    // 4. FALLBACK AUTOMÁTICO VIA HISTÓRICO DA CONTA:
    // O Local Falcon agenda e gera o relatório no servidor mesmo se o socket HTTP expirar no proxy.
    // Tenta recuperar o relatório recém-gerado via histórico.
    console.log('[LocalFalcon] Conexão direta não retornou pontos. Verificando histórico da conta...');
    await new Promise(r => setTimeout(r, 4000));
    let historyCheck = await fetchLocalFalconReportHistory({ locationName: params.locationName, keyword: params.keyword });
    if (historyCheck.success && (historyCheck.gridPoints?.length || 0) > 0) {
      console.log('[LocalFalcon] Recupetado com SUCESSO via histórico do Local Falcon!');
      return historyCheck;
    }

    console.log('[LocalFalcon] Segunda tentativa de busca no histórico...');
    await new Promise(r => setTimeout(r, 6000));
    historyCheck = await fetchLocalFalconReportHistory({ locationName: params.locationName, keyword: params.keyword });
    if (historyCheck.success && (historyCheck.gridPoints?.length || 0) > 0) {
      console.log('[LocalFalcon] Recuperado com SUCESSO na segunda tentativa de histórico!');
      return historyCheck;
    }

    return {
      success: false,
      error: `A API do Local Falcon não concluiu a resposta a tempo. (${scanErrorMsg})`
    };
  } catch (err: any) {
    console.error('[LocalFalcon] Erro geral no scan:', err);
    return { success: false, error: err.message || 'Erro de conexão com o Local Falcon' };
  }
};

/**
 * Busca no histórico do Local Falcon uma varredura já realizada para esta empresa,
 * obtendo os resultados SEM gastar novos créditos de busca.
 */
export const fetchLocalFalconReportHistory = async (params: {
  locationName: string;
  keyword?: string;
}): Promise<LocalFalconResult> => {
  const settings = await getGlobalSettings('gemini');
  const key = settings?.localFalconKey || '';

  if (!key) {
    return { success: false, error: 'Chave API do Local Falcon não configurada.' };
  }

  try {
    // 1. Tentar encontrar local registrado
    const savedLoc = await findSavedLocation(key, params.locationName);
    const placeId = savedLoc?.placeId || '';

    // 2. Buscar relatórios existentes na conta
    const formBody: Record<string, string> = { api_key: key, limit: '30' };
    if (placeId) formBody.place_id = placeId;

    console.log('[LocalFalcon History] Consultando lista de relatórios anteriores:', params.locationName, '| placeId:', placeId);
    const res = await postForm('/api-proxy/localfalcon/v1/reports/', formBody, 30000);

    if (!res.ok) {
      const errTxt = await res.text();
      console.error('[LocalFalcon History] Erro ao listar relatórios:', res.status, errTxt);
      return { success: false, error: `Local Falcon API (${res.status}): ${errTxt}` };
    }

    const data = await res.json();
    const reports = data?.data?.reports || data?.reports || data?.data || [];
    if (!Array.isArray(reports) || reports.length === 0) {
      return {
        success: false,
        error: `Nenhum relatório anterior encontrado na sua conta do Local Falcon para "${params.locationName}".`
      };
    }

    // Normalização para comparar palavra-chave ou nome
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    let matchedReport = reports[0];
    if (params.keyword) {
      const targetKw = norm(params.keyword);
      const found = reports.find((r: any) => norm(r.keyword || r.name || '').includes(targetKw));
      if (found) matchedReport = found;
    }

    const reportKey = matchedReport.report_key || matchedReport.scan_id || matchedReport.id;
    if (!reportKey) {
      return { success: false, error: 'Relatório encontrado no histórico, mas sem chave única de visualização.' };
    }

    // 3. Obter dados detalhados do relatório já gerado via /v1/report/
    console.log('[LocalFalcon History] Carregando dados do report_key:', reportKey);
    const detailRes = await postForm('/api-proxy/localfalcon/v1/report/', { api_key: key, report_key: reportKey }, 30000);

    let detailData: any = matchedReport;
    if (detailRes.ok) {
      const json = await detailRes.json();
      detailData = json?.data?.report || json?.data?.scan || json?.data || json || matchedReport;
    }

    const mapImageUrl = detailData.image || (reportKey ? `https://lf-static-v2.localfalcon.com/image/${reportKey}` : '');
    const heatmapUrl = detailData.heatmap || (reportKey ? `https://lf-static-v2.localfalcon.com/heatmap-img/${reportKey}` : '');
    const solv = parseFloat(detailData.solv || detailData.share_of_local_voice || matchedReport.solv || '0');
    const avgRank = parseFloat(detailData.arp || detailData.atrp || detailData.average_rank || matchedReport.arp || '0');

    // Concorrentes extraídos dos data_points se disponíveis
    const dataPoints = extractDataPointsArray(detailData);
    const competitorMap: Record<string, { nome: string; totalRank: number; count: number }> = {};
    for (const pt of dataPoints) {
      const results = Array.isArray(pt.results) ? pt.results : typeof pt.results === 'object' && pt.results !== null ? Object.values(pt.results) : [];
      for (const result of (results as any[])) {
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
      gridPoints: dataPoints.map((pt: any) => ({
        lat: parseFloat(pt.lat || 0),
        lng: parseFloat(pt.lng || 0),
        rank: pt.rank
      })),
      scanId: reportKey,
      mapImageUrl,
      heatmapUrl,
      creditsUsed: 0, // 0 créditos consumidos
      competitors
    };
  } catch (e: any) {
    console.error('[LocalFalcon History] Exceção ao consultar relatório existente:', e);
    return { success: false, error: e.message || 'Erro ao consultar relatórios existentes do Local Falcon' };
  }
};

