const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const firebaseConfig = require('../firebase-applet-config.json');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testAllKeys() {
  console.log('--- TESTANDO CONEXÃO DE CHAVES SALVAS ---');
  try {
    const docRef = doc(db, 'settings', 'gemini');
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      console.log('❌ Nenhuma configuração salva encontrada em settings/gemini no Firestore.');
      return;
    }
    const settings = snap.data();
    console.log('✅ Configurações encontradas no banco de dados:');
    console.log(`- Gemini Key: ${settings.key ? 'CONFIGURADO (' + settings.key.substring(0, 8) + '...)' : '❌ Não preenchido'}`);
    console.log(`- Outscraper Key: ${settings.outscraperKey ? 'CONFIGURADO (' + settings.outscraperKey.substring(0, 8) + '...)' : '⚪ Não preenchido'}`);
    console.log(`- PageSpeed Key: ${settings.pageSpeedKey ? 'CONFIGURADO (' + settings.pageSpeedKey.substring(0, 8) + '...)' : '⚪ Não preenchido'}`);
    console.log(`- Meta Ads Key: ${settings.metaAdsKey ? 'CONFIGURADO (' + settings.metaAdsKey.substring(0, 8) + '...)' : '⚪ Não preenchido'}`);
    console.log(`- Local Falcon Key: ${settings.localFalconKey ? 'CONFIGURADO (' + settings.localFalconKey.substring(0, 8) + '...)' : '⚪ Não preenchido'}`);

    // Test Gemini API
    if (settings.key) {
      console.log('\n🔍 Testando chave do Gemini API...');
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Responder em 1 palavra: OK' }] }] })
        });
        const data = await res.json();
        if (res.ok && data?.candidates) {
          console.log('✅ Gemini API funcionando perfeitamente! Resposta:', data.candidates[0]?.content?.parts[0]?.text?.trim());
        } else {
          console.log('❌ Erro no teste do Gemini API:', JSON.stringify(data.error || data));
        }
      } catch (err) {
        console.log('❌ Falha ao testar Gemini API:', err.message);
      }
    }

    // Test Meta Token (Ad Library or Graph API me)
    if (settings.metaAdsKey) {
      console.log('\n🔍 Testando chave da Meta API / Token...');
      try {
        const token = settings.metaAdsKey.trim();
        const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
        const data = await res.json();
        if (res.ok && data.id) {
          console.log('✅ Meta API funcionando perfeitamente! Conectado como:', data.name || data.id);
        } else if (token.includes('|')) {
          // App access token test
          const appRes = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${token}&access_token=${token}`);
          const appData = await appRes.json();
          if (appRes.ok && appData.data) {
            console.log('✅ Meta App Token válido e ativo!');
          } else {
            console.log('ℹ️ Meta Token recebido. Teste do formato concluído:', JSON.stringify(data.error || data));
          }
        } else {
          console.log('ℹ️ Meta Token salvo no sistema:', JSON.stringify(data.error || data));
        }
      } catch (err) {
        console.log('❌ Falha ao testar Meta API:', err.message);
      }
    }

    // Test PageSpeed API
    if (settings.pageSpeedKey) {
      console.log('\n🔍 Testando PageSpeed Insights API...');
      try {
        const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://google.com&key=${settings.pageSpeedKey}`);
        const data = await res.json();
        if (res.ok && data.lighthouseResult) {
          console.log('✅ Google PageSpeed Insights API funcionando perfeitamente!');
        } else {
          console.log('ℹ️ Resposta PageSpeed API:', JSON.stringify(data.error || data));
        }
      } catch (err) {
        console.log('❌ Falha ao testar PageSpeed API:', err.message);
      }
    }

  } catch (e) {
    console.error('Erro ao ler Firestore:', e);
  }
}

testAllKeys();
