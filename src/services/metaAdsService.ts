/**
 * Service para consultar a Biblioteca de Anúncios da Meta (Facebook / Instagram)
 * Usa o Access Token da Meta configurado no Painel Admin ou consulta via Meta Graph API v19.0
 */

import { getGlobalSettings } from './firestoreService';

export interface MetaAdsResult {
  success: boolean;
  clienteAnunciaMeta: boolean;
  concorrentesMeta: number;
  adCount?: number;
  error?: string;
}

export const checkMetaAds = async (companyName: string, keyword: string): Promise<MetaAdsResult> => {
  if (!companyName && !keyword) {
    return {
      success: false,
      clienteAnunciaMeta: false,
      concorrentesMeta: 0,
      error: 'Nome da empresa ou palavra-chave não informados'
    };
  }

  const settings = await getGlobalSettings('gemini');
  const token = settings?.metaAdsKey || '';

  if (!token || !token.trim()) {
    console.warn('[MetaAds] Access Token da Meta não configurado no Admin. Retornando estimativa.');
    return {
      success: true,
      clienteAnunciaMeta: false,
      concorrentesMeta: 0,
      error: 'Access Token da Meta Ad Library não configurado no Admin.'
    };
  }

  try {
    // 1. Verificar se a empresa específica possui anúncios ativos na Meta
    const companyUrl = `https://graph.facebook.com/v19.0/ads_archive?search_terms=${encodeURIComponent(companyName.trim())}&ad_reached_countries=['BR']&active_status=ACTIVE&limit=5&access_token=${encodeURIComponent(token.trim())}`;
    
    console.log('[MetaAds] Consultando anúncios da empresa:', companyName);
    const companyRes = await fetch(companyUrl).catch(() => null);

    let clienteAnunciaMeta = false;
    let companyAdCount = 0;

    if (companyRes && companyRes.ok) {
      const companyData = await companyRes.json();
      const ads = companyData?.data || [];
      companyAdCount = ads.length;
      clienteAnunciaMeta = ads.length > 0;
      console.log('[MetaAds] Anúncios ativos encontrados para empresa:', companyAdCount);
    } else if (companyRes) {
      const errTxt = await companyRes.text();
      console.warn('[MetaAds] Resposta da API Meta para empresa:', companyRes.status, errTxt);
    }

    // 2. Verificar quantos concorrentes na região estão anunciando no Meta para a palavra-chave
    let concorrentesMeta = 0;
    if (keyword && keyword.trim()) {
      const kwUrl = `https://graph.facebook.com/v19.0/ads_archive?search_terms=${encodeURIComponent(keyword.trim())}&ad_reached_countries=['BR']&active_status=ACTIVE&limit=20&access_token=${encodeURIComponent(token.trim())}`;
      
      console.log('[MetaAds] Consultando concorrentes para keyword:', keyword);
      const kwRes = await fetch(kwUrl).catch(() => null);

      if (kwRes && kwRes.ok) {
        const kwData = await kwRes.json();
        const kwAds = kwData?.data || [];
        // Contar páginas únicas de concorrentes
        const uniquePages = new Set(kwAds.map((a: any) => a.page_id || a.page_name).filter(Boolean));
        concorrentesMeta = Math.min(uniquePages.size, 10);
        console.log('[MetaAds] Concorrentes únicos ativos no Meta:', concorrentesMeta);
      }
    }

    return {
      success: true,
      clienteAnunciaMeta,
      concorrentesMeta,
      adCount: companyAdCount
    };
  } catch (err: any) {
    console.error('[MetaAds] Exceção ao consultar Meta Ad Library:', err);
    return {
      success: false,
      clienteAnunciaMeta: false,
      concorrentesMeta: 0,
      error: err.message || 'Erro ao consultar Meta Ad Library'
    };
  }
};
