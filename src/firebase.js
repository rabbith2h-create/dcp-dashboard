import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA1cgTPvjSnWsO_OmIYdc6SRa-gXYumRuA",
  authDomain: "dcp2026-d3fc3.firebaseapp.com",
  databaseURL: "https://dcp2026-d3fc3-default-rtdb.firebaseio.com",
  projectId: "dcp2026-d3fc3",
  storageBucket: "dcp2026-d3fc3.firebasestorage.app",
  messagingSenderId: "378120938555",
  appId: "1:378120938555:web:47f6cef43ca691f31c281e"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
