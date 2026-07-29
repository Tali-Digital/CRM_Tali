/**
 * Service para consultar a Biblioteca de Anúncios da Meta (Facebook / Instagram)
 * Usa o Access Token da Meta configurado no Painel Admin ou consulta via Meta Graph API v19.0
 */

import { getGlobalSettings } from './firestoreService';

export interface MetaAdsResult {
  success: boolean;
  clienteAnunciaMeta?: boolean;
  concorrentesMeta: number;
  competitorsVerified?: boolean;
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
    console.warn('[MetaAds] Access Token da Meta não configurado no Admin.');
    return {
      success: false,
      concorrentesMeta: 0,
      error: 'Access Token da Meta Ad Library não configurado no Admin.'
    };
  }

  try {
    // 1. Verificar se a empresa específica possui anúncios ativos na Meta
    const fields = 'id,page_id,page_name,ad_delivery_start_time,ad_delivery_stop_time';
    const companyUrl = `https://graph.facebook.com/v23.0/ads_archive?search_terms=${encodeURIComponent(companyName.trim())}&ad_reached_countries=${encodeURIComponent('["BR"]')}&active_status=ACTIVE&ad_type=ALL&fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(token.trim())}`;
    
    console.log('[MetaAds] Consultando anúncios da empresa:', companyName);
    const companyRes = await fetch(companyUrl).catch(() => null);

    let clienteAnunciaMeta: boolean | undefined;
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
      return {
        success: false,
        concorrentesMeta: 0,
        error: `Meta Ad Library API (${companyRes.status}): não foi possível confirmar anúncios ativos.`
      };
    } else {
      return {
        success: false,
        concorrentesMeta: 0,
        error: 'Meta Ad Library API: sem resposta ao consultar anúncios ativos.'
      };
    }

    // 2. Verificar quantos concorrentes na região estão anunciando no Meta para a palavra-chave
    let concorrentesMeta = 0;
    let competitorsVerified = false;
    if (keyword && keyword.trim()) {
      const kwUrl = `https://graph.facebook.com/v23.0/ads_archive?search_terms=${encodeURIComponent(keyword.trim())}&ad_reached_countries=${encodeURIComponent('["BR"]')}&active_status=ACTIVE&ad_type=ALL&fields=${encodeURIComponent(fields)}&limit=100&access_token=${encodeURIComponent(token.trim())}`;
      
      console.log('[MetaAds] Consultando concorrentes para keyword:', keyword);
      const kwRes = await fetch(kwUrl).catch(() => null);

      if (kwRes && kwRes.ok) {
        const kwData = await kwRes.json();
        const kwAds = kwData?.data || [];
        // Contar páginas únicas de concorrentes
        const uniquePages = new Set(kwAds.map((a: any) => a.page_id || a.page_name).filter(Boolean));
        concorrentesMeta = Math.min(uniquePages.size, 10);
        competitorsVerified = true;
        console.log('[MetaAds] Concorrentes únicos ativos no Meta:', concorrentesMeta);
      }
    }

    return {
      success: true,
      clienteAnunciaMeta,
      concorrentesMeta,
      competitorsVerified,
      adCount: companyAdCount
    };
  } catch (err: any) {
    console.error('[MetaAds] Exceção ao consultar Meta Ad Library:', err);
    return {
      success: false,
      concorrentesMeta: 0,
      error: err.message || 'Erro ao consultar Meta Ad Library'
    };
  }
};
