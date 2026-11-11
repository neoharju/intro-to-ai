// Loads a script of the site once, on demand (KaTeX, highlight.js): a Promise that resolves when it has run.
// A failed load is tried again the next time.
const loading = new Map();

export function loadScript(src) {
  if (!loading.has(src)) {
    loading.set(src, new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        loading.delete(src);
        reject(new Error(`${src}: not loaded`));
      };
      document.head.append(script);
    }));
  }

  return loading.get(src);
}
