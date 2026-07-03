import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// COLOQUE SUAS CHAVES DO FIREBASE AQUI
const firebaseConfig = {
  apiKey: "AIzaSyBrEAV5bl78Tdn8S4hB69-wWXWkPrdTsCE",
  authDomain: "ruth-imoveis.firebaseapp.com",
  projectId: "ruth-imoveis",
  storageBucket: "ruth-imoveis.firebasestorage.app",
  messagingSenderId: "450534917206",
  appId: "1:450534917206:web:45f4fa85973a7bf2e9a7f7",
  measurementId: "G-3888YLQ2VR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
