'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { generateId } from '@/lib/utils/id';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-l-green-500 dark:border-l-green-400',
  error: 'border-l-red-500 dark:border-l-red-400',
  info: 'border-l-blue-500 dark:border-l-blue-400',
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const VARIANT_ICON_COLORS: Record<ToastVariant, string> = {
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
};

function ToastItemComponent({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className={`animate-toast-slide-in flex items-start gap-2 rounded-lg border-l-4 bg-white px-4 py-3 shadow-lg dark:bg-zinc-900 ${VARIANT_STYLES[toast.variant]}`}
    >
      <span className={`mt-0.5 text-sm font-bold ${VARIANT_ICON_COLORS[toast.variant]}`}>
        {VARIANT_ICONS[toast.variant]}
      </span>
      <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="ml-2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItemComponent
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
