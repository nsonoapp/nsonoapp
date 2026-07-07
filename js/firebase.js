// firebase.js offline 
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,

  collection,
  addDoc,
  getDocs,
  setDoc,
  updateDoc,
  orderBy,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
  increment,
  arrayUnion,
  limit,
  onSnapshot

} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuNj63Ja3qlsHLRrNtC93O1ZAgN341_rM",
  authDomain: "nsono-app-db.firebaseapp.com",
  projectId: "nsono-app-db",
  storageBucket: "nsono-app-db.firebasestorage.app",
  messagingSenderId: "539756984875",
  appId: "1:539756984875:web:22ffa963701c49e0eac86e",
  measurementId: "G-9LKX3PVBWP"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const enableIndexedDbPersistence = async () => true;

async function writeLog(entry = {}) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  try {
    const docRef = await addDoc(collection(db, "logs"), {
      createdAt: Timestamp.now(),
      ...entry
    });
    return docRef.id;
  } catch (err) {
    console.warn("writeLog:", err);
    return null;
  }
}

export {
  app,
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
  limit,
  orderBy,
  onSnapshot,
  writeBatch,
  increment,
  arrayUnion,
  enableIndexedDbPersistence,
  writeLog
};
