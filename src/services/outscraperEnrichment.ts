import { getGlobalSettings } from './firestoreService';

export interface EnrichmentResult {
  clinicInstagram: string;
  cnpj: string;
  ownerName: string;
}

/**
 * Busca automática e profunda de Instagram, CNPJ e Sócios da clínica utilizando Outscraper + IA Gemini + Receita Federal
 */
export const enrichSingleLeadWithOutscraper = async (
  clinicName: string,
  location: string,
  siteUrl?: string
): Promise<EnrichmentResult> => {
  const settings = await getGlobalSettings('gemini');
  const outscraperKey = settings?.outscraperKey || '';
  const geminiKey = settings?.key || (import.meta.env?.VITE_GEMINI_API_KEY as string) || '';

  let clinicInstagram = '';
  let cnpj = '';
  let ownerName = '';

  const cleanLocation = location ? location.split('-')[0].trim() : '';
  const cleanName = clinicName ? clinicName.replace(/\|/g, ' ').replace(/Clínica Odontológica/gi, '').replace(/\s+/g, ' ').trim() || clinicName : '';

  // --- PASSO 1: Raspar o próprio site da clínica (Se houver URL) ---
  if (siteUrl && siteUrl.startsWith('http')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      let html = '';
      try {
        const directRes = await fetch(siteUrl, { signal: controller.signal });
        if (directRes.ok) html = await directRes.text();
      } catch (e) {
        const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(siteUrl)}`, { signal: controller.signal }).catch(() => null);
        if (proxyRes && proxyRes.ok) html = await proxyRes.text();
      }
      clearTimeout(timeoutId);

      if (html) {
        // Tenta capturar CNPJ no HTML do site
        const siteCnpjs = html.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g);
        if (siteCnpjs && siteCnpjs.length > 0) {
          const rawCnpj = siteCnpjs[0].replace(/\D/g, '');
          if (rawCnpj.length === 14) {
            cnpj = rawCnpj;
          }
        }

        // Tenta capturar Instagram no HTML do site
        const siteInstas = html.match(/instagram\.com\/([a-zA-Z0-9_\-\.]+)/i);
        if (siteInstas && siteInstas[1]) {
          const handle = siteInstas[1].toLowerCase();
          if (!['p', 'reels', 'explore', 'stories', 'tv', 'accounts', 'direct', 'share'].includes(handle)) {
            clinicInstagram = `https://instagram.com/${siteInstas[1]}`;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao raspar site oficial da clínica:', e);
    }
  }

  // --- PASSO 2: Outscraper Maps Search v2 + Google Search v2 (se tiver chave Outscraper) ---
  if (outscraperKey && (!cnpj || !clinicInstagram || !ownerName)) {
    try {
      // Outscraper Maps V2
      const mapsUrl = `https://api.app.outscraper.com/maps/search-v2?query=${encodeURIComponent(cleanName + ' in ' + cleanLocation)}&limit=1&async=false`;
      const mapsRes = await fetch(mapsUrl, { headers: { 'X-API-KEY': outscraperKey } }).catch(() => null);

      if (mapsRes && mapsRes.ok) {
        const mapsData = await mapsRes.json();
        if (mapsData.data && mapsData.data[0] && mapsData.data[0][0]) {
          const place = mapsData.data[0][0];
          if (!clinicInstagram && place.instagram) clinicInstagram = place.instagram;
          if (!clinicInstagram && place.social_media) {
            const foundInsta = place.social_media.find((s: string) => s.includes('instagram'));
            if (foundInsta) clinicInstagram = foundInsta;
          }
          if (!ownerName && (place.owner_title || place.owner)) {
            ownerName = place.owner_title || place.owner;
          }
        }
      }

      // Outscraper Google Search V2 para CNPJ
      if (!cnpj) {
        const googleQuery = `CNPJ ${cleanName} ${cleanLocation}`;
        const searchUrl = `https://api.app.outscraper.com/google-search-v2?query=${encodeURIComponent(googleQuery)}&limit=2&async=false`;
        const searchRes = await fetch(searchUrl, { headers: { 'X-API-KEY': outscraperKey } }).catch(() => null);

        if (searchRes && searchRes.ok) {
          const searchData = await searchRes.json();
          const rawText = JSON.stringify(searchData);

          const cnpjMatch = rawText.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/);
          if (cnpjMatch) {
            cnpj = cnpjMatch[0].replace(/\D/g, '');
          }

          if (!clinicInstagram) {
            const instaMatch = rawText.match(/instagram\.com\/([a-zA-Z0-9_\-\.]+)/i);
            if (instaMatch && instaMatch[1]) {
              const handle = instaMatch[1].toLowerCase();
              if (!['p', 'reels', 'explore', 'stories', 'tv', 'accounts', 'direct'].includes(handle)) {
                clinicInstagram = `https://instagram.com/${instaMatch[1]}`;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao consultar Outscraper:', err);
    }
  }

  // --- PASSO 3: Pesquisa Inteligente via Gemini AI (Se tiver chave Gemini) ---
  if (geminiKey && (!cnpj || !clinicInstagram || !ownerName)) {
    try {
      const prompt = `Você é um pesquisador corporativo especializado em empresas brasileiras.
Pesquise e identifique os dados públicos exatos da empresa:
- Nome da Clínica: "${clinicName}"
- Cidade/Localidade: "${location}"
- Website: "${siteUrl || ''}"

Retorne APENAS um objeto JSON VÁLIDO no seguinte formato (sem explicações nem markdown):
{
  "cnpj": "CNPJ com 14 dígitos apenas números ou em formato XX.XXX.XXX/XXXX-XX",
  "instagram": "Link ou @handle do Instagram oficial da clínica",
  "ownerName": "Nome dos sócios, donos ou administradores da clínica"
}`;

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }).catch(() => null);

      if (geminiRes && geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (!cnpj && parsed.cnpj) cnpj = parsed.cnpj.replace(/\D/g, '');
          if (!clinicInstagram && parsed.instagram) {
            clinicInstagram = parsed.instagram.startsWith('http') ? parsed.instagram : `https://instagram.com/${parsed.instagram.replace('@', '')}`;
          }
          if (!ownerName && parsed.ownerName) ownerName = parsed.ownerName;
        }
      }
    } catch (err) {
      console.warn('Erro no enriquecimento via Gemini:', err);
    }
  }

  // --- PASSO 4: Consultar Sócios na Receita Federal se tiver CNPJ (100% Grátis) ---
  if (cnpj && cnpj.length === 14) {
    // 1. Minha Receita
    try {
      const recRes = await fetch(`https://minhareceita.org/${cnpj}`);
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData.qsa && Array.isArray(recData.qsa) && recData.qsa.length > 0) {
          const names = recData.qsa.map((s: any) => s.nome_socio || s.nome).filter(Boolean).join(', ');
          if (names) ownerName = names;
        }
      }
    } catch (e) {}

    // 2. CNPJ.ws (Fallback)
    if (!ownerName) {
      try {
        const wsRes = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          const socios = wsData.estabelecimento?.socios || wsData.socios || [];
          if (Array.isArray(socios) && socios.length > 0) {
            const names = socios.map((s: any) => s.nome || s.nome_socio).filter(Boolean).join(', ');
            if (names) ownerName = names;
          }
        }
      } catch (e) {}
    }
  }

  return { clinicInstagram, cnpj, ownerName };
};
