const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("No API key");
  process.exit(1);
}

const text = `Águas Claras - DF
Onne Odontologia
https://www.instagram.com/onneodontologia/ https://maps.google.com/?cid=9231454741253015599
https://onneodontologia.net/ HELEN DE MELO SANTOS OSTERNE`;

const prompt = `
Você é uma Inteligência Artificial especialista em estruturação e extração de dados B2B.
Analise o bloco de texto livre abaixo e extraia todas as informações possíveis para preencher os dados de um prospecto de vendas para uma agência de marketing de clínicas odontológicas.

TEXTO DE ENTRADA:
"""
${text}
"""

Retorne estritamente um objeto JSON no formato abaixo, sem qualquer formatação de código markdown (como \`\`\`json), sem textos explicativos adicionais, apenas o JSON bruto válido.
O JSON deve ter exatamente esta estrutura e chaves:
{
  "clinicName": "Nome da clínica (ex: Atually Odontologia Especializada)",
  "location": "Local/Cidade e Estado (ex: Águas Claras - DF)",
  "clinicInstagram": "Link ou username do Instagram da clínica (ex: https://www.instagram.com/atually.odontologia/)",
  "gmn": "Link do Google Maps se fornecido",
  "site": "Site oficial da clínica (caso informado ou contido nos links)",
  "ownerName": "Nome do proprietário/dono (caso possa ser inferido ou esteja explícito)",
  "ownerInstagram": "Instagram do proprietário (caso esteja explícito)",
  "collaborators": "Quantidade de funcionários (se explícito)",
  "size": "Tamanho/Estrutura estimado (se explícito)",
  "age": "Idade da empresa (se explícito)",
  "gmnRating": "Nota de avaliação (se explícito, ex: '4.8')",
  "gmnReviewsCount": "Número de avaliações (se explícito, ex: '150')",
  "observations": "Qualquer outra informação relevante extraída do texto"
}

IMPORTANTE: Se alguma informação não estiver explícita no texto, você DEVE usar sua base de conhecimento e pesquisar na internet (se possível) usando o nome da clínica, localização ou links fornecidos para encontrar os dados que faltam. Preencha o MÁXIMO de campos possíveis (como nota do GMN, número de avaliações, site, idade). Apenas retorne a string vazia "" se for absolutamente impossível encontrar ou deduzir a informação.
`;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1000
    }
  })
}).then(r => r.json()).then(d => {
  if (d.error) {
    console.error(d.error);
  } else {
    console.log(d.candidates[0].content.parts[0].text);
  }
}).catch(console.error);
