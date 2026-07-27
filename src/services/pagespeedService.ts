/**
 * Service para consultar a API oficial do Google PageSpeed Insights (Mobile)
 * Usa a API Key salva no Admin para evitar rate limit 429
 */

import { getGlobalSettings } from './firestoreService';

export interface PageSpeedResult {
  success: boolean;
  velocidade?: number | 'sem dados';
  acessibilidade?: number | 'sem dados';
  praticas?: number | 'sem dados';
  seo?: number | 'sem dados';
  error?: string;
}

export const runPageSpeedAnalysis = async (url: string): Promise<PageSpeedResult> => {
  if (!url || !url.trim()) {
    return {
      success: false,
      velocidade: 'sem dados',
      acessibilidade: 'sem dados',
      praticas: 'sem dados',
      seo: 'sem dados',
      error: 'URL do site não informada'
    };
  }

  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  const settings = await getGlobalSettings('gemini');
  const apiKey = settings?.pageSpeedKey || '';

  try {
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
    const directApiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&strategy=mobile&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO${keyParam}`;
    const proxyApiUrl = `/api-proxy/pagespeed/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&strategy=mobile&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO${keyParam}`;

    console.log('[PageSpeed] Chamando com URL:', formattedUrl, '| API Key configurada:', !!apiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    let res: Response;
    try {
      res = await fetch(directApiUrl, { signal: controller.signal }).catch(async () => {
        return await fetch(proxyApiUrl, { signal: controller.signal });
      });
    } finally {
      clearTimeout(timer);
    }
    console.log('[PageSpeed] Status:', res.status, res.statusText);

    const rawText = await res.text();

    if (!res.ok) {
      console.error('[PageSpeed] Erro:', res.status, rawText);
      return {
        success: false,
        velocidade: 'sem dados',
        acessibilidade: 'sem dados',
        praticas: 'sem dados',
        seo: 'sem dados',
        error: `PageSpeed API status ${res.status}: ${rawText.slice(0, 150)}`
      };
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('[PageSpeed] Erro ao parsear JSON:', parseErr, rawText.slice(0, 200));
      return {
        success: false,
        velocidade: 'sem dados',
        acessibilidade: 'sem dados',
        praticas: 'sem dados',
        seo: 'sem dados',
        error: 'A API retornou uma resposta HTML em vez de JSON (verifique se a URL do site é válida).'
      };
    }

    const categories = data?.lighthouseResult?.categories || {};

    const speed = categories.performance?.score !== undefined ? Math.round(categories.performance.score * 100) : 'sem dados';
    const acc = categories.accessibility?.score !== undefined ? Math.round(categories.accessibility.score * 100) : 'sem dados';
    const prac = categories['best-practices']?.score !== undefined ? Math.round(categories['best-practices'].score * 100) : 'sem dados';
    const seo = categories.seo?.score !== undefined ? Math.round(categories.seo.score * 100) : 'sem dados';

    console.log('[PageSpeed] Notas:', { speed, acc, prac, seo });

    return {
      success: true,
      velocidade: speed,
      acessibilidade: acc,
      praticas: prac,
      seo: seo
    };
  } catch (err: any) {
    console.error('[PageSpeed] Exceção:', err);
    return {
      success: false,
      velocidade: 'sem dados',
      acessibilidade: 'sem dados',
      praticas: 'sem dados',
      seo: 'sem dados',
      error: err.name === 'AbortError' ? 'Tempo limite excedido (60s) — tente novamente' : (err.message || 'Erro de conexão com PageSpeed API')
    };
  }
};
