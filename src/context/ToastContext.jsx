import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: { bg: '#10b981', icon: '✓' },
  error:   { bg: '#ef4444', icon: '✕' },
  warning: { bg: '#f59e0b', icon: '!' },
  info:    { bg: '#3b82f6', icon: 'i' },
};

const DEFAULT_DURATION = 3500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message, variant = 'info', duration = DEFAULT_DURATION) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, variant, duration }]);
    return id;
  }, []);

  const toast = useMemo(() => ({
    success: (msg, d) => show(msg, 'success', d),
    error:   (msg, d) => show(msg, 'error', d ?? 5000),
    warning: (msg, d) => show(msg, 'warning', d),
    info:    (msg, d) => show(msg, 'info', d),
  }), [show]);

  const ctxValue = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      <div className="fixed z-[1000] top-4 right-4 left-4 sm:left-auto flex flex-col gap-2 pointer-events-none items-end">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const { bg, icon } = VARIANTS[toast.variant] || VARIANTS.info;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 220);
    }, toast.duration);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(timer);
    };
  }, [toast.duration, onDismiss]);

  return (
    <div
      role="status"
      onClick={() => { setVisible(false); setTimeout(onDismiss, 220); }}
      className="pointer-events-auto cursor-pointer rounded-lg shadow-lg flex items-center gap-3 px-4 py-3 max-w-sm w-full sm:w-auto text-white text-sm font-medium"
      style={{
        backgroundColor: bg,
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 220ms ease, opacity 220ms ease',
      }}
    >
      <span
        className="flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs shrink-0"
        style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
      >
        {icon}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
