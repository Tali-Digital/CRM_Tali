const clinicName = "Clinica Ortoriso Asa Norte";
const location = "Asa Norte - DF";
const siteUrl = "https://www.ortoriso.com.br";

async function testOrtoriso() {
  console.log('--- 1. Testing Site Fetch:', siteUrl);
  try {
    const res = await fetch(siteUrl);
    if (res.ok) {
      const html = await res.text();
      console.log('HTML size:', html.length);
      const cnpjs = html.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g);
      console.log('CNPJs on site:', cnpjs);
      const instas = html.match(/instagram\.com\/([a-zA-Z0-9_\-\.]+)/gi);
      console.log('Instagrams on site:', instas);
    } else {
      console.log('Site status:', res.status);
    }
  } catch (e) {
    console.error('Site error:', e.message);
  }

  // Test DuckDuckGo API / Public Search
  console.log('\n--- 2. Testing DuckDuckGo / Public Search ---');
  try {
    const q = `CNPJ "Ortoriso" "Asa Norte"`;
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('DuckDuckGo status:', res.status);
    if (res.ok) {
      const html = await res.text();
      const cnpjs = html.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g);
      console.log('CNPJs in search:', cnpjs);
      const instas = html.match(/instagram\.com\/([a-zA-Z0-9_\-\.]+)/gi);
      console.log('Instagrams in search:', instas);
    }
  } catch (e) {
    console.error(e);
  }
}

testOrtoriso();
