document.addEventListener('DOMContentLoaded', () => {
  window.toast = (message, type = '') => {
    let area = document.querySelector('.toast-area');
    if (!area) { area = document.createElement('div'); area.className='toast-area'; document.body.appendChild(area); }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; toast.textContent = message; area.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  };
  const registerForm = document.querySelector('#registerForm');
  const loginForm = document.querySelector('#loginForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(registerForm));
      if (data.password !== data.confirmPassword) return toast('Passwords do not match', 'error');
      if (data.password.length < 8) return toast('Password must be at least 8 characters', 'error');
      const button = registerForm.querySelector('[type=submit]'); button.disabled=true; button.textContent='Creating account...';
      try {
        const result = await api.request('/auth/register', { method:'POST', body:JSON.stringify(data) });
        api.setSession(result.token, result.user);
        location.href = result.user.role === 'admin' ? 'admin.html' : result.user.role === 'police' ? 'police.html' : 'dashboard.html';
      } catch (error) { toast(error.message, 'error'); }
      finally { button.disabled=false; button.textContent='Create account'; }
    });
  }
  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm));
    if (new URLSearchParams(location.search).get('admin') === '1') data.accountType = 'admin';
    const button = loginForm.querySelector('[type=submit]'); button.disabled=true; button.textContent='Signing in...';
    try {
      const result = await api.request('/auth/login', { method:'POST', body:JSON.stringify(data) });
      api.setSession(result.token, result.user);
      location.href = result.user.role === 'admin' ? 'admin.html' : result.user.role === 'police' ? 'police.html' : 'dashboard.html';
    } catch (error) { toast(error.message, 'error'); }
    finally { button.disabled=false; button.textContent='Sign in securely'; }
  });
});
