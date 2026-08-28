import Swal from 'sweetalert2';
import { getGlobalSettings } from './firestoreService';

export interface LocalFalconScanParams {
  keyword: string;
  locationName: string;       // Nome da empresa (ex: Ianara Pinho Odontologia)
  cityName?: string;          // Cidade/Proximidade (ex: Brasília, DF)
  placeId?: string;           // Google Place ID (se já conhecido)
  gridSize?: '3' | '5' | '7' | '3x3' | '5x5' | '7x7'; // Tamanho da grade
  radius?: number;            // Raio em km
  forceNewScan?: boolean;     // Se false/omitido, reutiliza relatório existente de 0 créditos se disponível
  onConfirmNameMismatch?: (foundName: string, requestedName: string) => Promise<boolean>;
}

export interface LocalFalconCompetitor {
  placeId: string;
  nome: string;
  posicao: number;     // Posição média
  aparecimentos: number; // Quantas vezes apareceu nos grid points
  nota?: number | null;
  avaliacoes?: number | null;
  endereco?: string | null;
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
  radius?: number;
  gridSize?: string;
  error?: string;
}

const normalizeBusinessName = (name: string) => name
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '');

const extractCompetitorRanking = (dataPoints: any[], targetPlaceId = '', targetName = ''): { competitors: LocalFalconCompetitor[]; clientRank?: number } => {
  const competitorMap: Record<string, { nome: string; totalRank: number; count: number; rating?: number; reviews?: number; address?: string }> = {};

  for (const point of dataPoints) {
    const results = Array.isArray(point.results) ? point.results : typeof point.results === 'object' && point.results !== null ? Object.values(point.results) : [];
    for (const result of results as any[]) {
      const rank = Number(result.rank ?? result.position);
      const name = result.name || result.business_name || result.title;
      const placeId = result.place_id || result.placeId || result.google_place_id || result.cid || name;
      if (!placeId || !name || !Number.isFinite(rank) || rank <= 0) continue;

      const rating = Number.isFinite(Number(result.rating)) ? Number(result.rating) : (Number.isFinite(Number(result.rating_val)) ? Number(result.rating_val) : undefined);
      const reviews = Number.isFinite(Number(result.reviews)) ? Number(result.reviews) : (Number.isFinite(Number(result.reviews_count)) ? Number(result.reviews_count) : (Number.isFinite(Number(result.user_ratings_total)) ? Number(result.user_ratings_total) : undefined));
      const address = result.address || result.vicinity || result.formatted_address || result.full_address || undefined;

      if (!competitorMap[placeId]) {
        competitorMap[placeId] = { nome: name, totalRank: 0, count: 0, rating, reviews, address };
      } else {
        if (rating && !competitorMap[placeId].rating) competitorMap[placeId].rating = rating;
        if (reviews && !competitorMap[placeId].reviews) competitorMap[placeId].reviews = reviews;
        if (address && !competitorMap[placeId].address) competitorMap[placeId].address = address;
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
      aparecimentos: value.count,
      nota: value.rating ?? null,
      avaliacoes: value.reviews ?? null,
      endereco: value.address ?? null
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
    competitors: rankedBusinesses.map(({ averageRank, ...business }, index): LocalFalconCompetitor => ({
      ...business,
      posicao: index + 1
    })).slice(0, 10),
    clientRank: clientIndex >= 0 ? clientIndex + 1 : undefined
  };
};

const extractCompetitorReportRanking = (reportData: any, targetPlaceId = '', targetName = ''): { competitors: LocalFalconCompetitor[]; clientRank?: number } => {
  const businesses = Array.isArray(reportData?.businesses) ? reportData.businesses : [];
  const normalizedTargetName = normalizeBusinessName(targetName);
  const rankedBusinesses = businesses
    .map((business: any) => {
      const dataPoints = Array.isArray(business.data_points) ? business.data_points : [];
      const ranks = dataPoints
        .map((point: any) => Number(point.rank))
        .filter((rank: number) => Number.isFinite(rank) && rank > 0);

      const rating = Number.isFinite(Number(business.rating)) ? Number(business.rating) : (Number.isFinite(Number(business.rating_val)) ? Number(business.rating_val) : null);
      const reviews = Number.isFinite(Number(business.reviews)) ? Number(business.reviews) : (Number.isFinite(Number(business.reviews_count)) ? Number(business.reviews_count) : (Number.isFinite(Number(business.user_ratings_total)) ? Number(business.user_ratings_total) : null));
      const address = business.address || business.vicinity || business.formatted_address || business.full_address || null;

      return {
        placeId: business.place_id || business.placeId || business.cid || business.name,
        nome: business.name || business.business_name || 'Empresa sem nome',
        solv: Number.isFinite(Number(business.solv)) ? Number(business.solv) : 0,
        arp: Number.isFinite(Number(business.arp)) ? Number(business.arp) : Number.MAX_SAFE_INTEGER,
        aparecimentos: ranks.length,
        nota: rating,
        avaliacoes: reviews,
        endereco: address
      };
    })
    .filter((business: any) => business.placeId && business.nome)
    .sort((a: any, b: any) => (b.solv - a.solv) || (a.arp - b.arp));

  const clientIndex = rankedBusinesses.findIndex((business: any) => {
    const normalizedBusinessName = normalizeBusinessName(business.nome);
    return business.placeId === targetPlaceId ||
      (!!normalizedTargetName && (normalizedBusinessName === normalizedTargetName || normalizedBusinessName.includes(normalizedTargetName) || normalizedTargetName.includes(normalizedBusinessName)));
  });

  return {
    competitors: rankedBusinesses.map(({ solv, arp, ...business }: any, index: number): LocalFalconCompetitor => ({
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
export const isSimilarName = (candidate: string, target: string): boolean => {
  if (!candidate || !target) return false;
  const c = normStr(candidate);
  const t = normStr(target);
  if (c === t) return true;
  if (c.includes(t) || t.includes(c)) return true;
  // Primeiros 10 chars
  if (c.length >= 6 && t.length >= 6 && c.slice(0, 10) === t.slice(0, 10)) return true;
  // Nome base sem sufixos
  const stripSuffixes = (s: string) => normStr(s)
    .replace(/\b(odontologia|odonto|clinica|cl[ií]nica|dental|estetica|est[eé]tica|saude|sa[uú]de|consultorio|consult[oó]rio|centro|instituto|unidade)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cBase = stripSuffixes(candidate);
  const tBase = stripSuffixes(target);
  if (cBase && tBase && (cBase === tBase || cBase.includes(tBase) || tBase.includes(cBase))) return true;

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
    // Gerar variacoes do nome para aumentar chance de encontrar
    const namesToTry: string[] = [locationName];

    // Se o nome contiver a cidade, tenta tambem sem o nome da cidade
    const cleanCity = (proximity || '').split('-')[0].trim();
    if (cleanCity && locationName.toLowerCase().includes(cleanCity.toLowerCase())) {
      const nameWithoutCity = locationName.replace(new RegExp(cleanCity, 'gi'), '').trim();
      if (nameWithoutCity.length > 2) namesToTry.push(nameWithoutCity);
    }

    // Versao sem sufixos genericos
    const noSuffix = locationName.replace(/\b(odontologia|odonto|clinica|cl[ii]nica|est[ee]tica|dental|saude|sa[uu]de|consultorio|consult[oo]rio|centro|instituto|spa|estetico|est[ee]tico)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (noSuffix && noSuffix !== locationName && noSuffix.length > 3) namesToTry.push(noSuffix);

    // Primeiras 2-3 palavras (nome curto)
    const words = locationName.split(/\s+/);
    if (words.length > 2) {
      namesToTry.push(words.slice(0, 2).join(' '));
      if (words.length > 3) namesToTry.push(words.slice(0, 3).join(' '));
    }

    // Variacoes de proximidade: cidade completa, so nome da cidade (sem UF), Brasil
    const proximityOptions = Array.from(new Set([
      proximity,
      cleanCity,
      'Brasil'
    ])).filter((p): p is string => Boolean(p && p.trim().length > 0));

    for (const prox of proximityOptions) {
      for (const nameQuery of namesToTry) {
        console.log('[LocalFalcon AUTO] Pesquisando via API:', nameQuery, '| proximidade:', prox);

        const searchRes = await postForm('/api-proxy/localfalcon/v2/locations/search', {
          api_key: key,
          name: nameQuery,
          proximity: prox,
          platform: 'google'
        });

        if (!searchRes.ok) {
          const errTxt = await searchRes.text();
          console.error('[LocalFalcon AUTO] Erro na busca /v2/locations/search:', searchRes.status, errTxt.slice(0, 200));
          continue;
        }

        const searchData = await searchRes.json();
        const results: any[] = searchData?.data?.results || [];
        console.log('[LocalFalcon AUTO] Resultados para "' + nameQuery + '" prox "' + prox + '":', results.length, 'encontrados');

        if (results.length === 0) continue;

        const normCity = (cleanCity || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();

        // Candidatos com nome similar
        const nameMatches = results.filter(r => isSimilarName(r.name || '', locationName));
        if (nameMatches.length === 0) {
          console.warn('[LocalFalcon AUTO] Nenhum resultado da busca tem nome semelhante a "' + locationName + '". Ignorando fallback para evitar empresa errada (ex: SouClinic).');
          continue;
        }
        const pool = nameMatches;

        // Se a proximidade usada for ampla ("Brasil"), EXIGE que o endereço contenha a cidade
        // para não pegar empresa homônima em outra cidade
        let bestMatch: any = null;
        if (normCity && prox === 'Brasil') {
          bestMatch = pool.find(r => {
            const addr = (r.address || r.formatted_address || r.vicinity || '').toLowerCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
            return addr.includes(normCity);
          });
          // Se não achou com endereço, pula essa rodada — não arrisca empresa errada
          if (!bestMatch) {
            console.warn('[LocalFalcon AUTO] Busca "Brasil" retornou resultados mas nenhum tem a cidade "' + cleanCity + '" no endereço. Pulando para evitar empresa errada.');
            continue;
          }
        } else {
          // Proximidade específica (cidade ou UF) — pode confiar no primeiro resultado
          bestMatch = pool[0];
        }

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
          console.log('[LocalFalcon AUTO] Empresa adicionada as Saved Locations com sucesso!');
        } else {
          const addErr = await addRes.text();
          console.log('[LocalFalcon AUTO] Resposta da adicao (pode ja estar cadastrada):', addRes.status, addErr.slice(0, 100));
        }

        return { placeId, lat, lng, name };
      }
    }

    console.warn('[LocalFalcon AUTO] Nenhuma combinacao nome/proximidade retornou resultados para:', locationName);
    return null;
  } catch (e: any) {
    console.error('[LocalFalcon AUTO] Excecao no cadastro automatico:', e);
    return null;
  }
};

/**
 * Busca uma empresa salva no Local Falcon especificamente pelo Place ID (Google Place ID)
 */
const findSavedLocationByPlaceId = async (
  key: string,
  placeId: string
): Promise<{ placeId: string; lat: string; lng: string; name: string } | null> => {
  try {
    const res = await postForm('/api-proxy/localfalcon/v1/locations/', {
      api_key: key,
      limit: '100'
    });
    if (res.ok) {
      const data = await res.json();
      const locations: any[] = data?.data?.locations || data?.locations || [];
      const match = locations.find((loc: any) => (loc.place_id || loc.id) === placeId);
      if (match) {
        console.log('[LocalFalcon] Match por Place ID nas Saved Locations:', match.name, placeId);
        return {
          placeId: match.place_id || match.id,
          lat: String(match.lat),
          lng: String(match.lng),
          name: match.name || ''
        };
      }
    }
  } catch (e) {
    console.error('[LocalFalcon] Erro ao buscar por Place ID nas salvas:', e);
  }
  return null;
};

/**
 * Adiciona uma empresa ao Local Falcon via Place ID direto
 */
const addLocationByPlaceId = async (
  key: string,
  placeId: string
): Promise<{ placeId: string; lat: string; lng: string; name: string } | null> => {
  try {
    const addRes = await postForm('/api-proxy/localfalcon/v2/locations/add', {
      api_key: key,
      platform: 'google',
      place_id: placeId
    });
    if (addRes.ok) {
      const addData = await addRes.json();
      const locData = addData?.data || addData?.location || {};
      const lat = String(locData.lat || '');
      const lng = String(locData.lng || '');
      const name = locData.name || locData.location_name || '';
      console.log('[LocalFalcon] Localização cadastrada via Place ID:', name, placeId);
      return { placeId, lat, lng, name };
    }
  } catch (e) {
    console.error('[LocalFalcon] Erro ao adicionar por Place ID:', e);
  }
  return await findSavedLocationByPlaceId(key, placeId);
};

// 🔒 REGRA ANTI-DUPLICAÇÃO E BLOQUEIO DE EXECUÇÕES CONSECUTIVAS:
// Impede que 2 solicitações do mesmo local/empresa sejam disparadas para a API do Local Falcon
const activeLocalFalconScans = new Map<string, Promise<LocalFalconResult>>();
const recentLocalFalconScans = new Map<string, { timestamp: number; result: LocalFalconResult }>();

const getLocalFalconLockKey = (locationName: string, placeId?: string, keyword?: string): string => {
  const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
  const pid = (placeId || '').trim();
  const loc = norm(locationName);
  const kw = norm(keyword || '');
  return pid ? `pid::${pid}::kw::${kw}` : `loc::${loc}::kw::${kw}`;
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

  const lockKey = getLocalFalconLockKey(params.locationName, params.placeId, params.keyword);

  // 1. BLOQUEIO DE VARREDURA EM ANDAMENTO: Se já existe um scan disparado para esta empresa/palavra-chave, reaproveita a Promise em execução
  if (activeLocalFalconScans.has(lockKey)) {
    console.warn(`[LocalFalcon Trava] 🛑 Solicitação duplicada em andamento bloqueada para "${params.locationName}" (${lockKey}). Reutilizando scan ativo...`);
    try {
      return await activeLocalFalconScans.get(lockKey)!;
    } catch {
      return { success: false, error: 'Uma varredura idêntica já está sendo executada no Local Falcon.' };
    }
  }

  // 2. BLOQUEIO DE VARREDURAS CONSECUTIVAS RECENTES (cooldown de 3 minutos / 180 segundos):
  // Se uma varredura para o mesmo local/empresa e palavra-chave foi concluída há menos de 3 minutos, reaproveita o resultado sem gastar créditos
  const recent = recentLocalFalconScans.get(lockKey);
  if (recent && (Date.now() - recent.timestamp < 180000)) {
    const elapsedSec = Math.round((Date.now() - recent.timestamp) / 1000);
    console.log(`[LocalFalcon Trava] 🔒 Nova solicitação bloqueada: varredura para "${params.locationName}" foi concluída há ${elapsedSec}s. Reutilizando resultado.`);
    return recent.result;
  }

  const executeScan = async (): Promise<LocalFalconResult> => {
    // 🛡️ PROTEÇÃO INTELIGENTE ANTI-GASTO REPETIDO DE CRÉDITOS:
    // Se não for um forceNewScan explícito, tenta PRIMEIRO reutilizar relatórios já gravados no histórico (0 Créditos).
    // Se já existir relatório para a empresa, consome 0 créditos. Se for a primeira varredura da empresa, executa o scan inicial.
    if (!params.forceNewScan) {
      console.log('[LocalFalcon Proteção] Verificando se já existe relatório gravado no histórico (0 Créditos)...');
      try {
        const historyCheck = await fetchLocalFalconReportHistory({
          locationName: params.locationName,
          keyword: params.keyword,
          radius: params.radius
        });
        if (historyCheck.success && (historyCheck.gridPoints?.length || 0) > 0) {
          const histRadius = historyCheck.radius !== undefined ? Number(historyCheck.radius) : null;
          const reqRadius = params.radius !== undefined && params.radius !== null ? Number(params.radius) : null;

          if (reqRadius === null || histRadius === null || Math.abs(histRadius - reqRadius) < 0.1) {
            console.log('[LocalFalcon Proteção] ✅ Relatório existente com mesmo raio encontrado no histórico! Reutilizando dados com 0 Créditos consumidos.');
            return historyCheck;
          } else {
            console.log(`[LocalFalcon Proteção] ⚠️ Relatório no histórico possui raio (${histRadius}km) diferente do raio solicitado (${reqRadius}km). Prosseguindo com nova varredura real...`);
          }
        }
        console.log('[LocalFalcon Proteção] ℹ️ Nenhum relatório prévio compatível localizado para esta empresa. Prosseguindo com varredura inicial...');
      } catch (hErr: any) {
        console.warn('[LocalFalcon Proteção] Aviso ao consultar histórico:', hErr);
      }
    }

    // Converte "3x3" → "3", "5x5" → "5", "7x7" → "7"
    const rawGrid = String(params.gridSize || settings?.localFalconGridSize || '5x5');
    const gridSize = rawGrid.includes('5') ? '5' : rawGrid.includes('7') ? '7' : '3';
    const creditsMap: Record<string, number> = { '3': 9, '5': 25, '7': 49 };
    const creditsUsed = creditsMap[gridSize] || 9;

  try {
    let placeId = params.placeId ? params.placeId.trim() : '';
    let lat = '';
    let lng = '';
    let foundName = '';

    // 1. Se um Place ID foi informado manualmente pelo usuário, usa EXCLUSIVAMENTE esse Place ID
    if (placeId) {
      console.log('[LocalFalcon] Place ID fornecido manualmente pelo usuário:', placeId);
      const savedByPid = await findSavedLocationByPlaceId(key, placeId);
      if (savedByPid) {
        placeId = savedByPid.placeId;
        lat = savedByPid.lat;
        lng = savedByPid.lng;
        foundName = savedByPid.name;
        console.log('[LocalFalcon] Localização encontrada nas salvas pelo Place ID:', foundName, placeId);
      } else {
        console.log('[LocalFalcon] Adicionando Place ID às Saved Locations via API:', placeId);
        const addedByPid = await addLocationByPlaceId(key, placeId);
        if (addedByPid) {
          placeId = addedByPid.placeId;
          lat = addedByPid.lat;
          lng = addedByPid.lng;
          foundName = addedByPid.name;
          console.log('[LocalFalcon] Localização adicionada com sucesso pelo Place ID:', foundName, placeId);
        } else {
          return {
            success: false,
            error: `Não foi possível localizar ou cadastrar o Place ID "${placeId}" no Local Falcon API. Verifique se o código informado é válido.`
          };
        }
      }
    } else {
      // 2. Se o Place ID NÃO foi informado, segue a busca padrão por nome da empresa
      console.log('[LocalFalcon] Verificando se empresa já está salva pelo nome:', params.locationName);
      const savedLoc = await findSavedLocation(key, params.locationName);

      if (savedLoc && savedLoc.placeId) {
        placeId = savedLoc.placeId;
        lat = savedLoc.lat;
        lng = savedLoc.lng;
        foundName = savedLoc.name;
        console.log('[LocalFalcon] Empresa já salva encontrada pelo nome:', savedLoc.name, placeId);
      } else {
        // Se NÃO estiver salva, faz o CADASTRO AUTOMÁTICO via API!
        console.log('[LocalFalcon] Empresa não encontrada nas salvas. Fazendo busca e cadastro AUTOMÁTICO por nome via API...');
        const autoLoc = await autoAddLocationToLocalFalcon(key, params.locationName, params.cityName);

        if (!autoLoc || !autoLoc.placeId) {
          return {
            success: false,
            error: `Não foi possível localizar a empresa "${params.locationName}" no Google Maps via Local Falcon API. Verifique se o nome está correto ou informe manualmente o Place ID.`
          };
        }

        placeId = autoLoc.placeId;
        lat = autoLoc.lat;
        lng = autoLoc.lng;
        foundName = autoLoc.name;
        console.log('[LocalFalcon] Cadastro automático por nome efetuado com sucesso:', autoLoc.name, placeId);
      }
    }

    // 🛡️ VALIDAÇÃO DE REGRA: Se a busca foi por NOME (sem Place ID manual) e o nome for muito diferente, exige confirmação
    if (!params.placeId && foundName && !isSimilarName(foundName, params.locationName)) {
      console.warn(`[LocalFalcon] ⚠️ Nome divergente! Solicitado: "${params.locationName}" | Encontrado: "${foundName}"`);
      if (params.onConfirmNameMismatch) {
        const confirmed = await params.onConfirmNameMismatch(foundName, params.locationName);
        if (!confirmed) {
          return {
            success: false,
            error: `Varredura cancelada pelo usuário. A empresa localizada ("${foundName}") difere da clínica solicitada ("${params.locationName}").`
          };
        }
      } else {
        const res = await Swal.fire({
          icon: 'warning',
          title: '⚠️ Confirmar Varredura Local Falcon',
          html: `A empresa encontrada no Local Falcon foi <b>"${foundName}"</b>, que é diferente da clínica solicitada <b>"${params.locationName}"</b>.<br/><br/>Deseja realmente prosseguir e aprovar a realização desta varredura no Local Falcon?`,
          showCancelButton: true,
          confirmButtonText: 'Sim, realizar scan assim mesmo',
          cancelButtonText: 'Não, cancelar scan',
          confirmButtonColor: '#0f172a',
          cancelButtonColor: '#e11d48'
        });

        if (!res.isConfirmed) {
          return {
            success: false,
            error: `Varredura cancelada pelo usuário. A empresa localizada ("${foundName}") difere da clínica solicitada ("${params.locationName}").`
          };
        }
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
      radius: String(params.radius || 2),
      measurement: 'km',
      platform: 'google'
    };

    console.log('[LocalFalcon] Rodando scan v2/run-scan com params:', { ...formParams, api_key: '***' });

    try {
      const res = await postForm('/api-proxy/localfalcon/v2/run-scan/', formParams, 75000);
      console.log('[LocalFalcon] Status do disparo do scan:', res.status, res.statusText);

      if (res.ok || res.status === 202) {
        const data = await res.json();
        console.log('[LocalFalcon] Scan disparado na API:', JSON.stringify(data, null, 2));
        const scanData = data?.data || {};
        const dataPoints = extractDataPointsArray(scanData);

        if (dataPoints.length > 0) {
          const reportKey = scanData.report_key;
          const mapImageUrl = scanData.image || (reportKey ? `https://lf-static-v2.localfalcon.com/image/${reportKey}` : '');
          const heatmapUrl = scanData.heatmap || (reportKey ? `https://lf-static-v2.localfalcon.com/heatmap-img/${reportKey}` : '');
          const solv = parseFloat(scanData.solv || '0');
          const avgRank = parseFloat(scanData.arp || scanData.atrp || '0');
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
      }
    } catch (e: any) {
      console.warn('[LocalFalcon] Disparo v2/run-scan em processamento assíncrono pelo servidor:', e.message);
    }

    // 4. AGUARDAR CONCLUSÃO DO SCAN NO LOCAL FALCON (POLLING DE ATÉ 10 MINUTOS - 0 CRÉDITOS):
    // Quando um scan é enviado via v2/run-scan, o Local Falcon coloca o relatório como "Scan In Progress"
    // e leva entre 1 e 5 minutos (até 10min) para gerar a grade de 25 pontos.
    // Fazemos verificações periódicas no histórico a cada 15 segundos (0 créditos) durante até 10 minutos.
    console.log('[LocalFalcon] Scan em andamento no servidor do Local Falcon. Aguardando conclusão (até 10 min, 0 créditos)...');
    
    const maxDurationMs = 10 * 60 * 1000; // 10 minutos máximo
    const intervalMs = 15000; // 15 segundos entre cada checagem
    const maxAttempts = Math.floor(maxDurationMs / intervalMs); // 40 tentativas
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const timeSec = attempt * 15;
      const minStr = Math.floor(timeSec / 60);
      const secStr = timeSec % 60;
      console.log(`[LocalFalcon] Checando se relatório ficou pronto no histórico (Tentativa ${attempt}/${maxAttempts} - ${minStr}m${secStr}s de 10m)...`);
      await new Promise(r => setTimeout(r, intervalMs));
      
      const historyCheck = await fetchLocalFalconReportHistory({
        locationName: params.locationName,
        keyword: params.keyword
      });

      if (historyCheck.success && (historyCheck.gridPoints?.length || 0) > 0) {
        console.log(`[LocalFalcon] ✅ Scan CONCLUÍDO com sucesso no Local Falcon na tentativa ${attempt} (${minStr}m${secStr}s)!`);
        return historyCheck;
      }
    }

    return {
      success: false,
      error: `O Local Falcon está demorando mais de 10 minutos para concluir esta análise na conta. O scan já foi iniciado no Local Falcon. Quando finalizar, clique no botão "📥 Puxar Análise Existente do Local Falcon (0 Créditos)".`
    };
  } catch (err: any) {
    console.error('[LocalFalcon] Erro geral no scan:', err);
    return { success: false, error: err.message || 'Erro de conexão com o Local Falcon' };
  }
  };

  const scanPromise = executeScan();
  activeLocalFalconScans.set(lockKey, scanPromise);

  try {
    const res = await scanPromise;
    if (res.success) {
      recentLocalFalconScans.set(lockKey, { timestamp: Date.now(), result: res });
    }
    return res;
  } finally {
    activeLocalFalconScans.delete(lockKey);
  }
};

/**
 * Busca no histórico do Local Falcon uma varredura já realizada para esta empresa,
 * obtendo os resultados SEM gastar novos créditos de busca.
 */
export const fetchLocalFalconReportHistory = async (params: {
  locationName: string;
  keyword?: string;
  radius?: number | string;
}): Promise<LocalFalconResult> => {
  const settings = await getGlobalSettings('gemini');
  const key = settings?.localFalconKey || '';

  if (!key) {
    return { success: false, error: 'Chave API do Local Falcon não configurada.' };
  }

  try {
    const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const targetNameNorm = norm(params.locationName);

    // 1. Tentar encontrar local registrado para obter placeId
    const savedLoc = await findSavedLocation(key, params.locationName, true);
    const placeId = savedLoc?.placeId || '';

    // 2. Consultar relatórios recentes da conta (limit: 50)
    const formBody: Record<string, string> = { api_key: key, limit: '50' };
    if (placeId) formBody.place_id = placeId;

    console.log('[LocalFalcon History] Consultando lista de relatórios da conta para:', params.locationName, '| placeId:', placeId || 'qualquer');
    let res = await postForm('/api-proxy/localfalcon/v1/reports/', formBody, 30000);

    // Se a busca com place_id falhou ou não retornou relatórios, tenta sem filtro de place_id para buscar por nome
    if (!res.ok || placeId) {
      const fallbackRes = await postForm('/api-proxy/localfalcon/v1/reports/', { api_key: key, limit: '50' }, 30000);
      if (fallbackRes.ok) res = fallbackRes;
    }

    if (!res.ok) {
      const errTxt = await res.text();
      return { success: false, error: `Local Falcon API (${res.status}): ${errTxt}` };
    }

    const data = await res.json();
    const reports = data?.data?.reports || data?.reports || data?.data || [];
    if (!Array.isArray(reports) || reports.length === 0) {
      return {
        success: false,
        error: `Nenhum relatório anterior foi encontrado na sua conta do Local Falcon para "${params.locationName}".`
      };
    }

    // 3. Filtrar relatórios: por placeId ou por similaridade real do nome da empresa
    let matchedReports = reports.filter((report: any) => {
      const reportPlaceId = report.place_id || report.location?.place_id || report.location?.placeId || '';
      if (placeId && reportPlaceId === placeId) return true;
      const rawReportName = report.name || report.location_name || report.location?.name || report.title || '';
      return isSimilarName(rawReportName, params.locationName);
    });

    if (matchedReports.length === 0) {
      return {
        success: false,
        error: `Nenhum relatório prévio localizado no histórico para "${params.locationName}".`
      };
    }

    // Sort matchedReports descending (newest first)
    matchedReports = [...matchedReports].reverse();
    matchedReports.sort((a: any, b: any) => {
      const timeA = getReportTimestamp(a);
      const timeB = getReportTimestamp(b);
      if (timeA > 0 && timeB > 0 && timeA !== timeB) {
        return timeB - timeA;
      }
      return 0;
    });

    const targetKeyword = norm(params.keyword || '');
    const targetRadius = params.radius !== undefined && params.radius !== null && params.radius !== '' ? Number(params.radius) : null;

    let matchedReport = matchedReports[0];
    if (targetKeyword) {
      const keywordMatches = matchedReports.filter((report: any) => norm(report.keyword || '') === targetKeyword);
      if (keywordMatches.length > 0) {
        if (targetRadius !== null) {
          const radiusMatch = keywordMatches.find((report: any) => {
            const r = parseFloat(report.radius || report.distance || report.grid_radius || '0');
            return Math.abs(r - targetRadius) < 0.1;
          });
          matchedReport = radiusMatch || keywordMatches[0];
        } else {
          matchedReport = keywordMatches[0];
        }
      }
    }

    const foundReportName = matchedReport.name || matchedReport.location_name || matchedReport.location?.name || matchedReport.title || '';
    if (!placeId && foundReportName && !isSimilarName(foundReportName, params.locationName)) {
      console.warn(`[LocalFalcon History] ⚠️ Relatório selecionado ("${foundReportName}") difere da clínica solicitada ("${params.locationName}"). Rejeitando histórico.`);
      return {
        success: false,
        error: `Nenhum relatório anterior compatível foi encontrado no histórico para "${params.locationName}".`
      };
    }

    const reportKey = matchedReport.report_key || matchedReport.scan_id || matchedReport.id;
    if (!reportKey) {
      return { success: false, error: 'Relatório encontrado no histórico, mas sem chave única de visualização.' };
    }

    // 4. Carregar detalhes completos do relatório (0 créditos de varredura)
    console.log('[LocalFalcon History] Carregando detalhes do relatório:', reportKey);
    const detailRes = await postForm(`/api-proxy/localfalcon/v1/reports/${reportKey}/`, { api_key: key }, 30000);
    const competitorRes = await postForm(`/api-proxy/localfalcon/v1/competitor-reports/${reportKey}`, { api_key: key }, 30000);

    let detailData: any = matchedReport;
    if (detailRes.ok) {
      const dJson = await detailRes.json();
      detailData = dJson?.data || dJson || matchedReport;
    }

    let competitorData: any = null;
    if (competitorRes.ok) {
      const cJson = await competitorRes.json();
      competitorData = cJson?.data || cJson;
    }

    const dataPoints = extractDataPointsArray(detailData);
    const { competitors, clientRank } = extractCompetitorRanking(dataPoints, placeId || matchedReport.place_id, params.locationName);

    if (competitorData) {
      const compList = competitorData.competitors || competitorData.data || [];
      if (Array.isArray(compList) && compList.length > 0) {
        compList.forEach((c: any) => {
          const name = c.name || c.business_name;
          const matchComp = competitors.find(cp => cp.nome.toLowerCase() === (name || '').toLowerCase());
          if (matchComp) {
            matchComp.nota = c.rating ? parseFloat(c.rating) : matchComp.nota;
            matchComp.avaliacoes = c.reviews ? parseInt(c.reviews, 10) : matchComp.avaliacoes;
            matchComp.endereco = c.address || matchComp.endereco;
          }
        });
      }
    }

    const solv = parseFloat(detailData.solv || matchedReport.solv || '0');
    const avgRank = parseFloat(detailData.arp || detailData.atrp || matchedReport.arp || '0');
    const mapImageUrl = detailData.image || (reportKey ? `https://lf-static-v2.localfalcon.com/image/${reportKey}` : '');
    const heatmapUrl = detailData.heatmap || (reportKey ? `https://lf-static-v2.localfalcon.com/heatmap-img/${reportKey}` : '');
    const rawRadius = parseFloat(detailData.radius || detailData.distance || detailData.grid_radius || matchedReport.radius || matchedReport.distance || matchedReport.grid_radius || '');
    const extractedRadius = !isNaN(rawRadius) && rawRadius > 0 ? rawRadius : (params.radius ? Number(params.radius) : 2);
    const extractedGridSize = detailData.grid_size || detailData.gridSize || matchedReport.grid_size || matchedReport.gridSize || '5x5';

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
      creditsUsed: 0,
      competitors,
      radius: extractedRadius,
      gridSize: extractedGridSize
    };
  } catch (err: any) {
    console.error('[LocalFalcon History] Erro ao consultar histórico:', err);
    return { success: false, error: err.message || 'Erro de conexão ao buscar histórico' };
  }
};

/**
 * Busca detalhes completos e concorrentes de um relatório específico do Local Falcon pelo scanId
 */
export const fetchLocalFalconReportDetailsByScanId = async (
  scanId: string,
  locationName = ''
): Promise<LocalFalconResult> => {
  const settings = await getGlobalSettings('gemini');
  const key = settings?.localFalconKey || '';

  if (!key || !scanId) {
    return { success: false, error: 'Chave API do Local Falcon ou Scan ID não informados.' };
  }

  try {
    const detailRes = await postForm(`/api-proxy/localfalcon/v1/reports/${scanId}/`, { api_key: key }, 30000);
    const competitorRes = await postForm(`/api-proxy/localfalcon/v1/competitor-reports/${scanId}`, { api_key: key }, 30000);

    if (!detailRes.ok && !competitorRes.ok) {
      return { success: false, error: `Falha ao consultar relatório ${scanId} no Local Falcon.` };
    }

    let detailData: any = {};
    if (detailRes.ok) {
      const dJson = await detailRes.json();
      detailData = dJson?.data || dJson || {};
    }

    let competitorData: any = null;
    if (competitorRes.ok) {
      const cJson = await competitorRes.json();
      competitorData = cJson?.data || cJson;
    }

    const dataPoints = extractDataPointsArray(detailData);
    const placeId = detailData.place_id || detailData.location?.place_id || '';
    const { competitors, clientRank } = extractCompetitorRanking(dataPoints, placeId, locationName);

    if (competitorData) {
      const compList = competitorData.competitors || competitorData.data || [];
      if (Array.isArray(compList) && compList.length > 0) {
        compList.forEach((c: any) => {
          const name = c.name || c.business_name;
          const matchComp = competitors.find(cp => cp.nome.toLowerCase() === (name || '').toLowerCase());
          if (matchComp) {
            matchComp.nota = c.rating ? parseFloat(c.rating) : matchComp.nota;
            matchComp.avaliacoes = c.reviews ? parseInt(c.reviews, 10) : matchComp.avaliacoes;
            matchComp.endereco = c.address || matchComp.endereco;
          }
        });
      }
    }

    const solv = parseFloat(detailData.solv || '0');
    const avgRank = parseFloat(detailData.arp || detailData.atrp || '0');
    const mapImageUrl = detailData.image || (scanId ? `https://lf-static-v2.localfalcon.com/image/${scanId}` : '');
    const heatmapUrl = detailData.heatmap || (scanId ? `https://lf-static-v2.localfalcon.com/heatmap-img/${scanId}` : '');
    const rawRadius = parseFloat(detailData.radius || detailData.distance || detailData.grid_radius || '');
    const extractedRadius = !isNaN(rawRadius) && rawRadius > 0 ? rawRadius : 2;
    const extractedGridSize = detailData.grid_size || detailData.gridSize || '5x5';

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
      scanId,
      mapImageUrl,
      heatmapUrl,
      creditsUsed: 0,
      competitors,
      radius: extractedRadius,
      gridSize: extractedGridSize
    };
  } catch (err: any) {
    console.error('[LocalFalcon] Erro ao buscar relatório por scanId:', err);
    return { success: false, error: err.message || 'Erro de conexão ao buscar relatório por scanId' };
  }
};

export const getReportTimestamp = (report: any): number => {
  if (!report) return 0;
  const d = report.created_at || report.date || report.created || report.timestamp;
  if (d) {
    const t = new Date(d).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const rawKey = report.scanId || report.scan_id || report.report_key || report.id;
  if (rawKey) {
    const num = Number(rawKey);
    if (!isNaN(num) && num > 0) return num;
  }
  return 0;
};

export interface LocalFalconHistoryItem {
  scanId: string;
  mapImageUrl: string;
  heatmapUrl?: string;
  radius: number;
  gridSize: string;
  solv?: number;
  keyword?: string;
  createdAt?: string;
  rawCreatedAt?: number;
  title?: string;
}

/**
 * Busca TODOS os relatórios prévios gravados no histórico do Local Falcon para uma empresa/keyword
 */
export const fetchLocalFalconAllReportsHistoryList = async (params: {
  locationName: string;
  keyword?: string;
}): Promise<LocalFalconHistoryItem[]> => {
  const settings = await getGlobalSettings('gemini');
  const key = settings?.localFalconKey || '';
  if (!key || !params.locationName) return [];

  try {
    const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const targetNameNorm = norm(params.locationName);
    const savedLoc = await findSavedLocation(key, params.locationName, true);
    const placeId = savedLoc?.placeId || '';

    const formBody: Record<string, string> = { api_key: key, limit: '50' };
    if (placeId) formBody.place_id = placeId;

    let res = await postForm('/api-proxy/localfalcon/v1/reports/', formBody, 30000);
    if (!res.ok || placeId) {
      const fallbackRes = await postForm('/api-proxy/localfalcon/v1/reports/', { api_key: key, limit: '50' }, 30000);
      if (fallbackRes.ok) res = fallbackRes;
    }
    if (!res.ok) return [];

    const data = await res.json();
    const reports = data?.data?.reports || data?.reports || data?.data || [];
    if (!Array.isArray(reports) || reports.length === 0) return [];

    let matchedReports = reports.filter((report: any) => {
      const reportPlaceId = report.place_id || report.location?.place_id || report.location?.placeId || '';
      if (placeId && reportPlaceId === placeId) return true;
      const rawReportName = report.name || report.location_name || report.location?.name || report.title || '';
      return isSimilarName(rawReportName, params.locationName);
    });

    if (matchedReports.length === 0) return [];

    if (params.keyword) {
      const targetKw = norm(params.keyword);
      const kwMatches = matchedReports.filter((r: any) => norm(r.keyword || '') === targetKw);
      if (kwMatches.length > 0) {
        matchedReports = kwMatches;
      }
    }

    // Sort matchedReports descending (newest first)
    matchedReports = [...matchedReports].reverse();
    matchedReports.sort((a: any, b: any) => {
      const timeA = getReportTimestamp(a);
      const timeB = getReportTimestamp(b);
      if (timeA > 0 && timeB > 0 && timeA !== timeB) {
        return timeB - timeA;
      }
      return 0;
    });

    return matchedReports.map((report: any) => {
      const rKey = report.report_key || report.scan_id || report.id;
      const rawRad = parseFloat(report.radius || report.distance || report.grid_radius || '');
      const rad = !isNaN(rawRad) && rawRad > 0 ? rawRad : 2;
      const gSize = report.grid_size || report.gridSize || '5x5';
      const solvVal = report.solv !== undefined ? parseFloat(report.solv) : undefined;
      const dateStr = report.created_at || report.date || report.created || report.timestamp || '';
      let formattedDate = '';
      const rawCreatedAt = getReportTimestamp(report);
      if (dateStr) {
        try {
          formattedDate = new Date(dateStr).toLocaleDateString('pt-BR');
        } catch (_) {}
      }

      return {
        scanId: rKey,
        mapImageUrl: report.image || (rKey ? `https://lf-static-v2.localfalcon.com/image/${rKey}` : ''),
        heatmapUrl: report.heatmap || (rKey ? `https://lf-static-v2.localfalcon.com/heatmap-img/${rKey}` : ''),
        radius: rad,
        gridSize: gSize,
        solv: isNaN(solvVal as number) ? undefined : solvVal,
        keyword: report.keyword || params.keyword || '',
        createdAt: formattedDate,
        rawCreatedAt: rawCreatedAt > 0 ? rawCreatedAt : undefined,
        title: report.name || report.title || ''
      };
    });
  } catch (err) {
    console.error('[LocalFalcon] Erro ao listar histórico completo:', err);
    return [];
  }
};
