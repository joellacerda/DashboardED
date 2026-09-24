import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  subscribeAuthState,
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  logoutUser,
  resetPassword,
  isCloudConfigured,
  initFirebase,
} from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(() => isCloudConfigured());

  // Function to refresh config status (e.g. after saving/disconnecting in CloudSyncModal)
  const refreshConfig = useCallback(() => {
    const configured = isCloudConfigured();
    setIsConfigured(configured);
    if (!configured) {
      setUser(null);
      setLoading(false);
    } else {
      initFirebase();
    }
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeAuthState((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isConfigured]);

  const login = async (email, password) => {
    return await loginWithEmail(email, password);
  };

  const register = async (email, password) => {
    return await registerWithEmail(email, password);
  };

  const loginGoogle = async () => {
    return await loginWithGoogle();
  };

  const logout = async () => {
    return await logoutUser();
  };

  const sendPasswordReset = async (email) => {
    return await resetPassword(email);
  };

  const value = {
    user,
    loading,
    isConfigured,
    login,
    register,
    loginGoogle,
    logout,
    sendPasswordReset,
    refreshConfig,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
