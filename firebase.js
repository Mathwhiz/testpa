// firebase.js — inicialización compartida
// Importar en cada módulo con:
//   import { db } from '../firebase.js';

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBirDdLyr-a6kjkcMxvRDuCJ3SW0WTDsPk",
  authDomain:        "appjw-3697e.firebaseapp.com",
  projectId:         "appjw-3697e",
  storageBucket:     "appjw-3697e.firebasestorage.app",
  messagingSenderId: "161788232097",
  appId:             "1:161788232097:web:c17614effa82dceef90be0",
};

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);