const fs = require('fs');
const file = 'src/services/geminiService.ts';
let code = fs.readFileSync(file, 'utf8');
const index = code.indexOf('export const generateMarketingDiagnostic =');
if (index > -1) {
  const newFunc = `export const generateMarketingDiagnostic = async (
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

    const prompt = \`Você é um especialista em Marketing Odontológico e Local SEO.
Gere um Diagnóstico de Marketing para a clínica "\${prospect.clinicName}" localizada em "\${prospect.location || 'Sua região'}".
Nota do Google: \${prospect.gmnRating || 'N/A'}. Avaliações: \${prospect.gmnReviewsCount || 'N/A'}.

Preencha os dados do relatório JSON estritamente conforme o esquema, estimando os dados (como presença em anúncios, placar de performance, dados do site e mapa) com base na presença digital típica de uma clínica com os dados fornecidos. Para as ações do plano de 30 dias, gere 5 ações com impacto e esforço variados. Para os concorrentes, invente 3 clínicas realistas da região e preencha os dados típicos de concorrentes fortes e médios.\`;

    const response = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`,
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
            maxOutputTokens: 2500,
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
      throw new Error(errorData?.error?.message || \`Erro HTTP: \${response.status}\`);
    }

    const result = await response.json();
    const dataText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!dataText) {
      throw new Error('Sem resposta válida da IA.');
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(dataText);
    } catch (e) {
      console.error('Falha ao parsear JSON', e);
      throw new Error('Falha ao parsear os dados da IA.');
    }

    return { success: true, isMock: false, data: parsedData };
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return { success: false, error: error.message };
  }
};
`;
  code = code.substring(0, index) + newFunc;
  fs.writeFileSync(file, code);
  console.log('geminiService.ts updated successfully!');
} else {
  console.log('Function not found!');
}
