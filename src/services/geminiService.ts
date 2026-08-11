import { Prospect } from '../types';
import { getGlobalSettings } from './firestoreService';

/**
 * Interface para representar o resultado da chamada do Gemini
 */
export interface GeminiAnalysisResult {
  success: boolean;
  content: string;
  isMock: boolean;
  error?: string;
}

/**
 * FunÃ§Ã£o para gerar um relatÃ³rio inteligente de IA para o prospecto
 */
export const generateProspectReport = async (
  prospect: Prospect,
  customApiKey?: string
): Promise<GeminiAnalysisResult> => {
  // 1. Resolver a API Key (prioridade: chave manual -> banco de dados -> .env)
  const settings = await getGlobalSettings('gemini');
  const apiKey = customApiKey || 
                 settings?.key || 
                 (import.meta.env?.VITE_GEMINI_API_KEY as string) || 
                 '';

  // Se nÃ£o houver chave de API configurada, usamos o Mock Inteligente
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: true,
      isMock: true,
      content: generateMockReport(prospect)
    };
  }

  try {
    const prompt = `
VocÃª Ã© uma InteligÃªncia Artificial especialista em vendas B2B e marketing digital de alta performance focada exclusivamente no nicho de clÃ­nicas odontolÃ³gicas.
Analise os dados abaixo do seguinte prospecto (potencial cliente) de uma agÃªncia de marketing:

DADOS DO PROSPECTO:
- Nome da ClÃ­nica: ${prospect.clinicName}
- Cidade/LocalizaÃ§Ã£o: ${prospect.location}
- Instagram da ClÃ­nica: ${prospect.clinicInstagram || 'NÃ£o informado'}
- Site da ClÃ­nica: ${prospect.site || 'NÃ£o informado'}
- Nome do ProprietÃ¡rio/Dono: ${prospect.ownerName || 'NÃ£o informado'}
- Instagram do Dono: ${prospect.ownerInstagram || 'NÃ£o informado'}
- Tamanho/Estrutura: ${prospect.size || 'NÃ£o informado'}
- Idade da Empresa: ${prospect.age || 'NÃ£o informado'}
- Nota no Google Meu NegÃ³cio: ${prospect.gmnRating || 'NÃ£o informada'}
- Quantidade de AvaliaÃ§Ãµes: ${prospect.gmnReviewsCount || 'NÃ£o informada'}
- ObservaÃ§Ãµes comerciais existentes: ${prospect.observations || 'Nenhuma'}

INSTRUÃ‡Ã•ES DE RESPOSTA:
Gere um relatÃ³rio estruturado em Markdown com as seguintes seÃ§Ãµes. O tom deve ser altamente profissional, estratÃ©gico, objetivo e pronto para aÃ§Ã£o comercial.
A resposta deve ser 100% em PortuguÃªs.

### ðŸŒŸ VisÃ£o Geral da ClÃ­nica
- FaÃ§a um resumo de quem eles sÃ£o, baseado no nome, idade e localizaÃ§Ã£o.
- Estime o posicionamento de mercado (premium, popular, mÃ©dio) com base nos dados.

### ðŸ”� DiagnÃ³stico de PresenÃ§a Digital & GMN
- Analise a nota (${prospect.gmnRating || 'N/D'}) e nÃºmero de avaliaÃ§Ãµes (${prospect.gmnReviewsCount || 'N/D'}) no Google Meu NegÃ³cio. Indique se Ã© excelente, precisa de melhorias urgentes ou se hÃ¡ risco de reputaÃ§Ã£o.
- Analise a presenÃ§a com base em ter ou nÃ£o site e Instagram da clÃ­nica.
- Sugira 2 a 3 pontos rÃ¡pidos de otimizaÃ§Ã£o para a presenÃ§a digital deles (SEO local, otimizaÃ§Ã£o de perfil, conversÃ£o de trÃ¡fego).

### ðŸ’¡ Oportunidades & Pontos de Dor
- Identifique possÃ­veis dores (ex: falta de novos pacientes recorrentes, concorrÃªncia na regiÃ£o, reputaÃ§Ã£o digital baixa, site desatualizado).
- Mostre onde o CRM ou os serviÃ§os da agÃªncia podem gerar o maior impacto financeiro.

### ðŸŽ¯ Roteiro de Abordagem Comercial Recomendado
- Crie um roteiro rÃ¡pido (1 a 2 parÃ¡grafos) ou uma mensagem inicial personalizada de quebra-gelo adaptada a este prospecto especÃ­fico, usando o nome do dono (${prospect.ownerName || 'Dr./Dra.'}) e citando pontos reais da clÃ­nica.
- A abordagem deve soar natural, consultiva e sem parecer spam de vendas.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Formato de resposta da API do Gemini invÃ¡lido.');
    }

    return {
      success: true,
      isMock: false,
      content: generatedText
    };
  } catch (error: any) {
    console.error('Erro ao chamar API do Gemini:', error);
    return {
      success: false,
      isMock: false,
      content: '',
      error: error.message || 'Erro desconhecido ao conectar com o Gemini.'
    };
  }
};

/**
 * Gera um relatÃ³rio simulado elegante e estruturado
 */
const generateMockReport = (prospect: Prospect): string => {
  const ownerLabel = prospect.ownerName && prospect.ownerName !== 'NÃ£o encontrado'
    ? prospect.ownerName.split(',')[0].trim() 
    : 'Doutor(a)';
  
  const formattedRating = prospect.gmnRating ? `${prospect.gmnRating} â­�` : 'NÃ£o informada';
  const reviewsCount = prospect.gmnReviewsCount ? `${prospect.gmnReviewsCount} avaliaÃ§Ãµes` : 'Sem avaliaÃ§Ãµes';

  return `### ðŸŒŸ VisÃ£o Geral da ClÃ­nica
- **ClÃ­nica:** ${prospect.clinicName}
- **LocalizaÃ§Ã£o:** ${prospect.location || 'NÃ£o informada'}
- **Idade da Empresa:** ${prospect.age || 'NÃ£o informada'}
- **Perfil Geral:** ClÃ­nica odontolÃ³gica estabelecida na regiÃ£o de ${prospect.location || 'seu mercado local'}. Pelo histÃ³rico de ${prospect.age || 'funcionamento'}, aparenta ter uma base de clientes recorrentes fÃ­sica, mas com alto potencial de expansÃ£o atravÃ©s de canais digitais.

### ðŸ”� DiagnÃ³stico de PresenÃ§a Digital & GMN
- **Google Meu NegÃ³cio:** Nota **${formattedRating}** com **${reviewsCount}**. 
  ${prospect.gmnRating && parseFloat(prospect.gmnRating) < 4.5 
    ? 'âš ï¸� *Alerta:* A nota mÃ©dia estÃ¡ abaixo do ideal (4.5). HÃ¡ necessidade imediata de campanhas de feedback positivo e tratativa de avaliaÃ§Ãµes negativas para recuperar a credibilidade local.' 
    : 'âœ… *Status:* A reputaÃ§Ã£o online estÃ¡ consolidada, excelente gancho para campanhas de atraÃ§Ã£o baseadas em prova social.'}
- **Website:** ${prospect.site && prospect.site !== 'NÃ£o encontrado' ? 'DisponÃ­vel. Excelente oportunidade para otimizar SEO e campanhas de trÃ¡fego pago direcionadas (Google Ads).' : 'â�Œ *Alerta:* Sem site profissional ativo. Isso causa perda de autoridade e impede estratÃ©gias de captaÃ§Ã£o por busca ativa no Google.'}
- **Instagram:** ${prospect.clinicInstagram && prospect.clinicInstagram !== 'NÃ£o encontrado' ? 'Ativo. Ã‰ recomendÃ¡vel analisar a frequÃªncia de postagens e o nÃ­vel de engajamento real.' : 'â�Œ Sem perfil no Instagram ativo ou nÃ£o mapeado.'}

### ðŸ’¡ Oportunidades & Pontos de Dor
1. **AtraÃ§Ã£o de Pacientes High-Ticket:** Implementar funis de venda focados em procedimentos de maior valor (Implantes, Invisalign, Lentes), aproveitando a forÃ§a da marca fÃ­sica na regiÃ£o de ${prospect.location || 'atuaÃ§Ã£o'}.
2. **SEO Local:** Com o ajuste e otimizaÃ§Ã£o das palavras-chave do perfil no Google Meu NegÃ³cio, a clÃ­nica pode subir nas posiÃ§Ãµes de busca orgÃ¢nica local sem custos extras de mÃ­dia.
3. **AutomaÃ§Ã£o de Agendamentos:** Otimizar o tempo da recepÃ§Ã£o e diminuir o no-show integrando ferramentas automÃ¡ticas de confirmaÃ§Ã£o.

### ðŸŽ¯ Roteiro de Abordagem Comercial Recomendado
*Abordagem consultiva e focada em valor, sem forÃ§ar venda:*

"OlÃ¡, **${ownerLabel}**, tudo bem? Acompanho o excelente trabalho da **${prospect.clinicName}** em ${prospect.location || 'sua regiÃ£o'}. Notei que vocÃªs tÃªm Ã³timas avaliaÃ§Ãµes dos pacientes no Google! 

Fizemos um rÃ¡pido estudo da presenÃ§a digital de vocÃªs na regiÃ£o e identificamos 3 pontos especÃ­ficos onde vocÃªs estÃ£o perdendo espaÃ§o para concorrentes na busca por tratamentos de alto valor. Criamos um mini relatÃ³rio com essas sugestÃµes. 

Faria sentido conversarmos 5 minutos esta semana para eu te apresentar esse diagnÃ³stico sem compromisso?"

---
*Nota: Este relatÃ³rio foi gerado em Modo de DemonstraÃ§Ã£o (Mock). Para habilitar respostas completas em tempo real da IA, insira sua chave da API do Gemini nas configuraÃ§Ãµes.*`;
};

/**
 * FunÃ§Ã£o para gerar uma mensagem de abordagem personalizada para o Instagram usando a IA do Gemini
 */
export const generateInstagramMessage = async (
  prospect: Prospect,
  customApiKey?: string
): Promise<GeminiAnalysisResult> => {
  const settings = await getGlobalSettings('gemini');
  const apiKey = customApiKey || 
                 settings?.key || 
                 (import.meta.env?.VITE_GEMINI_API_KEY as string) || 
                 '';

  if (!apiKey || apiKey.trim() === '') {
    return {
      success: true,
      isMock: true,
      content: generateMockInstagramMessage(prospect)
    };
  }

  try {
    const prompt = `
VocÃª Ã© uma InteligÃªncia Artificial agindo como um agente de prospecÃ§Ã£o e vendas B2B de alta performance da agÃªncia TalÃ­ Digital, focado exclusivamente no nicho de clÃ­nicas odontolÃ³gicas.
Sua tarefa Ã© escrever uma mensagem direta de abordagem personalizada para enviar via direct do Instagram para o dono ou responsÃ¡vel pela clÃ­nica odontolÃ³gica descrita nos dados abaixo.
A mensagem DEVE ter atÃ© no mÃ¡ximo 999 caracteres e ser baseada no roteiro modelo abaixo:

MODELO DE REFERÃŠNCIA:
"Oi, [Nome do(a) Doutor(a)], tudo bem?
Me chamo Helenilton Alves, sou um dos fundadores da TalÃ­ Digital. Vi o perfil da [Nome da ClÃ­nica] no Google, entrei aqui no Instagram e achei incrÃ­vel o trabalho de vocÃªs aÃ­ no [LocalizaÃ§Ã£o/EdifÃ­cio/Bairro/Cidade]. Manter uma nota de [Nota] com [X] avaliaÃ§Ãµes Ã© um baita indicativo de excelÃªncia, e foi justamente por notar esse padrÃ£o de qualidade que fiz questÃ£o de entrar em contato.

NÃ³s somos especialistas no ramo odontolÃ³gico e, com o nosso mÃ©todo â€” o MÃ©todo TALÃ� â€”, nÃ³s ajudamos clÃ­nicas com o seu perfil a organizarem o posicionamento digital e o atendimento para destravar um faturamento maior.

Olhando a presenÃ§a digital de vocÃªs hoje, notei alguns pontos cegos que podem estar fazendo a clÃ­nica perder pacientes premium para a concorrÃªncia na regiÃ£o.

Se tiver 15 minutinhos nesta semana, eu queria te mostrar um diagnÃ³stico rÃ¡pido desses pontos onde pode ter dinheiro ficando na mesa.

VocÃª tem interesse em dar uma olhada nessa anÃ¡lise? Que dia fica bom para conversarmos?"

DADOS DO PROSPECTO:
- Nome da ClÃ­nica: ${prospect.clinicName}
- Cidade/LocalizaÃ§Ã£o: ${prospect.location || 'NÃ£o informada'}
- Nome do Dono (Doutor/Doutora): ${prospect.ownerName || 'Doutor(a)'}
- Nota no Google Meu NegÃ³cio: ${prospect.gmnRating || 'NÃ£o informada'}
- Quantidade de AvaliaÃ§Ãµes Google: ${prospect.gmnReviewsCount || 'NÃ£o informada'}
- ObservaÃ§Ãµes adicionais: ${prospect.observations || ''}

REGRAS CRÃ�TICAS DE GERAÃ‡ÃƒO:
1. A mensagem gerada deve ser contÃ­nua, fluida e pronta para envio, contendo NO MÃ�XIMO 999 caracteres (limite absoluto).
2. Substitua os placeholders ([Nome do(a) Doutor(a)], [Nome da ClÃ­nica], [LocalizaÃ§Ã£o...], [Nota], [X]) com os dados reais do prospecto. Se algum dado estiver faltando (ex: nome do dono), adapte de forma educada para "Doutor(a)" ou use o nome da clÃ­nica, mas sem deixar placeholders visÃ­veis.
3. Personalize a mensagem de forma inteligente usando os dados reais fornecidos para mostrar que vocÃª realmente analisou a clÃ­nica deles.
4. Foque estritamente em clÃ­nicas odontolÃ³gicas.
5. NÃ£o adicione observaÃ§Ãµes, explicaÃ§Ãµes, saudaÃ§Ãµes de IA ou formataÃ§Ã£o em markdown (negritos com asteriscos, etc.). Retorne APENAS o texto puro da mensagem gerada, exatamente no formato para copiar e colar no Instagram direct.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Formato de resposta da API do Gemini invÃ¡lido.');
    }

    let cleanText = generatedText.trim();
    if (cleanText.length > 999) {
      cleanText = cleanText.substring(0, 996) + '...';
    }

    return {
      success: true,
      isMock: false,
      content: cleanText
    };
  } catch (error: any) {
    console.error('Erro ao gerar mensagem de Instagram:', error);
    return {
      success: false,
      isMock: false,
      content: '',
      error: error.message || 'Erro ao gerar mensagem de Instagram.'
    };
  }
};

/**
 * Gera uma mensagem de direct do Instagram personalizada simulada baseada nos dados do prospecto
 */
const generateMockInstagramMessage = (prospect: Prospect): string => {
  const ownerLabel = prospect.ownerName && prospect.ownerName !== 'NÃ£o encontrado' && prospect.ownerName !== 'NÃ£o informado'
    ? prospect.ownerName.split(',')[0].trim() 
    : 'Doutor(a)';
  
  const ratingText = prospect.gmnRating ? prospect.gmnRating : '5.0';
  const reviewsText = prospect.gmnReviewsCount ? prospect.gmnReviewsCount : 'dezenas de';
  const locationText = prospect.location ? prospect.location : 'sua regiÃ£o';

  return `Oi, ${ownerLabel}, tudo bem?

Me chamo Helenilton Alves, sou um dos fundadores da TalÃ­ Digital. Vi o perfil da ${prospect.clinicName} no Google, entrei aqui no Instagram e achei incrÃ­vel o trabalho de vocÃªs aÃ­ no ${locationText}. Manter uma nota de ${ratingText} com ${reviewsText} avaliaÃ§Ãµes Ã© um baita indicativo de excelÃªncia, e foi justamente por notar esse padrÃ£o de qualidade que fiz questÃ£o de entrar em contato.

NÃ³s somos especialistas no ramo odontolÃ³gico e, com o nosso mÃ©todo â€” o MÃ©todo TALÃ� â€”, nÃ³s ajudamos clÃ­nicas com o seu perfil a organizarem o posicionamento digital e o atendimento para destravar um faturamento maior.

Olhando a presenÃ§a digital de vocÃªs hoje, notei alguns pontos cegos que podem estar fazendo a clÃ­nica perder pacientes premium para a concorrÃªncia na regiÃ£o.

Se tiver 15 minutinhos nesta semana, eu queria te mostrar um diagnÃ³stico rÃ¡pido desses pontos onde pode ter dinheiro ficando na mesa.

VocÃª tem interesse em dar uma olhada nessa anÃ¡lise? Que dia fica bom para conversarmos?`;
};

/**
 * Interface para representar o resultado da estruturaÃ§Ã£o de prospecto com IA
 */
export interface GeminiParseResult {
  success: boolean;
  prospect: Partial<Prospect>;
  aiFilledFields: string[];
  isMock: boolean;
  error?: string;
}

/**
 * Processa um bloco de texto livre usando o Gemini para extrair e estruturar dados do prospecto
 */
export const parseProspectFromBlockText = async (
  text: string,
  customApiKey?: string
): Promise<GeminiParseResult> => {
  const settings = await getGlobalSettings('gemini');
  const apiKey = customApiKey || 
                 settings?.key || 
                 (import.meta.env?.VITE_GEMINI_API_KEY as string) || 
                 '';

  // Se nÃ£o houver chave de API, usa o Mock sintÃ¡tico bÃ¡sico
  if (!apiKey || apiKey.trim() === '') {
    const mockData = parseProspectFromBlockTextMock(text);
    // Filtrar campos que foram preenchidos
    const filled = Object.entries(mockData)
      .filter(([_, val]) => val !== undefined && val !== '')
      .map(([key]) => key);

    return {
      success: true,
      isMock: true,
      prospect: mockData,
      aiFilledFields: filled
    };
  }

  try {
    const prompt = `
VocÃª Ã© uma InteligÃªncia Artificial especialista em estruturaÃ§Ã£o e extraÃ§Ã£o de dados B2B.
Analise o bloco de texto livre abaixo e extraia todas as informaÃ§Ãµes possÃ­veis para preencher os dados de um prospecto de vendas para uma agÃªncia de marketing de clÃ­nicas odontolÃ³gicas.

TEXTO DE ENTRADA:
"""
${text}
"""

O JSON gerado preencherÃ¡ a ficha automaticamente. Preencha todos os campos corretamente com base no texto. Use string vazia "" se nÃ£o encontrar a informaÃ§Ã£o.
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1500,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                clinicName: { type: "STRING", description: "APENAS o nome comercial da clÃ­nica. Ex: VS Odonto" },
                location: { type: "STRING", description: "APENAS a Cidade e o UF no formato 'Cidade - UF'. Ex: Ã�guas Claras - DF. Se nÃ£o houver UF, tente deduzir pelo DDD ou local ou deixe em branco se nÃ£o souber." },
                fullAddress: { type: "STRING", description: "EndereÃ§o completo da clÃ­nica com rua, nÃºmero, bairro, cidade, estado e CEP, se disponÃ­vel." },
                clinicInstagram: { type: "STRING", description: "Instagram da clÃ­nica" },
                gmn: { type: "STRING", description: "Link do Google Maps" },
                site: { type: "STRING", description: "Website oficial" },
                ownerName: { type: "STRING", description: "Nome dos donos, responsÃ¡veis ou dentistas. Ex: VALERIA MARIA" },
                ownerInstagram: { type: "STRING", description: "Instagram do dono" },
                collaborators: { type: "STRING", description: "Quantidade de funcionÃ¡rios" },
                size: { type: "STRING", description: "Tamanho da clÃ­nica" },
                age: { type: "STRING", description: "Idade da empresa" },
                gmnRating: { type: "STRING", description: "Nota do Google. Ex: 5.0" },
                gmnReviewsCount: { type: "STRING", description: "Total de avaliaÃ§Ãµes. Ex: 185" },
                observations: { type: "STRING", description: "Telefones de contato, especialidades, serviÃ§os e qualquer outra informaÃ§Ã£o restante." }
              }
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Formato de resposta da API do Gemini invÃ¡lido.');
    }

    const parsedJson = JSON.parse(generatedText);

    // Mapear campos que a IA conseguiu preencher (diferentes de vazio)
    const aiFilledFields: string[] = [];
    const prospectData: Partial<Prospect> = {};

    Object.entries(parsedJson).forEach(([key, value]) => {
      const valStr = String(value).trim();
      if (valStr !== '') {
        aiFilledFields.push(key);
        (prospectData as any)[key] = valStr;
      }
    });

    return {
      success: true,
      isMock: false,
      prospect: prospectData,
      aiFilledFields
    };
  } catch (error: any) {
    console.error('Erro ao estruturar dados do bloco de texto com Gemini:', error);
    return {
      success: false,
      isMock: false,
      prospect: {},
      aiFilledFields: [],
      error: error.message || 'Erro ao chamar a API da IA Gemini.'
    };
  }
};

/**
 * FunÃ§Ã£o de fallback local (mock) para extraÃ§Ã£o sintÃ¡tica do bloco de texto
 */
const parseProspectFromBlockTextMock = (text: string): Partial<Prospect> => {
  const lines = text.split('\n');
  const result: Partial<Prospect> = {
    clinicName: '',
    location: '',
    fullAddress: '',
    clinicInstagram: '',
    gmn: '',
    site: '',
    ownerName: '',
    ownerInstagram: '',
    collaborators: '',
    size: '',
    age: '',
    gmnRating: '',
    gmnReviewsCount: '',
    observations: ''
  };

  lines.forEach(line => {
    const cleanLine = line.trim();
    if (cleanLine.toLowerCase().startsWith('local:')) {
      result.location = cleanLine.substring(6).trim();
      result.fullAddress = cleanLine.substring(6).trim();
    } else if (cleanLine.toLowerCase().startsWith('clÃ­nica:') || cleanLine.toLowerCase().startsWith('clinica:')) {
      result.clinicName = cleanLine.substring(8).trim();
    } else if (cleanLine.toLowerCase().startsWith('instagram da clÃ­nica:') || cleanLine.toLowerCase().startsWith('instagram:')) {
      const idx = cleanLine.indexOf(':');
      result.clinicInstagram = cleanLine.substring(idx + 1).trim();
    } else if (cleanLine.toLowerCase().startsWith('google maps da clÃ­nica:') || cleanLine.toLowerCase().startsWith('google maps:') || cleanLine.toLowerCase().startsWith('maps:')) {
      const idx = cleanLine.indexOf(':');
      result.gmn = cleanLine.substring(idx + 1).trim();
    }
  });

  // Se o nome da clÃ­nica ainda estiver vazio, tentar deduzir
  if (!result.clinicName && lines.length > 0) {
    const clinicLine = lines.find(l => {
      const lower = l.toLowerCase();
      return lower.includes('odontologia') || lower.includes('dente') || lower.includes('orto') || lower.includes('clinic');
    });
    if (clinicLine) {
      result.clinicName = clinicLine.replace(/^(ClÃ­nica:|Clinica:|Nome:)/i, '').trim();
    } else {
      // Pega a primeira linha que nÃ£o esteja vazia nem contenha rÃ³tulos comuns
      const validLine = lines.find(l => {
        const lower = l.toLowerCase();
        return l.trim() !== '' && !lower.startsWith('local:') && !lower.startsWith('instagram:') && !lower.startsWith('google') && !l.includes('http');
      });
      if (validLine) {
        // Se a linha for muito grande (ex: usuÃ¡rio colou tudo sem quebras de linha), pega sÃ³ as primeiras palavras
        if (validLine.length > 50) {
          result.clinicName = validLine.substring(0, 50).split('http')[0].trim() + '...';
        } else {
          result.clinicName = validLine.trim();
        }
      }
    }
  }

  return result;
};

export const generateMarketingDiagnostic = async (
  prospect: Prospect,
  customApiKey?: string
): Promise<{ success: boolean; data?: any; error?: string; isMock?: boolean }> => {
  try {
    let apiKey = customApiKey;
    if (!apiKey) {
      const settings = await getGlobalSettings('gemini');
      apiKey = settings?.key;
    }
    if (!apiKey) {
      apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
    }

    if (!apiKey) {
      // Mock Data
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
        success: true,
        isMock: true,
        data: {
          resumo1: "Quando alguém procura Dentista na região, o Google mostra outro concorrente. Você aparece bem posicionado em poucas buscas.",
          resumo2: "Você aparece bem posicionado em 0% das buscas na sua região, ou seja, muita gente não vê o seu perfil.",
          resumo3: "O site tem falhas técnicas que impedem o Google de entender a página e medimos nota baixa, o que atrapalha quem chega.",
          planoAcao: [
            { titulo: "Perfil no Google", descricao: "Completar e padronizar o perfil do Google (categoria, telefone, endereco, site e fotos)", imp: "ALTO", esf: "BAIXO" },
            { titulo: "Avaliações", descricao: "Responder avaliacões e pedir avaliações novas dos pacientes atuais", imp: "ALTO", esf: "MÉDIO" },
            { titulo: "Site/Landing", descricao: "Criar uma landing de agendamento com botão direto para WhatsApp", imp: "ALTO", esf: "MÉDIO" },
            { titulo: "Anúncios", descricao: "Ajustar campanhas pagas para priorizar busca por Dentista e criar oferta de avaliação", imp: "ALTO", esf: "MÉDIO" },
            { titulo: "Técnico", descricao: "Corrigir problemas técnicos do site e instalar medição de visitantes", imp: "MÉDIO", esf: "ALTO" }
          ],
          concorrentes: [
            { nome: "Clínica Concorrente A", nota: "4.8", avaliacoes: 288, anunciaGoogle: true, anunciaMeta: true, respondeAvaliacoes: true, postaFrequencia: true, siteRapido: true },
            { nome: "Clínica Concorrente B", nota: "4.9", avaliacoes: 150, anunciaGoogle: true, anunciaMeta: false, respondeAvaliacoes: false, postaFrequencia: true, siteRapido: false },
            { nome: "Clínica Concorrente C", nota: "4.7", avaliacoes: 80, anunciaGoogle: false, anunciaMeta: false, respondeAvaliacoes: false, postaFrequencia: false, siteRapido: false }
          ],
          placar: { google: 21, reputacao: 80, instagram: 50, site: 42, ads: 100 },
          site: { velocidade: 83, seo: 0, pixelMeta: false, pixelGoogle: false, gtm: false, whatsapp: false, oportunidade1: "Corrigir os problemas técnicos que causam nota técnica 0 para que o site apareça melhor quando alguém procura.", oportunidade2: "Reduzir o tempo de abertura de 3.8 s para abaixo de 2 s em páginas-chave, o que aumenta quem conclui o agendamento.", oportunidade3: "Instalar um rastreador que mede quem visita e criar uma página de agendamento direto para transformar visita em marcação." },
          anuncios: { clienteAnunciaGoogle: true, clienteAnunciaMeta: true, concorrentesGoogle: 3, concorrentesMeta: 0, oportunidade1: "Ajustar campanhas para capturar quem busca agora por Dentista em Valparaiso e direcionar para agendamento online.", oportunidade2: "Criar anúncios com oferta de avaliação inicial para competir com os concorrentes que já anunciam no Google.", oportunidade3: "Usar o Meta para retargeting de quem visitou o site, já que nenhum concorrente local está anunciando no Meta." },
          gmn: { top3Percent: 0, posicaoMedia: 13, foraTop20Percent: 56, oportunidade1: "Completar e padronizar o perfil (categoria, telefone, site, fotos) para subir rápido nos resultados locais.", oportunidade2: "Publicar atualizações e ofertas no perfil toda semana para aumentar a presença nos 25 pontos analisados.", oportunidade3: "Focar para aparecer entre os 3 primeiros em pelo menos 8 dos 25 pontos, começando pelo bairro com maior volume de buscas." }
        }
      };
    }

    const prompt = `Você é um especialista em Marketing Odontológico e Local SEO.
Gere um Diagnóstico de Marketing para a clínica "${prospect.clinicName}" localizada em "${prospect.location || 'Sua região'}".
Nota do Google: ${prospect.gmnRating || 'N/A'}. Avaliações: ${prospect.gmnReviewsCount || 'N/A'}.

Preencha os dados do relatório JSON estritamente conforme o esquema, estimando os dados (como presença em anúncios, placar de performance, dados do site e mapa) com base na presença digital típica de uma clínica com os dados fornecidos. Para as ações do plano de 30 dias, gere 5 ações com impacto e esforço variados. Para os concorrentes, invente 3 clínicas realistas da região e preencha os dados típicos de concorrentes fortes e médios.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                resumo1: { type: "STRING" },
                resumo2: { type: "STRING" },
                resumo3: { type: "STRING" },
                planoAcao: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      titulo: { type: "STRING" },
                      descricao: { type: "STRING" },
                      imp: { type: "STRING", description: "ALTO, MÉDIO ou BAIXO" },
                      esf: { type: "STRING", description: "ALTO, MÉDIO ou BAIXO" }
                    }
                  }
                },
                concorrentes: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      nome: { type: "STRING" },
                      nota: { type: "STRING" },
                      avaliacoes: { type: "INTEGER" },
                      anunciaGoogle: { type: "BOOLEAN" },
                      anunciaMeta: { type: "BOOLEAN" },
                      respondeAvaliacoes: { type: "BOOLEAN" },
                      postaFrequencia: { type: "BOOLEAN" },
                      siteRapido: { type: "BOOLEAN" }
                    }
                  }
                },
                placar: {
                  type: "OBJECT",
                  properties: {
                    google: { type: "INTEGER" },
                    reputacao: { type: "INTEGER" },
                    instagram: { type: "INTEGER" },
                    site: { type: "INTEGER" },
                    ads: { type: "INTEGER" }
                  }
                },
                site: {
                  type: "OBJECT",
                  properties: {
                    velocidade: { type: "INTEGER" },
                    seo: { type: "INTEGER" },
                    pixelMeta: { type: "BOOLEAN" },
                    pixelGoogle: { type: "BOOLEAN" },
                    gtm: { type: "BOOLEAN" },
                    whatsapp: { type: "BOOLEAN" },
                    oportunidade1: { type: "STRING" },
                    oportunidade2: { type: "STRING" },
                    oportunidade3: { type: "STRING" }
                  }
                },
                anuncios: {
                  type: "OBJECT",
                  properties: {
                    clienteAnunciaGoogle: { type: "BOOLEAN" },
                    clienteAnunciaMeta: { type: "BOOLEAN" },
                    concorrentesGoogle: { type: "INTEGER" },
                    concorrentesMeta: { type: "INTEGER" },
                    oportunidade1: { type: "STRING" },
                    oportunidade2: { type: "STRING" },
                    oportunidade3: { type: "STRING" }
                  }
                },
                gmn: {
                  type: "OBJECT",
                  properties: {
                    top3Percent: { type: "INTEGER" },
                    posicaoMedia: { type: "INTEGER" },
                    foraTop20Percent: { type: "INTEGER" },
                    oportunidade1: { type: "STRING" },
                    oportunidade2: { type: "STRING" },
                    oportunidade3: { type: "STRING" }
                  }
                }
              },
              required: ["resumo1", "resumo2", "resumo3", "planoAcao", "concorrentes", "placar", "site", "anuncios", "gmn"]
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Erro HTTP: ${response.status}`);
    }

    const result = await response.json();
    const dataText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!dataText) {
      throw new Error('Sem resposta válida da IA.');
    }

    let parsedData = {};
    try {
      const cleanedText = dataText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch (e: any) {
      console.error('Falha ao parsear JSON', e, dataText);
      const cleanedText = dataText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const preview = cleanedText.length > 200 ? cleanedText.substring(0, 100) + '...' + cleanedText.substring(cleanedText.length - 100) : cleanedText;
      throw new Error(`Parse falhou: ${e.message} | FIM DO TEXTO: ${cleanedText.substring(cleanedText.length - 150)}`);
    }

    return { success: true, isMock: false, data: parsedData };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return { success: false, error: error.message };
  }
};

export const generateOportunidadesPersonalizadasIA = async (
  prospect: Prospect,
  diagnosticData: any,
  customApiKey?: string
): Promise<{ success: boolean; oportunidades?: string[]; error?: string }> => {
  try {
    let apiKey = customApiKey;
    if (!apiKey) {
      const settings = await getGlobalSettings('gemini');
      apiKey = settings?.key;
    }
    if (!apiKey) {
      apiKey = import.meta.env.VITE_GEMINI_API_KEY as string;
    }

    const clinicName = prospect?.clinicName || (diagnosticData as any)?.nomeClinica || 'Clínica Odontológica';
    const location = prospect?.location || prospect?.fullAddress || (diagnosticData as any)?.cidade || 'Região';
    const kw = (prospect as any)?.keyword || diagnosticData?.termoPesquisado || diagnosticData?.gmn?.keyword || 'Dentista';
    const rating = prospect?.gmnRating || diagnosticData?.gmn?.rating || '4.8';
    const reviews = prospect?.gmnReviewsCount ?? diagnosticData?.gmn?.reviewsCount ?? 0;
    const foraTop20 = diagnosticData?.gmn?.foraTop20Percent ?? prospect?.percentForaTop20 ?? 50;
    const clientRank = diagnosticData?.posicaoCliente ?? diagnosticData?.gmn?.posicaoMedia ?? prospect?.posicaoMedia ?? 7;
    const siteUrl = diagnosticData?.site?.url || prospect?.site || '';
    const siteVel = diagnosticData?.site?.velocidade ?? 'N/A';
    const siteSeo = diagnosticData?.site?.seo ?? 'N/A';
    const metaAdsActive = diagnosticData?.anuncios?.clienteAnunciaMeta === true;
    const googleAdsActive = diagnosticData?.anuncios?.clienteAnunciaGoogle === true;
    const concorrentes = (diagnosticData?.concorrentes || []).map((c: any) => `${c.nome} (${c.avaliacoes || 0} avaliações, nota ${c.nota || '4.5'})`).join('; ');

    const prompt = `Você é um consultor especialista em Marketing Odontológico e SEO Local.
Analise os dados reais do relatório da clínica "${clinicName}" em "${location}":
- Termo de busca analisado: "${kw}"
- Avaliações no Google: ${rating} estrelas com ${reviews} avaliações.
- Desempenho no Google Maps: Posição média #${clientRank}, ficando invisível (posição 20+) em ${foraTop20}% dos pontos analisados na região.
- Principais Concorrentes Locais: ${concorrentes || 'Concorrentes locais da região'}.
- Site / Landing Page: ${siteUrl ? `URL: ${siteUrl}, Velocidade Mobile: ${siteVel}/100, SEO Técnico: ${siteSeo}/100` : 'Sem site cadastrado'}.
- Presença em Anúncios Pagos: Google Ads: ${googleAdsActive ? 'Ativo' : 'Inativo'}, Meta Ads (Instagram/Facebook): ${metaAdsActive ? 'Ativo' : 'Inativo'}.

INSTRUÇÃO CRÍTICA DE ESTILO:
Gere uma lista em JSON com exatamente 10 frases de Oportunidades & Pontos Fracos altamente personalizados.
CADA FRASE DEVE SER CURTA, DIRETA, RESUMIDA E FÁCIL DE ENTENDER (MÁXIMO DE 10 A 18 PALAVRAS POR FRASE, EXATAMENTE 1 LINHA POR ITEM).
EVITE PARÁGRAFOS LONGOS E EXPLICAÇÕES PROLIXAS.

Exemplos do estilo desejado:
- "Presença irregular no Google Maps, com muitos pontos em posição 20+;"
- "Concorrentes diretos aparecendo à frente em regiões estratégicas;"
- "Boa nota no Google (${rating}★), mas com volume de avaliações menor que alguns concorrentes;"
- "Ausência de campanhas ativas no Google Ads para o termo "${kw}";"
- "Site com velocidade reduzida (nota ${siteVel}/100), gerando perda de visitantes;"
- "Oportunidade de fortalecer o Google Meu Negócio para melhorar o ranqueamento local;"
- "Possibilidade de aumentar a captação de pacientes que já estão pesquisando por dentistas na região."

Retorne no formato JSON estrito:
{
  "oportunidades": [
    "frase 1 curta e direta",
    "frase 2 curta e direta",
    "frase 3 curta e direta",
    "frase 4 curta e direta",
    "frase 5 curta e direta",
    "frase 6 curta e direta",
    "frase 7 curta e direta",
    "frase 8 curta e direta",
    "frase 9 curta e direta",
    "frase 10 curta e direta"
  ]
}`;

    if (!apiKey) {
      console.warn('[Gemini] Sem API key configurada, gerando oportunidades dinâmicas avançadas via fallback...');
      return { success: false, error: 'Sem API Key configurada' };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                oportunidades: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["oportunidades"]
            }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const result = await response.json();
    const dataText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!dataText) throw new Error('IA não retornou texto válido.');

    const parsed = JSON.parse(dataText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim());
    if (Array.isArray(parsed.oportunidades) && parsed.oportunidades.length >= 5) {
      return { success: true, oportunidades: parsed.oportunidades.slice(0, 10) };
    }

    throw new Error('Formato retornado inválido.');
  } catch (error: any) {
    console.error('[Gemini Oportunidades] Erro:', error);
    return { success: false, error: error?.message || 'Erro ao gerar IA' };
  }
};
