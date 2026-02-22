import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Replace the placeholder values below with the ones from your Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCT9yJT_KOivQGbfIKpmNSxXqJMVB9PY-g",
  authDomain: "chores-88a3f.firebaseapp.com",
  projectId: "chores-88a3f",
  storageBucket: "chores-88a3f.firebasestorage.app",
  messagingSenderId: "307911093238",
  appId: "1:307911093238:web:00d961a6b206e62c1e35d7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
