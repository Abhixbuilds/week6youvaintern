/* Small shared UI helpers. */
const UI = {
  // Escape text before putting it in innerHTML: topic and problem names are user input.
  esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

  // Progress-bar widths are set from JS (not inline style attributes) so the strict CSP can stay on.
  bars(root = document) { root.querySelectorAll('[data-pct]').forEach(el => { el.style.width = el.dataset.pct + '%'; }); },

  toast(message, type = 'error') {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); el.hidden = true;
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `toast ${type}`;
    el.hidden = false;
    clearTimeout(UI._t);
    UI._t = setTimeout(() => { el.hidden = true; }, 4000);
  },

  // Redirect to the login page when there is no token. Returns true if the page may continue.
  requireAuth() {
    if (Api.isLoggedIn()) return true;
    location.replace('login.html');
    return false;
  },

  // Show "Log out" or "Sign in" in the header.
  initNav() {
    const slot = document.getElementById('authlink');
    if (!slot) return;
    if (Api.isLoggedIn()) {
      slot.innerHTML = '<button type="button" class="btn alt small" id="logout">Log out</button>';
      document.getElementById('logout').onclick = () => { Api.setToken(null); location.href = 'login.html'; };
    } else {
      slot.innerHTML = '<a href="login.html">Sign in</a>';
    }
  },

  // Turn an ApiError into HTML for a message box.
  errorHtml(e) {
    const list = e.details?.length ? `<ul>${e.details.map(d => `<li>${UI.esc(d.message)}</li>`).join('')}</ul>` : '';
    return `${UI.esc(e.message)}${list}`;
  },
};
document.addEventListener('DOMContentLoaded', UI.initNav);
