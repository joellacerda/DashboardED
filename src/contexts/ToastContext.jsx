import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import ToastContainer from '../components/ToastContainer';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, options = {}) => {
    const id = options.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast = {
      id,
      message,
      type: options.type || 'info', // 'success' | 'error' | 'warning' | 'info'
      title: options.title || '',
      duration: options.duration !== undefined ? options.duration : 4000,
      action: options.action || null, // { label: string, onClick: () => void }
      createdAt: Date.now(),
    };

    setToasts((prev) => {
      // Avoid excessive stack (keep up to 5 toasts max)
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered.slice(-4), newToast];
    });

    return id;
  }, []);

  const toast = useMemo(() => {
    const fn = (message, options) => addToast(message, options);
    fn.show = (message, type = 'info') => addToast(message, typeof type === 'string' ? { type } : type);
    fn.success = (message, options) => addToast(message, { ...options, type: 'success' });
    fn.error = (message, options) => addToast(message, { ...options, type: 'error' });
    fn.warning = (message, options) => addToast(message, { ...options, type: 'warning' });
    fn.info = (message, options) => addToast(message, { ...options, type: 'info' });
    fn.remove = (id) => removeToast(id);
    return fn;
  }, [addToast, removeToast]);

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}
