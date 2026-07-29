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
  avgRank?: number;           // Average Rank Position (ARP), a technical grid metric
  clientRank?: number;        // Integer position among businesses returned by Local Falcon
  gridPoints?: Array<{ lat: number; lng: number; rank: number | false }>;
  scanId?: string;            // report_key
  mapImageUrl?: string;       // URL da imagem do mapa
  heatmapUrl?: string;
  creditsUsed?: number;
  competitors?: LocalFalconCompetitor[]; // Concorrentes reais extraídos dos data_points
  error?: string;
}

const normalizeBusinessName = (name: string) => name
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const extractCompetitorRanking = (dataPoints: any[], targetPlaceId = '', targetName = '') => {
  const competitorMap: Record<string, { nome: string; totalRank: number; count: number }> = {};

  for (const point of dataPoints) {
    const results = Array.isArray(point.results) ? point.results : typeof point.results === 'object' && point.results !== null ? Object.values(point.results) : [];
    for (const result of results as any[]) {
      const rank = Number(result.rank ?? result.position);
      const name = result.name || result.business_name || result.title;
      const placeId = result.place_id || result.placeId || result.google_place_id || result.cid || name;
      if (!placeId || !name || !Number.isFinite(rank) || rank <= 0) continue;
      if (!competitorMap[placeId]) {
        competitorMap[placeId] = { nome: name, totalRank: 0, count: 0 };
      }
      competitorMap[placeId].totalRank += rank;
      competitorMap[placeId].count += 1;
    }
  }

  const rankedBusinesses = Object.entries(competitorMap)
    .map(([placeId, value]) => ({
      placeId,
      nome: value.nome,
      averageRank: value.totalRank / value.count,
      aparecimentos: value.count
    }))
    .sort((a, b) => a.averageRank - b.averageRank);

  const normalizedTargetName = normalizeBusinessName(targetName);
  const clientIndex = rankedBusinesses.findIndex((business) =>
    business.placeId === targetPlaceId ||
    (!!normalizedTargetName && (() => {
      const normalizedBusinessName = normalizeBusinessName(business.nome);
      return normalizedBusinessName === normalizedTargetName ||
        normalizedBusinessName.includes(normalizedTargetName) ||
        normalizedTargetName.includes(normalizedBusinessName);
    })())
  );

  return {
    competitors: rankedBusinesses.map(({ averageRank, ...business }, index) => ({
      ...business,
      posicao: index + 1
    })).slice(0, 10),
    clientRank: clientIndex >= 0 ? clientIndex + 1 : undefined
  };
};

const extractCompetitorReportRanking = (reportData: any, targetPlaceId = '', targetName = '') => {
  const businesses = Array.isArray(reportData?.businesses) ? reportData.businesses : [];
  const normalizedTargetName = normalizeBusinessName(targetName);
  const rankedBusinesses = businesses
    .map((business: any) => {
      const dataPoints = Array.isArray(business.data_points) ? business.data_points : [];
      const ranks = dataPoints
        .map((point: any) => Number(point.rank))
        .filter((rank: number) => Number.isFinite(rank) && rank > 0);
      return {
        placeId: business.place_id || business.placeId || business.cid || business.name,
        nome: business.name || business.business_name || 'Empresa sem nome',
        solv: Number.isFinite(Number(business.solv)) ? Number(business.solv) : 0,
        arp: Number.isFinite(Number(business.arp)) ? Number(business.arp) : Number.MAX_SAFE_INTEGER,
        aparecimentos: ranks.length,
        nota: Number.isFinite(Number(business.rating)) ? Number(business.rating) : undefined,
        avaliacoes: Number.isFinite(Number(business.reviews)) ? Number(business.reviews) : undefined,
        endereco: business.address || undefined
      };
    })
    .filter((business: any) => business.placeId && business.nome)
    // Replicates the Local Falcon competitor table when the SoLV column is sorted descending.
    .sort((a: any, b: any) => (b.solv - a.solv) || (a.arp - b.arp));

  const clientIndex = rankedBusinesses.findIndex((business: any) => {
    const normalizedBusinessName = normalizeBusinessName(business.nome);
    return business.placeId === targetPlaceId ||
      (!!normalizedTargetName && (normalizedBusinessName === normalizedTargetName || normalizedBusinessName.includes(normalizedTargetName) || normalizedTargetName.includes(normalizedBusinessName)));
  });

  return {
    competitors: rankedBusinesses.map(({ solv, arp, ...business }: any, index: number) => ({
      ...business,
      posicao: index + 1
    })).slice(0, 20),
    clientRank: clientIndex >= 0 ? clientIndex + 1 : undefined
  };
};

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

// Helper: obtém a URL correta da API (proxy em localhost, direta HTTPS em produção)
export const getFalconApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const cleanPath = endpoint.replace(/^\/api-proxy\/localfalcon/, '');
  const pathWithSlash = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return `/api-proxy/localfalcon${pathWithSlash}`;
  }
  return `https://api.localfalcon.com${pathWithSlash}`;
};

export const fetchFalconApi = async (endpoint: string, options: RequestInit = {}, timeoutMs = 60000): Promise<Response> => {
  const url = getFalconApiUrl(endpoint);
  return fetchWithTimeout(url, options, timeoutMs);
};

// Parser seguro para JSON
const parseFalconJson = async (res: Response): Promise<any> => {
  try {
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      return { success: false, error: `Servidor retornou resposta inválida (${res.status}).` };
    }
    return JSON.parse(text);
  } catch (e: any) {
    return { success: false, error: `Falha ao interpretar JSON da API.` };
  }
};

// Faz uma requisição POST com corpo x-www-form-urlencoded
const postForm = async (path: string, params: Record<string, string>, timeoutMs = 60000) => {
  const url = getFalconApiUrl(path);
  const body = new URLSearchParams(params).toString();
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  }, timeoutMs);
  return res;
};

/**
 * Testa se a API Key do Local Falcon está configurada e retorna o status da conta
 */
export const checkLocalFalconStatus = async (customKey?: string): Promise<{ configured: boolean; credits?: number; error?: string }> => {
  const settings = await getGlobalSettings('gemini');
  const key = customKey || settings?.localFalconKey || '';

  if (!key) {
    return { configured: false, error: 'Chave da API do Local Falcon não informada no Admin.' };
  }

  try {
    const res = await postForm('/v2/account', { api_key: key }, 15000).catch(() => null);
    if (res && res.ok) {
      const data = await parseFalconJson(res);
      if (data?.success === true) {
        const credits =
          data?.data?.credits?.total_usable_credits ??
          data?.data?.credits?.credit_package_remaining ??
          data?.data?.credits ??
          data?.credits ??
          0;
        return { configured: true, credits };
      }
      return { configured: true, error: data?.message || data?.error || 'Chave de API inválida' };
    }
    if (res) {
      const errTxt = await res.text().catch(() => '');
      return { configured: true, error: `HTTP ${res.status}: ${errTxt.slice(0, 100)}` };
    }
    return { configured: true, error: 'Sem resposta da API do Local Falcon.' };
  } catch (err: any) {
    return { configured: true, error: err.message };
  }
};

/**
 * Normaliza string para comparação: remove acentos, espaços duplicados, caracteres especiais.
 */
const normStr = (s: string) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const stripBusinessSuffixes = (name: string) => normStr(name)
  .replace(/\b(odontologia|odonto|clinica|dental|estetica|saude|consultorio)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Verifica se dois nomes de empresa são similares usando múltiplas estratégias:
 * - Match exato
 * - Um contém o outro
 * - Primeiros N chars idênticos
 * - Todas as palavras-chave do target aparecem no candidato
 */
const isSimilarName = (candidate: string, target: string): boolean => {
  const c = normStr(candidate);
  const t = normStr(target);
  if (c === t) return true;
  if (c.includes(t) || t.includes(c)) return true;
  // Primeiros 10 chars
  if (c.length >= 6 && t.length >= 6 && c.slice(0, 10) === t.slice(0, 10)) return true;
  // Todas as palavras significativas do target aparecem no candidato
  const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'a', 'o', 'as', 'os']);
  const targetWords = t.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
  if (targetWords.length > 0 && targetWords.every(w => c.includes(w))) return true;
  return false;
};

/**
 * Busca a localização nas Saved Locations do Local Falcon pelo nome da empresa.
 * Usa matching fuzzy para tolerar diferenças de formatação.
 */
const findSavedLocation = async (key: string, locationName: string, exactOnly = false): Promise<{ placeId: string; lat: string; lng: string; name: string } | null> => {
  try {
    // Tenta com o nome completo primeiro, depois com uma versão simplificada
    const namesToTry = [locationName];
    // Versão sem sufixos comuns (Odontologia, Clínica, Estética, etc.)
    const simplified = locationName.replace(/\b(odontologia|odonto|clinica|cl[ií]nica|est[eé]tica|est[eé]tica dental|dental|saude|sa[uú]de|consultorio|consult[oó]rio)\b/gi, '').trim();
    if (simplified && simplified !== locationName && simplified.length > 3) {
      namesToTry.push(simplified);
    }

    for (const nameQuery of namesToTry) {
      const res = await postForm('/api-proxy/localfalcon/v1/locations/', {
        api_key: key,
        query: nameQuery,
        limit: '30'
      });

      if (!res.ok) continue;

      const data = await res.json();
      const locations = data?.data?.locations || [];
      if (locations.length === 0) continue;

      const targetBaseName = stripBusinessSuffixes(locationName);
      const matchedLoc = locations.find((loc: any) => {
        if (!exactOnly) return isSimilarName(loc.name || '', locationName);
        const candidateName = normStr(loc.name || '');
        const candidateBaseName = stripBusinessSuffixes(loc.name || '');
        return candidateName === normStr(locationName) ||
          (!!targetBaseName && candidateBaseName === targetBaseName);
      });
      if (matchedLoc) {
        console.log('[LocalFalcon] Match encontrado nas Saved Locations:', matchedLoc.name, '→ query usada:', nameQuery);
        return {
          placeId: matchedLoc.place_id || matchedLoc.id,
          lat: String(matchedLoc.lat),
          lng: String(matchedLoc.lng),
          name: matchedLoc.name
        };
      }
    }

    return null;
  } catch (e: any) {
    console.error('[LocalFalcon] Exceção em findSavedLocation:', e);
    return null;
  }
};

/**
 * CADASTRO AUTOMÁTICO VIA API:
 * 1. Pesquisa a empresa no Google Maps via POST /v2/locations/search com múltiplas variações de nome
 * 2. Adiciona a empresa encontrada às Saved Locations via POST /v2/locations/add
 */
const autoAddLocationToLocalFalcon = async (
  key: string,
  locationName: string,
  proximity?: string
): Promise<{ placeId: string; lat: string; lng: string; name: string } | null> => {
  try {
    // Gerar variações do nome para aumentar chance de encontrar
    const namesToTry: string[] = [locationName];

    // Versão sem sufixos genéricos
    const noSuffix = locationName.replace(/\b(odontologia|odonto|clinica|cl[ií]nica|est[eé]tica|dental|saude|sa[uú]de|consultorio|consult[oó]rio|centro|instituto|spa|estetico|est[eé]tico)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (noSuffix && noSuffix !== locationName && noSuffix.length > 3) namesToTry.push(noSuffix);

    // Primeiras 2–3 palavras (nome curto)
    const words = locationName.split(/\s+/);
    if (words.length > 2) {
      namesToTry.push(words.slice(0, 2).join(' '));
      if (words.length > 3) namesToTry.push(words.slice(0, 3).join(' '));
    }

    // Usa cidade como proximity dinâmico
    const proximityStr = proximity || 'Brasil';

    for (const nameQuery of namesToTry) {
      console.log('[LocalFalcon AUTO] Pesquisando via API:', nameQuery, '| proximidade:', proximityStr);

      const searchRes = await postForm('/api-proxy/localfalcon/v2/locations/search', {
        api_key: key,
        name: nameQuery,
        proximity: proximityStr,
        platform: 'google'
      });

      if (!searchRes.ok) {
        const errTxt = await searchRes.text();
        console.error('[LocalFalcon AUTO] Erro na busca /v2/locations/search:', searchRes.status, errTxt.slice(0, 200));
        continue;
      }

      const searchData = await searchRes.json();
      const results: any[] = searchData?.data?.results || [];
      console.log('[LocalFalcon AUTO] Resultados para "' + nameQuery + '":', results.length, 'encontrados');

      if (results.length === 0) continue;

      // Prefere o melhor match; fallback para o primeiro resultado
      const bestMatch = results.find(r => isSimilarName(r.name || '', locationName)) || results[0];

      const placeId = bestMatch.place_id;
      const lat = String(bestMatch.lat);
      const lng = String(bestMatch.lng);
      const name = bestMatch.name;

      console.log('[LocalFalcon AUTO] Empresa selecionada:', name, 'Place ID:', placeId);

      // Salvar na conta do Local Falcon
      const addRes = await postForm('/api-proxy/localfalcon/v2/locations/add', {
        api_key: key,
        platform: 'google',
        place_id: placeId
      });

      if (addRes.ok) {
        console.log('[LocalFalcon AUTO] ✅ Empresa adicionada às Saved Locations com sucesso!');
      } else {
        const addErr = await addRes.text();
        console.log('[LocalFalcon AUTO] Resposta da adição (pode já estar cadastrada):', addRes.status, addErr.slice(0, 100));
      }

      return { placeId, lat, lng, name };
    }

    console.warn('[LocalFalcon AUTO] Nenhuma variação de nome retornou resultados para:', locationName);
    return null;
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
          const { competitors, clientRank } = extractCompetitorRanking(dataPoints, placeId, params.locationName);

          return {
            success: true,
            solv: isNaN(solv) ? 0 : solv,
            avgRank: isNaN(avgRank) ? 0 : avgRank,
            clientRank,
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
    const savedLoc = await findSavedLocation(key, params.locationName, true);
    const placeId = savedLoc?.placeId || '';
    if (!placeId) {
      return {
        success: false,
        error: `Nenhuma localização exata foi encontrada no Local Falcon para "${params.locationName}". Nenhum relatório foi importado.`
      };
    }

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

    // O relatório só pode ser importado quando pertence ao Place ID da ficha atual.
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const reportsForLocation = reports.filter((report: any) => {
      const reportPlaceId = report.place_id || report.location?.place_id || report.location?.placeId || '';
      return reportPlaceId === placeId;
    });
    if (reportsForLocation.length === 0) {
      return {
        success: false,
        error: `Nenhum relatório do Local Falcon pertence à empresa "${params.locationName}". Nenhum dado foi alterado.`
      };
    }

    const targetKeyword = norm(params.keyword || '');
    const matchedReport = targetKeyword
      ? reportsForLocation.find((report: any) => norm(report.keyword || '') === targetKeyword)
      : reportsForLocation[0];
    if (!matchedReport) {
      return {
        success: false,
        error: `Não existe relatório do Local Falcon para "${params.locationName}" com a palavra-chave "${params.keyword}". Nenhum dado foi alterado.`
      };
    }

    const reportKey = matchedReport.report_key || matchedReport.scan_id || matchedReport.id;
    if (!reportKey) {
      return { success: false, error: 'Relatório encontrado no histórico, mas sem chave única de visualização.' };
    }

    // 3. Obter os dados detalhados e o ranking real de concorrentes do relatório.
    console.log('[LocalFalcon History] Carregando dados do report_key:', reportKey);
    const detailRes = await postForm(`/api-proxy/localfalcon/v1/reports/${reportKey}/`, { api_key: key }, 30000);
    const competitorRes = await postForm(`/api-proxy/localfalcon/v1/competitor-reports/${reportKey}`, { api_key: key }, 30000);

    let detailData: any = matchedReport;
    if (detailRes.ok) {
      const json = await detailRes.json();
      detailData = json?.data || json || matchedReport;
    }

    let competitorReportData: any = null;
    if (competitorRes.ok) {
      const json = await competitorRes.json();
      competitorReportData = json?.data || null;
    }

    const mapImageUrl = detailData.image || (reportKey ? `https://lf-static-v2.localfalcon.com/image/${reportKey}` : '');
    const heatmapUrl = detailData.heatmap || (reportKey ? `https://lf-static-v2.localfalcon.com/heatmap-img/${reportKey}` : '');
    const solv = parseFloat(detailData.solv || detailData.share_of_local_voice || matchedReport.solv || '0');
    const avgRank = parseFloat(detailData.arp || detailData.atrp || detailData.average_rank || matchedReport.arp || '0');

    const dataPoints = extractDataPointsArray(detailData);
    const pointRanking = extractCompetitorRanking(dataPoints, placeId, params.locationName);
    const competitorReportRanking = extractCompetitorReportRanking(competitorReportData, placeId || matchedReport.place_id, params.locationName);
    const competitors = competitorReportRanking.competitors.length > 0
      ? competitorReportRanking.competitors
      : pointRanking.competitors;
    const clientRank = competitorReportRanking.clientRank ?? pointRanking.clientRank;

    return {
      success: true,
      solv: isNaN(solv) ? 0 : solv,
      avgRank: isNaN(avgRank) ? 0 : avgRank,
      clientRank,
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

