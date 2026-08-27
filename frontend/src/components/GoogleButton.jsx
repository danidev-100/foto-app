import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

/**
 * "Continuar con Google" button (Google Identity Services).
 *
 * Fetches the public client id from the backend config endpoint, loads the
 * GIS script, renders the Google button and hands the ID token to `onSuccess`.
 * Renders nothing when Google login is not configured.
 */
export default function GoogleButton({ onSuccess, dark = false }) {
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // Fetch public Google client id from the backend (single source of truth)
  useEffect(() => {
    let cancelled = false;
    api
      .get('/config/google-login')
      .then(({ data }) => {
        if (!cancelled) setClientId(data?.data?.clientId || '');
      })
      .catch(() => {
        if (!cancelled) setClientId('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load GIS script and render the button once we have the client id
  useEffect(() => {
    if (!clientId) return;

    const init = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response?.credential) return;
          setError('');
          setLoading(true);
          try {
            await onSuccessRef.current(response.credential);
          } catch (err) {
            setError('No se pudo iniciar sesión con Google. Intentá de nuevo.');
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: dark ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div>
      <div ref={buttonRef} />
      {loading && <p className="mt-2 text-sm text-surface-500">Iniciando sesión…</p>}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}