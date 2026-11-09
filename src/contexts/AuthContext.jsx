import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
import { isEmailAllowed } from '../utils/security';

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
      setUser((prevUser) => {
        if (prevUser && !isEmailAllowed(prevUser.email)) {
          logoutUser();
          return null;
        }
        return prevUser;
      });
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
      if (currentUser && !isEmailAllowed(currentUser.email)) {
        logoutUser();
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isConfigured]);

  const login = useCallback((email, password) => loginWithEmail(email, password), []);
  const register = useCallback((email, password) => registerWithEmail(email, password), []);
  const loginGoogle = useCallback(() => loginWithGoogle(), []);
  const logout = useCallback(() => logoutUser(), []);
  const sendPasswordReset = useCallback((email) => resetPassword(email), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isConfigured,
      login,
      register,
      loginGoogle,
      logout,
      sendPasswordReset,
      refreshConfig,
    }),
    [user, loading, isConfigured, login, register, loginGoogle, logout, sendPasswordReset, refreshConfig]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
