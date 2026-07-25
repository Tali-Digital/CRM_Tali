const key = "test"; // We will test URL structure and parameters

async function testEndpoints() {
  console.log('Testing Outscraper Search Endpoint formats...');
  
  // Test Outscraper Maps Search with query
  const q1 = `CNPJ Clinica Ortoriso Asa Norte DF`;
  const u1 = `https://api.app.outscraper.com/google-search-v2?query=${encodeURIComponent(q1)}&limit=1&async=false`;
  console.log('URL 1:', u1);

  // Test DuckDuckGo JSON API
  console.log('\nTesting DuckDuckGo search...');
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent('CNPJ Ortoriso Asa Norte')}&format=json&no_redirect=1&no_html=0`);
    if (res.ok) {
      const data = await res.json();
      console.log('DuckDuckGo JSON keys:', Object.keys(data));
      console.log('DuckDuckGo Abstract:', data.AbstractText || data.Heading);
      console.log('DuckDuckGo Related:', data.RelatedTopics?.slice(0, 3));
    }
  } catch (e) {
    console.error(e);
  }
}

testEndpoints();
