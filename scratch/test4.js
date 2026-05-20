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

Retorne OBRIGATORIAMENTE o resultado dentro de um bloco de código markdown \`\`\`json.
O JSON deve ter exatamente esta estrutura e chaves:
{
  "clinicName": "Nome da clínica",
  "location": "Local",
  "clinicInstagram": "Link ou username do Instagram",
  "gmn": "Link do Google Maps",
  "site": "Site oficial",
  "ownerName": "Nome do dono",
  "ownerInstagram": "Instagram do dono",
  "collaborators": "Quantidade de funcionários",
  "size": "Tamanho/Estrutura",
  "age": "Idade da empresa",
  "gmnRating": "Nota de avaliação",
  "gmnReviewsCount": "Número de avaliações",
  "observations": "Qualquer outra informação"
}

IMPORTANTE: Se alguma informação não estiver explícita no texto, você DEVE usar sua base de conhecimento e pesquisar na internet (se possível) usando o nome da clínica, localização ou links fornecidos para encontrar os dados que faltam. Preencha o MÁXIMO de campos possíveis (como nota do GMN, número de avaliações, site, idade). Apenas retorne a string vazia "" se for absolutamente impossível encontrar ou deduzir a informação.
Lembre-se de certificar que o JSON é válido e que as chaves e aspas estão fechadas.
`;

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2000
    }
  })
}).then(r => r.json()).then(d => {
  if (d.error) {
    console.error(d.error);
  } else {
    console.log(d.candidates[0].content.parts[0].text);
  }
}).catch(console.error);
