const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const firebaseConfig = require('../firebase-applet-config.json');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testFalcon() {
  const snap = await getDoc(doc(db, 'settings', 'gemini'));
  const key = snap.data()?.localFalconKey || '';
  console.log('Saved LocalFalconKey in Firestore:', key ? key.substring(0, 8) + '...' : 'NOT SAVED YET!');

  if (!key) return;

  // Test User Info / Account Endpoint
  console.log('\n--- Testing Local Falcon Account API ---');
  try {
    const res = await fetch(`https://api.localfalcon.com/v1/user/account?api_key=${key}`);
    console.log('Account endpoint status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Account data:', data);
    } else {
      const txt = await res.text();
      console.log('Error text:', txt);
    }
  } catch (e) {
    console.error(e.message);
  }
}

testFalcon();
