import '@testing-library/jest-dom';

if (typeof window !== 'undefined') {
  let localStore: Record<string, string> = {};
  let sessionStore: Record<string, string> = {};

  if (typeof Storage !== 'undefined') {
    Storage.prototype.getItem = function(key: string) {
      const store = this === (window as any).sessionStorage ? sessionStore : localStore;
      return key in store ? store[key] : null;
    };
    Storage.prototype.setItem = function(key: string, value: string) {
      const store = this === (window as any).sessionStorage ? sessionStore : localStore;
      store[key] = String(value);
    };
    Storage.prototype.removeItem = function(key: string) {
      const store = this === (window as any).sessionStorage ? sessionStore : localStore;
      delete store[key];
    };
    Storage.prototype.clear = function() {
      if (this === (window as any).sessionStorage) {
        sessionStore = {};
      } else {
        localStore = {};
      }
    };
    Storage.prototype.key = function(index: number) {
      const store = this === (window as any).sessionStorage ? sessionStore : localStore;
      return Object.keys(store)[index] || null;
    };
    Object.defineProperty(Storage.prototype, 'length', {
      get: function() {
        const store = this === (window as any).sessionStorage ? sessionStore : localStore;
        return Object.keys(store).length;
      },
      configurable: true
    });

    const localStorageInstance = Object.create(Storage.prototype);
    const sessionStorageInstance = Object.create(Storage.prototype);
    Object.defineProperty(window, 'localStorage', {
      value: localStorageInstance,
      writable: true,
      configurable: true
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageInstance,
      writable: true,
      configurable: true
    });
  }
}

if (typeof global !== 'undefined' && !(global as any).localStorage) {
  (global as any).localStorage = (window as any).localStorage;
}
