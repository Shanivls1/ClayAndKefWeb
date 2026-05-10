const routes = new Map();

export function register(path, page) {
  routes.set(path, page);
}

export function navigate(path) {
  location.hash = path;
}

function resolve() {
  const hash = location.hash.slice(1) || '/dashboard';
  const page = routes.get(hash) ?? routes.get('/dashboard');
  if (!page) return;
  document.getElementById('content').innerHTML = page.render();
  document.querySelectorAll('[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === hash);
  });
}

export function init() {
  window.addEventListener('hashchange', resolve);
  resolve(); // modules are deferred — DOM is ready when this runs
}
