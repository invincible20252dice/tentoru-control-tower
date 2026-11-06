import '@testing-library/jest-dom';

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
};

if (typeof window !== 'undefined') {
  const storageMock = createStorageMock();
  Object.defineProperty(window, 'localStorage', {
    value: storageMock,
    writable: true,
    configurable: true
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: createStorageMock(),
    writable: true,
    configurable: true
  });
}
if (typeof global !== 'undefined' && !(global as any).localStorage) {
  (global as any).localStorage = (window as any).localStorage;
}

