// js/hp-math.js — lazy KaTeX renderer for Provia HP math delprov (XYZ, and any KVA/NOG
// that carries LaTeX). KaTeX (~280kb) is only fetched the first time a question actually
// contains math, so the base page stays light (perf budget).

let _loading = null;
const KATEX = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist';

function inject(tag, attrs) {
  return new Promise((resolve) => {
    const e = document.createElement(tag);
    Object.assign(e, attrs);
    e.onload = () => resolve(true);
    e.onerror = () => resolve(false);
    document.head.appendChild(e);
  });
}

function loadKatex() {
  if (_loading) return _loading;
  _loading = (async () => {
    inject('link', { rel: 'stylesheet', href: `${KATEX}/katex.min.css` }); // css can race; render retries
    const core = await inject('script', { src: `${KATEX}/katex.min.js`, defer: false });
    if (!core) return false;
    return inject('script', { src: `${KATEX}/contrib/auto-render.min.js`, defer: false });
  })();
  return _loading;
}

// Cheap pre-check so we never pull KaTeX for plain-text items.
const MATH_RE = /\$.+?\$|\\\(|\\\[|\\frac|\\sqrt|\\times|\\cdot|\\pi|\^\{|_\{/;

export async function renderMath(rootEl) {
  if (!rootEl || !MATH_RE.test(rootEl.textContent || '')) return;
  const ok = await loadKatex();
  if (!ok || typeof window.renderMathInElement !== 'function') return;
  try {
    window.renderMathInElement(rootEl, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
    });
  } catch { /* leave raw text on render failure */ }
}
