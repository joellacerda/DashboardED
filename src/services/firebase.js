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
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';

const CONFIG_STORAGE_KEY = 'endodiagnose_firebase_config';

export function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.apiKey && parsed.projectId) {
        if (!parsed.authDomain) {
          parsed.authDomain = `${parsed.projectId}.firebaseapp.com`;
        }
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
    // Ensure authDomain is filled
    if (!config.authDomain && config.projectId) {
      config.authDomain = `${config.projectId}.firebaseapp.com`;
    }
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;

export function initFirebase(config = getStoredFirebaseConfig()) {
  if (!config || !config.apiKey || !config.projectId) {
    firebaseApp = null;
    firestoreDb = null;
    firebaseAuth = null;
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
    firebaseAuth = getAuth(firebaseApp);
    return { db: firestoreDb, auth: firebaseAuth };
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
  firebaseAuth = null;
  return initFirebase(config);
}

export function getDb() {
  if (!firestoreDb) {
    initFirebase();
  }
  return firestoreDb;
}

export function getFirebaseAuth() {
  if (!firebaseAuth) {
    initFirebase();
  }
  return firebaseAuth;
}

export function isCloudConfigured() {
  const cfg = getStoredFirebaseConfig();
  return Boolean(cfg && cfg.apiKey && cfg.projectId);
}

// Authentication Helpers
export async function loginWithEmail(email, password) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  return await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function registerWithEmail(email, password) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  return await createUserWithEmailAndPassword(auth, email.trim(), password);
}

export async function loginWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return await signInWithPopup(auth, provider);
}

export async function logoutUser() {
  const auth = getFirebaseAuth();
  if (!auth) return;
  return await signOut(auth);
}

export async function resetPassword(email) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  return await sendPasswordResetEmail(auth, email.trim());
}

export function subscribeAuthState(callback) {
  const auth = getFirebaseAuth();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getAuthErrorMessage(error) {
  const code = typeof error === 'string' ? error : (error?.code || '');
  const message = error?.message || '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'auth/invalid-email':
      return 'O endereço de e-mail informado é inválido.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado no sistema.';
    case 'auth/weak-password':
      return 'A senha deve conter no mínimo 6 caracteres.';
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação do Google foi fechada antes de concluir.';
    case 'auth/cancelled-popup-request':
      return 'Solicitação de login cancelada.';
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela pop-up de login. Permita pop-ups para este site.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'O provedor Google não está ativado no Firebase Console. Acesse Authentication > Sign-in method > Google e ative-o.';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado. Adicione "localhost" em Authentication > Settings > Authorized Domains no Firebase Console.';
    case 'auth/auth-domain-config-required':
      return 'authDomain ausente na configuração do Firebase. Preencha o Auth Domain nas configurações.';
    case 'auth/configuration-not-found':
      return 'Serviço de Authentication não configurado no seu projeto Firebase.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas consecutivas. Aguarde alguns instantes antes de tentar novamente.';
    case 'auth/network-request-failed':
      return 'Falha de conexão com a rede. Verifique seu acesso à internet.';
    case 'auth/user-disabled':
      return 'Esta conta de usuário foi desativada.';
    default:
      if (code) {
        return `Erro de autenticação [${code}]: ${message || 'Verifique as configurações no console do Firebase.'}`;
      }
      return message || 'Ocorreu um erro durante a autenticação. Verifique os dados e tente novamente.';
  }
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
    // A permission-denied error confirms the database exists, the API key is valid,
    // and Firestore successfully evaluated the security rules (which require authentication).
    const isPermissionDenied =
      err.code === 'permission-denied' ||
      err.code === 'firestore/permission-denied' ||
      err.message?.toLowerCase().includes('permission') ||
      err.message?.includes('insufficient permissions');

    if (isPermissionDenied) {
      return {
        success: true,
        message: 'Conexão estabelecida com sucesso! O banco está ativo e protegido por autenticação.',
        protectedByAuth: true,
      };
    }
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
