const siteUrl = "https://www.ortoriso.com.br";

async function testProxies() {
  console.log('Testing Proxy A: corsproxy.io');
  try {
    const r1 = await fetch(`https://corsproxy.io/?${encodeURIComponent(siteUrl)}`);
    if (r1.ok) {
      const html1 = await r1.text();
      console.log('Proxy A success! HTML length:', html1.length);
      console.log('CNPJs:', html1.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g));
    } else {
      console.log('Proxy A status:', r1.status);
    }
  } catch (e) {
    console.error('Proxy A error:', e.message);
  }

  console.log('\nTesting Proxy B: codetabs');
  try {
    const r2 = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(siteUrl)}`);
    if (r2.ok) {
      const html2 = await r2.text();
      console.log('Proxy B success! HTML length:', html2.length);
      console.log('CNPJs:', html2.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g));
    } else {
      console.log('Proxy B status:', r2.status);
    }
  } catch (e) {
    console.error('Proxy B error:', e.message);
  }
}

testProxies();
