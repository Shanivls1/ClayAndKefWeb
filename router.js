const routes = new Map();

export function register(path, page) {
  routes.set(path, page);
}

export function navigate(path) {
  if (location.hash === path) {
    resolve();
  } else {
    location.hash = path;
  }
}

function resolve() {
  const hash = location.hash.slice(1) || '/dashboard';
  if (!routes.has(hash)) {
    location.hash = '/dashboard';
    return;
  }
  const page = routes.get(hash);
  const el = document.getElementById('content');
  if (!el) throw new Error('router: #content element not found in DOM');
  el.innerHTML = page.render();
  document.querySelectorAll('[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === hash);
  });
}

export function init() {
  window.addEventListener('hashchange', resolve);
  resolve(); // modules are deferred — DOM is ready when this runs
}
