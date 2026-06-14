import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success:
    'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200',
  error:
    'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
  info:
    'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200',
  warning:
    'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200',
};

const TOAST_ICONS = {
  success: '\u2713',
  error: '\u2715',
  info: '\u2139',
  warning: '\u26A0',
};

const MAX_VISIBLE = 5;

let nextId = 0;

function toastReducer(state, action) {
  switch (action.type) {
    case 'ADD_TOAST': {
      const newToasts = [...state.toasts, action.toast];
      if (newToasts.length > MAX_VISIBLE) {
        return { ...state, toasts: newToasts.slice(-MAX_VISIBLE) };
      }
      return { ...state, toasts: newToasts };
    }
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export default function ToastProvider({ children, duration = 3000 }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] });
  const timersRef = useRef({});

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE_TOAST', id });
    delete timersRef.current[id];
  }, []);

  const addToast = useCallback(
    (message, type = 'info', opts = {}) => {
      const id = ++nextId;
      const toastDuration = opts.duration ?? duration;

      dispatch({ type: 'ADD_TOAST', toast: { id, message, type } });

      if (toastDuration > 0) {
        timersRef.current[id] = setTimeout(() => removeToast(id), toastDuration);
      }
    },
    [duration, removeToast]
  );

  const toast = {
    success: (message, opts) => addToast(message, 'success', opts),
    error: (message, opts) => addToast(message, 'error', opts),
    info: (message, opts) => addToast(message, 'info', opts),
    warning: (message, opts) => addToast(message, 'warning', opts),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-label="Notifications"
          className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full sm:w-80"
        >
          {state.toasts.map((t) => (
            <div
              key={t.id}
              role="alert"
              className={`flex items-start gap-2 p-3 rounded-lg border shadow-lg transition-all ${TOAST_STYLES[t.type] || TOAST_STYLES.info}`}
            >
              <span className="flex-shrink-0 mt-0.5 text-base leading-none">
                {TOAST_ICONS[t.type] || TOAST_ICONS.info}
              </span>
              <p className="flex-1 text-sm leading-tight pt-0.5">{t.message}</p>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="flex-shrink-0 ml-1 text-current opacity-60 hover:opacity-100 transition-opacity text-sm leading-none p-0.5"
                aria-label="Close"
              >
                {TOAST_ICONS.error}
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
