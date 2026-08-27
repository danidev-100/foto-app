import '@testing-library/jest-dom';

/**
 * localStorage polyfill.
 *
 * Node 22+ exposes an experimental global `localStorage` that is undefined
 * unless the process runs with `--localstorage-file`, and it shadows the
 * jsdom implementation in the vitest environment. Tests that touch
 * localStorage (AuthContext, Login, Register) fail with
 * "Cannot read properties of undefined (reading 'clear')" otherwise.
 *
 * We install a working in-memory implementation on both `window` and
 * `globalThis` (configurable) so the app code and the tests share it.
 */
if (typeof window !== 'undefined') {
  const store = new Map();

  const localStorageMock = {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: (key) => store.delete(String(key)),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };

  try {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
  } catch (err) {
    // Some environments already provide a working localStorage — keep it.
  }
}