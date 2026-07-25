const siteUrl = "https://www.redeodonto.com.br/associadas-unidade-df-gama-dentista-em-gama-setor-central-df";

async function testSiteScrape() {
  console.log('Testing site HTML fetch for Instagram and CNPJ...');
  try {
    const res = await fetch(siteUrl);
    if (res.ok) {
      const html = await res.text();
      console.log('Site length:', html.length);
      
      // CNPJ Regex
      const cnpjs = html.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g);
      console.log('CNPJs found on site:', cnpjs);

      // Instagram Regex
      const instas = html.match(/instagram\.com\/([a-zA-Z0-9_\-\.]+)/gi);
      console.log('Instas found on site:', instas);
    }
  } catch (e) {
    console.error('Error fetching site:', e);
  }
}

testSiteScrape();
