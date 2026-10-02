/* Login / register page. */
(() => {
  if (Api.isLoggedIn()) { location.replace('dashboard.html'); return; }
  const $ = id => document.getElementById(id);
  let mode = 'login';

  if (new URLSearchParams(location.search).has('expired')) {
    $('notice').hidden = false;
    $('notice').textContent = 'Your session has expired. Please log in again.';
  }

  function setMode(m) {
    mode = m;
    $('name-field').hidden = m === 'login';
    $('name').required = m === 'register';
    $('password').autocomplete = m === 'login' ? 'current-password' : 'new-password';
    $('submit').textContent = m === 'login' ? 'Log in' : 'Create account';
    $('form-title').textContent = m === 'login' ? 'Log in' : 'Create your account';
    $('hint').hidden = m === 'login';
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.mode === m));
    $('error').hidden = true;
  }
  document.querySelectorAll('.chip').forEach(c => { c.onclick = () => setMode(c.dataset.mode); });

  $('auth-form').onsubmit = async e => {
    e.preventDefault();
    $('error').hidden = true;
    $('submit').disabled = true;
    const body = { email: $('email').value, password: $('password').value };
    if (mode === 'register') body.name = $('name').value;
    try {
      const data = await Api.post(mode === 'login' ? '/auth/login' : '/auth/register', body);
      Api.setToken(data.token);
      location.href = 'dashboard.html';
    } catch (err) {
      $('error').innerHTML = UI.errorHtml(err);
      $('error').hidden = false;
      $('submit').disabled = false;
    }
  };
  setMode('login');
})();
