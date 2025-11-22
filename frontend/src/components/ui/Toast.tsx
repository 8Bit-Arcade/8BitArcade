'use client';

import { useUIStore } from '@/stores/uiStore';

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  const getToastStyles = (type: string) => {
    const styles = {
      success: 'border-arcade-green text-arcade-green',
      error: 'border-arcade-red text-arcade-red',
      warning: 'border-arcade-yellow text-arcade-yellow',
      info: 'border-arcade-cyan text-arcade-cyan',
    };
    return styles[type as keyof typeof styles] || styles.info;
  };

  const getIcon = (type: string) => {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '!',
      info: 'i',
    };
    return icons[type as keyof typeof icons] || icons.info;
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-3 px-4 py-3
            bg-arcade-dark border-2 rounded-lg
            shadow-lg animate-float
            ${getToastStyles(toast.type)}
          `}
        >
          <span className="font-pixel text-lg">{getIcon(toast.type)}</span>
          <p className="font-arcade text-white">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
