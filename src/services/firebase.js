// Firebase Firestore Integration Service for Endodiagnose
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const CONFIG_STORAGE_KEY = 'endodiagnose_firebase_config';

export function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  // Fallback to Vite environment variables if defined
  if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    };
  }
  return null;
}

export function saveStoredFirebaseConfig(config) {
  if (!config) {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  } else {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

let firebaseApp = null;
let firestoreDb = null;

export function initFirebase(config = getStoredFirebaseConfig()) {
  if (!config || !config.apiKey || !config.projectId) {
    firebaseApp = null;
    firestoreDb = null;
    return null;
  }
  try {
    const existingDefault = getApps().find((a) => a.name === '[DEFAULT]');
    if (existingDefault) {
      firebaseApp = existingDefault;
    } else {
      firebaseApp = initializeApp(config);
    }
    firestoreDb = getFirestore(firebaseApp);
    return firestoreDb;
  } catch (err) {
    console.error('Erro ao inicializar Firebase:', err);
    return null;
  }
}

export async function reinitFirebase(config) {
  saveStoredFirebaseConfig(config);
  try {
    const allApps = getApps();
    for (const app of allApps) {
      await deleteApp(app);
    }
  } catch {
    // ignore
  }
  firebaseApp = null;
  firestoreDb = null;
  return initFirebase(config);
}

export function getDb() {
  if (!firestoreDb) {
    initFirebase();
  }
  return firestoreDb;
}

export function isCloudConfigured() {
  const cfg = getStoredFirebaseConfig();
  return Boolean(cfg && cfg.apiKey && cfg.projectId);
}

// Test cloud connection without polluting the default app
export async function testConnection(config) {
  let tempApp = null;
  try {
    const testAppName = 'temp-test-' + Date.now();
    tempApp = initializeApp(config, testAppName);
    const tempDb = getFirestore(tempApp);
    const testCol = collection(tempDb, '_connection_test');
    await getDocs(testCol);
    return { success: true, message: 'Conexão com Firestore estabelecida com sucesso!' };
  } catch (err) {
    return { success: false, message: err.message || 'Falha ao conectar com o Firestore.' };
  } finally {
    if (tempApp) {
      try {
        await deleteApp(tempApp);
      } catch {
        // ignore
      }
    }
  }
}

// Clean objects so Firestore doesn't reject undefined values
function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      clean[k] = sanitizeForFirestore(v);
    }
  }
  return clean;
}

// Save single item to Firestore in the background
export async function saveToCloud(module, item) {
  const db = getDb();
  if (!db || !item || !item.id) return;
  try {
    const cleanItem = sanitizeForFirestore(item);
    const docRef = doc(db, module, item.id);
    await setDoc(docRef, cleanItem, { merge: true });
  } catch (err) {
    console.error(`Erro ao sincronizar item com a nuvem (${module}):`, err);
  }
}

// Delete single item from Firestore in the background
export async function deleteFromCloud(module, id) {
  const db = getDb();
  if (!db || !id) return;
  try {
    const docRef = doc(db, module, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Erro ao excluir item da nuvem (${module}):`, err);
  }
}

// Upload all local data to Firestore
export async function uploadAllLocalToCloud(modulesData) {
  let db = getDb();
  if (!db) {
    // Attempt re-init from stored config
    db = initFirebase();
  }
  if (!db) throw new Error('Firebase não configurado ou chaves inválidas');

  let totalUploaded = 0;
  for (const [module, items] of Object.entries(modulesData)) {
    if (!Array.isArray(items) || items.length === 0) continue;
    
    // Process in batches of up to 400 (Firestore limit is 500)
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        if (!item.id) continue;
        const cleanItem = sanitizeForFirestore(item);
        const ref = doc(db, module, item.id);
        batch.set(ref, cleanItem, { merge: true });
        totalUploaded++;
      }
      await batch.commit();
    }
  }
  return totalUploaded;
}

// Pull all collections from Firestore to local
export async function downloadAllCloudToLocal(moduleList) {
  let db = getDb();
  if (!db) {
    db = initFirebase();
  }
  if (!db) throw new Error('Firebase não configurado ou chaves inválidas');

  const result = {};
  for (const module of moduleList) {
    const colRef = collection(db, module);
    const snap = await getDocs(colRef);
    const list = [];
    snap.forEach((d) => {
      list.push(d.data());
    });
    result[module] = list;
  }
  return result;
}
