const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("No API key");
  process.exit(1);
}

const prompt = `Você é uma Inteligência Artificial especialista em estruturação e extração de dados B2B...`; // omitting full prompt for brevity, just test the tool

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: "Hello" }] }],
    tools: [{ googleSearch: {} }],
  })
}).then(r => r.json()).then(console.log).catch(console.error);
