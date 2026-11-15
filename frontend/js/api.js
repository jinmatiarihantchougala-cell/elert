(function () {
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isSeparateLocalFrontend = isLocalHost && window.location.protocol === 'http:' && window.location.port !== '5000';
  window.API_BASE = window.location.protocol === 'file:' || isSeparateLocalFrontend
    ? `http://${isLocalHost ? window.location.hostname : 'localhost'}:5000/api`
    : '/api';
  window.api = {
    token: localStorage.getItem('silentSosToken'),
    async request(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      let response;
      try {
        response = await fetch(API_BASE + path, { ...options, headers });
      } catch {
        throw new Error('Cannot reach the server. Check your connection and try again.');
      }
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok) {
        if (response.status === 401) this.logout(false);
        throw new Error(data.message || `Request failed (${response.status})`);
      }
      return data;
    },
    setSession(token, user) {
      this.token = token;
      localStorage.setItem('silentSosToken', token);
      localStorage.setItem('silentSosUser', JSON.stringify(user));
      if (user.discreetMode) document.documentElement.classList.add('discreet');
    },
    getUser() { try { return JSON.parse(localStorage.getItem('silentSosUser')); } catch { return null; } },
    logout(redirect = true) {
      this.token = null;
      localStorage.removeItem('silentSosToken');
      localStorage.removeItem('silentSosUser');
      document.documentElement.classList.remove('discreet');
      if (redirect) location.href = 'login.html';
    }
  };
})();
