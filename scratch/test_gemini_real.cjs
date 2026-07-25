const key = "AIzaSyCAJxquwrhkYKoyNUGkMXrkG-cscv4iQi8";

async function testGeminiClinic(clinicName, location, site) {
  console.log(`\n--- TESTING GEMINI FOR: "${clinicName}" in "${location}" ---`);
  
  const prompt = `Você é um assistente de dados de empresas brasileiras.
Localize os dados públicos da clínica:
Nome: "${clinicName}"
Cidade/Localização: "${location}"
Site: "${site}"

Forneça os seguintes dados em um formato JSON VÁLIDO sem markdown:
{
  "cnpj": "número do CNPJ com 14 dígitos",
  "instagram": "link ou handle do Instagram oficial (@clinica ou https://instagram.com/...)",
  "ownerName": "nome do dono, fundador ou sócios administradores"
}

Se não souber exatamente o CNPJ de 14 dígitos, deixe "". Se não souber o Instagram, deixe "".`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await res.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('Gemini raw output:');
    console.log(txt);
  } catch (e) {
    console.error(e);
  }
}

async function runAll() {
  await testGeminiClinic("Clinica Ortoriso Asa Norte", "Asa Norte - DF", "https://www.ortoriso.com.br");
  await testGeminiClinic("Clínica Allere", "Asa Sul - DF", "http://www.clinicaallere.com.br");
  await testGeminiClinic("PróRir Brasília", "Asa Sul - DF", "");
}

runAll();
