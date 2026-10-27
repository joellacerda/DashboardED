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

let firebaseSdkPromise = null;
async function getFirebaseSdk() {
  if (!firebaseSdkPromise) {
    firebaseSdkPromise = Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
      import('firebase/auth'),
    ]).then(([appMod, firestoreMod, authMod]) => ({
      appMod,
      firestoreMod,
      authMod,
    }));
  }
  return firebaseSdkPromise;
}

let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;
let initPromise = null;

export async function initFirebase(config = getStoredFirebaseConfig()) {
  if (!config || !config.apiKey || !config.projectId) {
    firebaseApp = null;
    firestoreDb = null;
    firebaseAuth = null;
    return null;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const sdk = await getFirebaseSdk();
      const existingDefault = sdk.appMod.getApps().find((a) => a.name === '[DEFAULT]');
      if (existingDefault) {
        firebaseApp = existingDefault;
      } else {
        firebaseApp = sdk.appMod.initializeApp(config);
      }
      firestoreDb = sdk.firestoreMod.getFirestore(firebaseApp);
      firebaseAuth = sdk.authMod.getAuth(firebaseApp);
      return { db: firestoreDb, auth: firebaseAuth, sdk };
    } catch (err) {
      console.error('Erro ao inicializar Firebase:', err);
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function reinitFirebase(config) {
  saveStoredFirebaseConfig(config);
  try {
    const sdk = await getFirebaseSdk();
    const allApps = sdk.appMod.getApps();
    for (const app of allApps) {
      await sdk.appMod.deleteApp(app);
    }
  } catch {
    // ignore
  }
  firebaseApp = null;
  firestoreDb = null;
  firebaseAuth = null;
  return await initFirebase(config);
}

async function getServices() {
  if (!firestoreDb || !firebaseAuth) {
    await initFirebase();
  }
  if (!firestoreDb || !firebaseAuth) return null;
  const sdk = await getFirebaseSdk();
  return { db: firestoreDb, auth: firebaseAuth, sdk };
}

export function getDb() {
  return firestoreDb;
}

export function getFirebaseAuth() {
  return firebaseAuth;
}

export function isCloudConfigured() {
  const cfg = getStoredFirebaseConfig();
  return Boolean(cfg && cfg.apiKey && cfg.projectId);
}

// Authentication Helpers
export async function loginWithEmail(email, password) {
  const services = await getServices();
  if (!services?.auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  return await services.sdk.authMod.signInWithEmailAndPassword(services.auth, email.trim(), password);
}

export async function registerWithEmail(email, password) {
  const services = await getServices();
  if (!services?.auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  return await services.sdk.authMod.createUserWithEmailAndPassword(services.auth, email.trim(), password);
}

export async function loginWithGoogle() {
  const services = await getServices();
  if (!services?.auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  const provider = new services.sdk.authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return await services.sdk.authMod.signInWithPopup(services.auth, provider);
}

export async function logoutUser() {
  const services = await getServices();
  if (!services?.auth) return;
  return await services.sdk.authMod.signOut(services.auth);
}

export async function resetPassword(email) {
  const services = await getServices();
  if (!services?.auth) throw new Error('Firebase não configurado ou chaves ausentes.');
  return await services.sdk.authMod.sendPasswordResetEmail(services.auth, email.trim());
}

export function subscribeAuthState(callback) {
  if (!isCloudConfigured()) {
    callback(null);
    return () => {};
  }
  let unsub = null;
  let cancelled = false;

  getServices()
    .then((services) => {
      if (cancelled) return;
      if (!services?.auth) {
        callback(null);
        return;
      }
      unsub = services.sdk.authMod.onAuthStateChanged(services.auth, callback);
    })
    .catch((err) => {
      console.error('Erro ao subscrever auth state:', err);
      if (!cancelled) callback(null);
    });

  return () => {
    cancelled = true;
    if (typeof unsub === 'function') {
      unsub();
    }
  };
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
  let sdk = null;
  try {
    sdk = await getFirebaseSdk();
    const testAppName = 'temp-test-' + Date.now();
    tempApp = sdk.appMod.initializeApp(config, testAppName);
    const tempDb = sdk.firestoreMod.getFirestore(tempApp);
    const testCol = sdk.firestoreMod.collection(tempDb, '_connection_test');
    await sdk.firestoreMod.getDocs(testCol);
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
    if (tempApp && sdk) {
      try {
        await sdk.appMod.deleteApp(tempApp);
      } catch {
        // ignore
      }
    }
  }
}

// Clean objects so Firestore doesn't reject undefined values
export function sanitizeForFirestore(obj) {
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
  if (!isCloudConfigured() || !item || !item.id) return;
  try {
    const services = await getServices();
    if (!services?.db) return;
    const cleanItem = sanitizeForFirestore(item);
    const docRef = services.sdk.firestoreMod.doc(services.db, module, item.id);
    await services.sdk.firestoreMod.setDoc(docRef, cleanItem, { merge: true });
  } catch (err) {
    console.error(`Erro ao sincronizar item com a nuvem (${module}):`, err);
  }
}

// Delete single item from Firestore in the background
export async function deleteFromCloud(module, id) {
  if (!isCloudConfigured() || !id) return;
  try {
    const services = await getServices();
    if (!services?.db) return;
    const docRef = services.sdk.firestoreMod.doc(services.db, module, id);
    await services.sdk.firestoreMod.deleteDoc(docRef);
  } catch (err) {
    console.error(`Erro ao excluir item da nuvem (${module}):`, err);
  }
}

// Upload all local data to Firestore
export async function uploadAllLocalToCloud(modulesData) {
  const services = await getServices();
  if (!services?.db) throw new Error('Firebase não configurado ou chaves inválidas');
  const { db, sdk } = services;
  const { doc, writeBatch } = sdk.firestoreMod;

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
  const services = await getServices();
  if (!services?.db) throw new Error('Firebase não configurado ou chaves inválidas');
  const { db, sdk } = services;
  const { collection, getDocs } = sdk.firestoreMod;

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
