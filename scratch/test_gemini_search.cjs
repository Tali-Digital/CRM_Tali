const key = "AIzaSyCAJxquwrhkYKoyNUGkMXrkG-cscv4iQi8";

async function testEnrichment() {
  const prompt = `Busque dados da clínica odontológica "Clínica Allere" em "Asa Sul - DF" (site: http://www.clinicaallere.com.br/).
Retorne APENAS um objeto JSON com:
{
  "cnpj": "numero do CNPJ da empresa",
  "instagram": "link do instagram da clinica",
  "ownerName": "nome dos socios"
}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

testEnrichment();
