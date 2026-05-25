import { Prospect } from '../types';

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
 * Função para gerar um relatório inteligente de IA para o prospecto
 */
export const generateProspectReport = async (
  prospect: Prospect,
  customApiKey?: string
): Promise<GeminiAnalysisResult> => {
  // 1. Resolver a API Key (prioridade: chave manual -> .env)
  const apiKey = customApiKey || 
                 localStorage.getItem('gemini_api_key') || 
                 (import.meta.env?.VITE_GEMINI_API_KEY as string) || 
                 '';

  // Se não houver chave de API configurada, usamos o Mock Inteligente
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: true,
      isMock: true,
      content: generateMockReport(prospect)
    };
  }

  try {
    const prompt = `
Você é uma Inteligência Artificial especialista em vendas B2B e marketing digital de alta performance focada exclusivamente no nicho de clínicas odontológicas.
Analise os dados abaixo do seguinte prospecto (potencial cliente) de uma agência de marketing:

DADOS DO PROSPECTO:
- Nome da Clínica: ${prospect.clinicName}
- Cidade/Localização: ${prospect.location}
- Instagram da Clínica: ${prospect.clinicInstagram || 'Não informado'}
- Site da Clínica: ${prospect.site || 'Não informado'}
- Nome do Proprietário/Dono: ${prospect.ownerName || 'Não informado'}
- Instagram do Dono: ${prospect.ownerInstagram || 'Não informado'}
- Tamanho/Estrutura: ${prospect.size || 'Não informado'}
- Idade da Empresa: ${prospect.age || 'Não informado'}
- Nota no Google Meu Negócio: ${prospect.gmnRating || 'Não informada'}
- Quantidade de Avaliações: ${prospect.gmnReviewsCount || 'Não informada'}
- Observações comerciais existentes: ${prospect.observations || 'Nenhuma'}

INSTRUÇÕES DE RESPOSTA:
Gere um relatório estruturado em Markdown com as seguintes seções. O tom deve ser altamente profissional, estratégico, objetivo e pronto para ação comercial.
A resposta deve ser 100% em Português.

### 🌟 Visão Geral da Clínica
- Faça um resumo de quem eles são, baseado no nome, idade e localização.
- Estime o posicionamento de mercado (premium, popular, médio) com base nos dados.

### 🔍 Diagnóstico de Presença Digital & GMN
- Analise a nota (${prospect.gmnRating || 'N/D'}) e número de avaliações (${prospect.gmnReviewsCount || 'N/D'}) no Google Meu Negócio. Indique se é excelente, precisa de melhorias urgentes ou se há risco de reputação.
- Analise a presença com base em ter ou não site e Instagram da clínica.
- Sugira 2 a 3 pontos rápidos de otimização para a presença digital deles (SEO local, otimização de perfil, conversão de tráfego).

### 💡 Oportunidades & Pontos de Dor
- Identifique possíveis dores (ex: falta de novos pacientes recorrentes, concorrência na região, reputação digital baixa, site desatualizado).
- Mostre onde o CRM ou os serviços da agência podem gerar o maior impacto financeiro.

### 🎯 Roteiro de Abordagem Comercial Recomendado
- Crie um roteiro rápido (1 a 2 parágrafos) ou uma mensagem inicial personalizada de quebra-gelo adaptada a este prospecto específico, usando o nome do dono (${prospect.ownerName || 'Dr./Dra.'}) e citando pontos reais da clínica.
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
      throw new Error('Formato de resposta da API do Gemini inválido.');
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
 * Gera um relatório simulado elegante e estruturado
 */
const generateMockReport = (prospect: Prospect): string => {
  const ownerLabel = prospect.ownerName && prospect.ownerName !== 'Não encontrado'
    ? prospect.ownerName.split(',')[0].trim() 
    : 'Doutor(a)';
  
  const formattedRating = prospect.gmnRating ? `${prospect.gmnRating} ⭐` : 'Não informada';
  const reviewsCount = prospect.gmnReviewsCount ? `${prospect.gmnReviewsCount} avaliações` : 'Sem avaliações';

  return `### 🌟 Visão Geral da Clínica
- **Clínica:** ${prospect.clinicName}
- **Localização:** ${prospect.location || 'Não informada'}
- **Idade da Empresa:** ${prospect.age || 'Não informada'}
- **Perfil Geral:** Clínica odontológica estabelecida na região de ${prospect.location || 'seu mercado local'}. Pelo histórico de ${prospect.age || 'funcionamento'}, aparenta ter uma base de clientes recorrentes física, mas com alto potencial de expansão através de canais digitais.

### 🔍 Diagnóstico de Presença Digital & GMN
- **Google Meu Negócio:** Nota **${formattedRating}** com **${reviewsCount}**. 
  ${prospect.gmnRating && parseFloat(prospect.gmnRating) < 4.5 
    ? '⚠️ *Alerta:* A nota média está abaixo do ideal (4.5). Há necessidade imediata de campanhas de feedback positivo e tratativa de avaliações negativas para recuperar a credibilidade local.' 
    : '✅ *Status:* A reputação online está consolidada, excelente gancho para campanhas de atração baseadas em prova social.'}
- **Website:** ${prospect.site && prospect.site !== 'Não encontrado' ? 'Disponível. Excelente oportunidade para otimizar SEO e campanhas de tráfego pago direcionadas (Google Ads).' : '❌ *Alerta:* Sem site profissional ativo. Isso causa perda de autoridade e impede estratégias de captação por busca ativa no Google.'}
- **Instagram:** ${prospect.clinicInstagram && prospect.clinicInstagram !== 'Não encontrado' ? 'Ativo. É recomendável analisar a frequência de postagens e o nível de engajamento real.' : '❌ Sem perfil no Instagram ativo ou não mapeado.'}

### 💡 Oportunidades & Pontos de Dor
1. **Atração de Pacientes High-Ticket:** Implementar funis de venda focados em procedimentos de maior valor (Implantes, Invisalign, Lentes), aproveitando a força da marca física na região de ${prospect.location || 'atuação'}.
2. **SEO Local:** Com o ajuste e otimização das palavras-chave do perfil no Google Meu Negócio, a clínica pode subir nas posições de busca orgânica local sem custos extras de mídia.
3. **Automação de Agendamentos:** Otimizar o tempo da recepção e diminuir o no-show integrando ferramentas automáticas de confirmação.

### 🎯 Roteiro de Abordagem Comercial Recomendado
*Abordagem consultiva e focada em valor, sem forçar venda:*

"Olá, **${ownerLabel}**, tudo bem? Acompanho o excelente trabalho da **${prospect.clinicName}** em ${prospect.location || 'sua região'}. Notei que vocês têm ótimas avaliações dos pacientes no Google! 

Fizemos um rápido estudo da presença digital de vocês na região e identificamos 3 pontos específicos onde vocês estão perdendo espaço para concorrentes na busca por tratamentos de alto valor. Criamos um mini relatório com essas sugestões. 

Faria sentido conversarmos 5 minutos esta semana para eu te apresentar esse diagnóstico sem compromisso?"

---
*Nota: Este relatório foi gerado em Modo de Demonstração (Mock). Para habilitar respostas completas em tempo real da IA, insira sua chave da API do Gemini nas configurações.*`;
};

/**
 * Função para gerar uma mensagem de abordagem personalizada para o Instagram usando a IA do Gemini
 */
export const generateInstagramMessage = async (
  prospect: Prospect,
  customApiKey?: string
): Promise<GeminiAnalysisResult> => {
  const apiKey = customApiKey || 
                 localStorage.getItem('gemini_api_key') || 
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
Você é uma Inteligência Artificial agindo como um agente de prospecção e vendas B2B de alta performance da agência Talí Digital, focado exclusivamente no nicho de clínicas odontológicas.
Sua tarefa é escrever uma mensagem direta de abordagem personalizada para enviar via direct do Instagram para o dono ou responsável pela clínica odontológica descrita nos dados abaixo.
A mensagem DEVE ter até no máximo 999 caracteres e ser baseada no roteiro modelo abaixo:

MODELO DE REFERÊNCIA:
"Oi, [Nome do(a) Doutor(a)], tudo bem?
Me chamo Helenilton Alves, sou um dos fundadores da Talí Digital. Vi o perfil da [Nome da Clínica] no Google, entrei aqui no Instagram e achei incrível o trabalho de vocês aí no [Localização/Edifício/Bairro/Cidade]. Manter uma nota de [Nota] com [X] avaliações é um baita indicativo de excelência, e foi justamente por notar esse padrão de qualidade que fiz questão de entrar em contato.

Nós somos especialistas no ramo odontológico e, com o nosso método — o Método TALÍ —, nós ajudamos clínicas com o seu perfil a organizarem o posicionamento digital e o atendimento para destravar um faturamento maior.

Olhando a presença digital de vocês hoje, notei alguns pontos cegos que podem estar fazendo a clínica perder pacientes premium para a concorrência na região.

Se tiver 15 minutinhos nesta semana, eu queria te mostrar um diagnóstico rápido desses pontos onde pode ter dinheiro ficando na mesa.

Você tem interesse em dar uma olhada nessa análise? Que dia fica bom para conversarmos?"

DADOS DO PROSPECTO:
- Nome da Clínica: ${prospect.clinicName}
- Cidade/Localização: ${prospect.location || 'Não informada'}
- Nome do Dono (Doutor/Doutora): ${prospect.ownerName || 'Doutor(a)'}
- Nota no Google Meu Negócio: ${prospect.gmnRating || 'Não informada'}
- Quantidade de Avaliações Google: ${prospect.gmnReviewsCount || 'Não informada'}
- Observações adicionais: ${prospect.observations || ''}

REGRAS CRÍTICAS DE GERAÇÃO:
1. A mensagem gerada deve ser contínua, fluida e pronta para envio, contendo NO MÁXIMO 999 caracteres (limite absoluto).
2. Substitua os placeholders ([Nome do(a) Doutor(a)], [Nome da Clínica], [Localização...], [Nota], [X]) com os dados reais do prospecto. Se algum dado estiver faltando (ex: nome do dono), adapte de forma educada para "Doutor(a)" ou use o nome da clínica, mas sem deixar placeholders visíveis.
3. Personalize a mensagem de forma inteligente usando os dados reais fornecidos para mostrar que você realmente analisou a clínica deles.
4. Foque estritamente em clínicas odontológicas.
5. Não adicione observações, explicações, saudações de IA ou formatação em markdown (negritos com asteriscos, etc.). Retorne APENAS o texto puro da mensagem gerada, exatamente no formato para copiar e colar no Instagram direct.
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
      throw new Error('Formato de resposta da API do Gemini inválido.');
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
  const ownerLabel = prospect.ownerName && prospect.ownerName !== 'Não encontrado' && prospect.ownerName !== 'Não informado'
    ? prospect.ownerName.split(',')[0].trim() 
    : 'Doutor(a)';
  
  const ratingText = prospect.gmnRating ? prospect.gmnRating : '5.0';
  const reviewsText = prospect.gmnReviewsCount ? prospect.gmnReviewsCount : 'dezenas de';
  const locationText = prospect.location ? prospect.location : 'sua região';

  return `Oi, ${ownerLabel}, tudo bem?

Me chamo Helenilton Alves, sou um dos fundadores da Talí Digital. Vi o perfil da ${prospect.clinicName} no Google, entrei aqui no Instagram e achei incrível o trabalho de vocês aí no ${locationText}. Manter uma nota de ${ratingText} com ${reviewsText} avaliações é um baita indicativo de excelência, e foi justamente por notar esse padrão de qualidade que fiz questão de entrar em contato.

Nós somos especialistas no ramo odontológico e, com o nosso método — o Método TALÍ —, nós ajudamos clínicas com o seu perfil a organizarem o posicionamento digital e o atendimento para destravar um faturamento maior.

Olhando a presença digital de vocês hoje, notei alguns pontos cegos que podem estar fazendo a clínica perder pacientes premium para a concorrência na região.

Se tiver 15 minutinhos nesta semana, eu queria te mostrar um diagnóstico rápido desses pontos onde pode ter dinheiro ficando na mesa.

Você tem interesse em dar uma olhada nessa análise? Que dia fica bom para conversarmos?`;
};

/**
 * Interface para representar o resultado da estruturação de prospecto com IA
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
  const apiKey = customApiKey || 
                 localStorage.getItem('gemini_api_key') || 
                 (import.meta.env?.VITE_GEMINI_API_KEY as string) || 
                 '';

  // Se não houver chave de API, usa o Mock sintático básico
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
Você é uma Inteligência Artificial especialista em estruturação e extração de dados B2B.
Analise o bloco de texto livre abaixo e extraia todas as informações possíveis para preencher os dados de um prospecto de vendas para uma agência de marketing de clínicas odontológicas.

TEXTO DE ENTRADA:
"""
${text}
"""

O JSON gerado preencherá a ficha automaticamente. Preencha todos os campos corretamente com base no texto. Use string vazia "" se não encontrar a informação.
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
                clinicName: { type: "STRING", description: "APENAS o nome comercial da clínica. Ex: VS Odonto" },
                location: { type: "STRING", description: "Endereço completo, cidade, estado e CEP" },
                clinicInstagram: { type: "STRING", description: "Instagram da clínica" },
                gmn: { type: "STRING", description: "Link do Google Maps" },
                site: { type: "STRING", description: "Website oficial" },
                ownerName: { type: "STRING", description: "Nome dos donos, responsáveis ou dentistas. Ex: VALERIA MARIA" },
                ownerInstagram: { type: "STRING", description: "Instagram do dono" },
                collaborators: { type: "STRING", description: "Quantidade de funcionários" },
                size: { type: "STRING", description: "Tamanho da clínica" },
                age: { type: "STRING", description: "Idade da empresa" },
                gmnRating: { type: "STRING", description: "Nota do Google. Ex: 5.0" },
                gmnReviewsCount: { type: "STRING", description: "Total de avaliações. Ex: 185" },
                observations: { type: "STRING", description: "Telefones de contato, especialidades, serviços e qualquer outra informação restante." }
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
      throw new Error('Formato de resposta da API do Gemini inválido.');
    }

    const parsedJson = JSON.parse(generatedText);

    // Mapear campos que a IA conseguiu preencher (diferentes de vazio)
    const aiFilledFields: string[] = [];
    const prospectData: Partial<Prospect> = {};

    Object.entries(parsedJson).forEach(([key, value]) => {
      const valStr = String(value).trim();
      if (valStr !== '') {
        aiFilledFields.push(key);
        prospectData[key as keyof Prospect] = valStr as any;
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
 * Função de fallback local (mock) para extração sintática do bloco de texto
 */
const parseProspectFromBlockTextMock = (text: string): Partial<Prospect> => {
  const lines = text.split('\n');
  const result: Partial<Prospect> = {
    clinicName: '',
    location: '',
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
    } else if (cleanLine.toLowerCase().startsWith('clínica:') || cleanLine.toLowerCase().startsWith('clinica:')) {
      result.clinicName = cleanLine.substring(8).trim();
    } else if (cleanLine.toLowerCase().startsWith('instagram da clínica:') || cleanLine.toLowerCase().startsWith('instagram:')) {
      const idx = cleanLine.indexOf(':');
      result.clinicInstagram = cleanLine.substring(idx + 1).trim();
    } else if (cleanLine.toLowerCase().startsWith('google maps da clínica:') || cleanLine.toLowerCase().startsWith('google maps:') || cleanLine.toLowerCase().startsWith('maps:')) {
      const idx = cleanLine.indexOf(':');
      result.gmn = cleanLine.substring(idx + 1).trim();
    }
  });

  // Se o nome da clínica ainda estiver vazio, tentar deduzir
  if (!result.clinicName && lines.length > 0) {
    const clinicLine = lines.find(l => {
      const lower = l.toLowerCase();
      return lower.includes('odontologia') || lower.includes('dente') || lower.includes('orto') || lower.includes('clinic');
    });
    if (clinicLine) {
      result.clinicName = clinicLine.replace(/^(Clínica:|Clinica:|Nome:)/i, '').trim();
    } else {
      // Pega a primeira linha que não esteja vazia nem contenha rótulos comuns
      const validLine = lines.find(l => {
        const lower = l.toLowerCase();
        return l.trim() !== '' && !lower.startsWith('local:') && !lower.startsWith('instagram:') && !lower.startsWith('google') && !l.includes('http');
      });
      if (validLine) {
        // Se a linha for muito grande (ex: usuário colou tudo sem quebras de linha), pega só as primeiras palavras
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
