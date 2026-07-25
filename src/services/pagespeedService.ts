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

  // Carrega a API key salva no Admin
  const settings = await getGlobalSettings('gemini');
  const apiKey = settings?.pageSpeedKey || '';

  try {
    // Usa proxy do Vite (/api-proxy/pagespeed) para evitar bloqueio CORS
    // Inclui a API key para evitar erro 429 (rate limit)
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
    const apiUrl = `/api-proxy/pagespeed/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(formattedUrl)}&strategy=mobile&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO${keyParam}`;

    console.log('[PageSpeed] Chamando com URL:', formattedUrl, '| API Key configurada:', !!apiKey);
    const res = await fetch(apiUrl);
    console.log('[PageSpeed] Status:', res.status, res.statusText);

    if (!res.ok) {
      const errTxt = await res.text();
      console.error('[PageSpeed] Erro:', res.status, errTxt);
      return {
        success: false,
        velocidade: 'sem dados',
        acessibilidade: 'sem dados',
        praticas: 'sem dados',
        seo: 'sem dados',
        error: `PageSpeed API status ${res.status}: ${errTxt.slice(0, 200)}`
      };
    }

    const data = await res.json();
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
      error: err.message || 'Erro de conexão com PageSpeed API'
    };
  }
};
