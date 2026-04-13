import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// DIQQAT: Quyidagi sozlamalarni Firebase Console (console.firebase.google.com) orqali olishingiz kerak
const firebaseConfig = {
  apiKey: "AIzaSyBUMCdY6YWnwMRKLvdU4xgOl5rpuNE9Anc",
  authDomain: "websaytishchi.firebaseapp.com",
  projectId: "websaytishchi",
  storageBucket: "websaytishchi.firebasestorage.app",
  messagingSenderId: "390023498423",
  appId: "1:390023498423:web:3728f2ef26bb287dde9b32",
  measurementId: "G-ZFYDWZNYS"
};

// initialize
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
