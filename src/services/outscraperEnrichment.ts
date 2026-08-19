import { getGlobalSettings } from './firestoreService';

// Helper para calcular idade da empresa a partir da data de abertura
export const calcAgeFromDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const match = dateStr.match(/\b(19\d\d|20\d\d)\b/);
  if (match) {
    const year = parseInt(match[1], 10);
    if (year > 1900 && year <= new Date().getFullYear()) {
      const diff = new Date().getFullYear() - year;
      return diff <= 0 ? 'Menos de 1 ano' : `${diff} ano${diff > 1 ? 's' : ''}`;
    }
  }
  return '';
};

export interface EnrichmentResult {
  clinicInstagram: string;
  cnpj: string;
  ownerName: string;
  age?: string;
  collaborators?: string;
  size?: string;
}

/**
 * Busca automática e profunda de Instagram, CNPJ, Sócios, Idade, Colaboradores e Tamanho da clínica utilizando Outscraper + IA Gemini + Receita Federal
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
  let age = '';
  let collaborators = '';
  let size = '';

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

        // Tenta encontrar menção a número de consultórios ou cadeiras no site
        const chairMatch = html.match(/(\d+)\s*(consultórios|cadeiras|equipamentos|salas de atendimento)/i);
        if (chairMatch && chairMatch[1]) {
          size = `${chairMatch[1]} consultórios`;
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
  if (geminiKey && (!cnpj || !clinicInstagram || !ownerName || !age || !collaborators || !size)) {
    try {
      const prompt = `Você é um auditor de dados corporativos estrito.
Sua missão é extrair APENAS informações REAIS e VERIFICÁVEIS publicamente da empresa:
- Nome da Clínica: "${clinicName}"
- Cidade/Localidade: "${location}"
- Website: "${siteUrl || ''}"

REGRA RÍGIDA E ABSOLUTA:
NUNCA invente, adivinhe ou chute nenhum dado fictício. Se uma informação não for encontrada publicamente com 100% de certeza, retorne o campo como string vazia "".

Retorne APENAS um objeto JSON VÁLIDO (sem markdown nem explicações):
{
  "cnpj": "CNPJ real com 14 dígitos ou '' se não souber com certeza",
  "instagram": "Link ou @handle real do Instagram ou '' se não souber com certeza",
  "ownerName": "Nome dos sócios/donos reais ou '' se não souber com certeza",
  "age": "Idade real em anos (ex: '8 anos') ou '' se não souber com certeza",
  "collaborators": "Nº real ou porte de colaboradores (ex: '1 a 9 colaboradores') ou '' se não souber com certeza",
  "size": "Número real de consultórios/cadeiras ou '' se não souber com certeza"
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
          if (!age && parsed.age) age = parsed.age;
          if (!collaborators && parsed.collaborators) collaborators = parsed.collaborators;
          if (!size && parsed.size) size = parsed.size;
        }
      }
    } catch (err) {
      console.warn('Erro no enriquecimento via Gemini:', err);
    }
  }

  // --- PASSO 4: Consultar Dados na Receita Federal se tiver CNPJ (100% Grátis) ---
  if (cnpj && cnpj.length === 14) {
    // Helper para formatar porte da empresa em nº de colaboradores
    const formatPorteToCollaborators = (porte: string) => {
      if (!porte) return '';
      const p = String(porte).toUpperCase();
      if (p.includes('ME') || p.includes('MICRO')) return '1 a 9 colaboradores';
      if (p.includes('EPP') || p.includes('PEQUENO')) return '10 a 49 colaboradores';
      if (p.includes('DEMAIS') || p.includes('GRANDE')) return '50+ colaboradores';
      return '';
    };

    // 1. Minha Receita
    try {
      const recRes = await fetch(`https://minhareceita.org/${cnpj}`);
      if (recRes.ok) {
        const recData = await recRes.json();
        if (recData.qsa && Array.isArray(recData.qsa) && recData.qsa.length > 0) {
          const names = recData.qsa.map((s: any) => s.nome_socio || s.nome).filter(Boolean).join(', ');
          if (names) ownerName = names;
        }
        if (recData.abertura) {
          const calculatedAge = calcAgeFromDate(recData.abertura);
          if (calculatedAge) age = calculatedAge;
        }
        if (!collaborators && recData.porte) {
          const formattedColabs = formatPorteToCollaborators(recData.porte);
          if (formattedColabs) collaborators = formattedColabs;
        }
      }
    } catch (e) {}

    // 2. CNPJ.ws (Fallback)
    if (!ownerName || !age || !collaborators) {
      try {
        const wsRes = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
        if (wsRes.ok) {
          const wsData = await wsRes.json();
          const socios = wsData.estabelecimento?.socios || wsData.socios || [];
          if (!ownerName && Array.isArray(socios) && socios.length > 0) {
            const names = socios.map((s: any) => s.nome || s.nome_socio).filter(Boolean).join(', ');
            if (names) ownerName = names;
          }
          const aberturaDate = wsData.estabelecimento?.data_inicio_atividade || wsData.data_inicio_atividade;
          if (aberturaDate) {
            const calculatedAge = calcAgeFromDate(aberturaDate);
            if (calculatedAge) age = calculatedAge;
          }
          const porteStr = wsData.porte?.descricao || wsData.porte;
          if (!collaborators && porteStr) {
            const formattedColabs = formatPorteToCollaborators(porteStr);
            if (formattedColabs) collaborators = formattedColabs;
          }
        }
      } catch (e) {}
    }
  }

  return { clinicInstagram, cnpj, ownerName, age, collaborators, size };
};

