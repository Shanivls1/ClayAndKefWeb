import { logEvent } from './log.js';

const routes = new Map();
let current = null; // AbortController of the mounted page

export function register(path, page) {
  routes.set(path, page);
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    resolve();
  } else {
    location.hash = path;
  }
}

// Each page gets a fresh container and an AbortSignal. The signal aborts when the
// user navigates away: pages pass it to document/window listeners so they are removed,
// and check `signal.aborted` after awaits so late responses don't touch the new page.
// "#/orders?wa=remind" → page "/orders"; the page reads the "?…" part itself.
function resolve() {
  const hash = location.hash.slice(1).split('?')[0] || '/home';
  if (!routes.has(hash)) {
    location.hash = '/home';
    return;
  }
  const content = document.getElementById('content');
  if (!content) throw new Error('router: #content element not found in DOM');

  current?.abort();
  current = new AbortController();
  const { signal } = current;

  const page = routes.get(hash);
  const view = document.createElement('div');
  view.innerHTML = page.render();
  content.replaceChildren(view);

  if (page.mount) {
    Promise.resolve(page.mount(view, signal))
      .catch(err => logEvent('error', `Page ${hash} failed to load: ${err?.message ?? err}`, { stack: err?.stack }));
  }
  document.querySelectorAll('[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === hash);
  });
}

export function init() {
  window.addEventListener('hashchange', resolve);
  resolve(); // modules are deferred — DOM is ready when this runs
}
