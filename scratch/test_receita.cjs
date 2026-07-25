async function testReceitaAPIs() {
  const cnpjsToTest = ['24561805055853', '24561805000190', '49963816000100'];

  for (const cnpj of cnpjsToTest) {
    console.log('\n--- TESTING CNPJ:', cnpj);
    try {
      const res1 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (res1.ok) {
        const d = await res1.json();
        console.log('✅ BrasilAPI:', d.razao_social, '| Fantasia:', d.nome_fantasia, '| QSA:', d.qsa?.map(s => s.nome_socio || s.nome_socio_administrador));
        continue;
      } else {
        console.log('BrasilAPI status:', res1.status);
      }
    } catch (e) {
      console.log('BrasilAPI error:', e.message);
    }

    try {
      const res2 = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
      if (res2.ok) {
        const d = await res2.json();
        console.log('✅ CNPJ.ws:', d.razao_social, '| QSA:', d.estabelecimento?.socios?.map(s => s.nome));
      } else {
        console.log('CNPJ.ws status:', res2.status);
      }
    } catch (e) {
      console.log('CNPJ.ws error:', e.message);
    }
  }
}

testReceitaAPIs();
