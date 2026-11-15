document.addEventListener('DOMContentLoaded', async () => {
  if (!api.token) return location.replace('login.html');
  document.getElementById('logoutBtn').onclick = () => api.logout();

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  }

  function renderAlerts(alerts) {
    const container = document.getElementById('policeAlerts');
    if (!alerts.length) {
      container.innerHTML = '<p class="muted">No emergency alerts have been recorded.</p>';
      return;
    }
    container.innerHTML = `<table class="table"><thead><tr><th>Alert</th><th>Person</th><th>Status</th><th>Triggered</th><th>Latest location</th><th>Notifications</th><th>Action</th></tr></thead><tbody>${alerts.map(alert => {
      const notifications = alert.notifications.map(notification => `${escapeHtml(notification.channel)}: ${escapeHtml(notification.status)}`).join('<br>') || 'None';
      const action = alert.status === 'Active'
        ? `<button class="btn btn-primary small acknowledge" data-id="${escapeHtml(alert._id)}">Acknowledge</button> <button class="btn btn-danger small resolve" data-id="${escapeHtml(alert._id)}">Resolve</button>`
        : alert.status === 'Acknowledged'
          ? `<span>Acknowledged</span><br><button class="btn btn-danger small resolve" data-id="${escapeHtml(alert._id)}">Resolve</button>`
          : `Resolved${alert.resolutionTime ? `<br>${escapeHtml(new Date(alert.resolutionTime).toLocaleString())}` : ''}`;
      return `<tr><td>${escapeHtml(alert.alertId)}</td><td>${escapeHtml(alert.userName)}</td><td><span class="status-pill ${alert.status === 'Active' ? 'danger' : ''}">${escapeHtml(alert.status)}</span></td><td>${escapeHtml(new Date(alert.triggerTime).toLocaleString())}</td><td>${Number(alert.latitude).toFixed(5)}, ${Number(alert.longitude).toFixed(5)}<br>±${escapeHtml(alert.accuracy ?? 'Unknown')} m<br><a href="${escapeHtml(alert.locationLink)}" target="_blank" rel="noopener noreferrer">Open in Maps</a></td><td>${notifications}</td><td>${action}</td></tr>`;
    }).join('')}</tbody></table>`;
    container.querySelectorAll('.acknowledge').forEach(button => {
      button.addEventListener('click', () => acknowledge(button.dataset.id, button));
    });
    container.querySelectorAll('.resolve').forEach(button => {
      button.addEventListener('click', () => resolve(button.dataset.id, button));
    });
  }

  let latestAlerts = [];
  let selectedMapAlertId = null;
  let mapSelectionChanged = false;
  function renderLocation(alerts) {
    latestAlerts = alerts;
    const select = document.getElementById('mapAlertSelect');
    const map = document.getElementById('policeMap');
    const openMap = document.getElementById('openPoliceMap');
    const status = document.getElementById('mapLocationStatus');
    if (!alerts.length) {
      select.innerHTML = '';
      map.classList.add('hidden');
      openMap.classList.add('hidden');
      status.textContent = 'No reported locations yet.';
      return;
    }

    const selected = (mapSelectionChanged && alerts.find(alert => String(alert._id) === selectedMapAlertId))
      || alerts.find(alert => alert.status === 'Active')
      || alerts.find(alert => alert.status === 'Acknowledged')
      || alerts.find(alert => String(alert._id) === selectedMapAlertId)
      || alerts[0];
    select.innerHTML = alerts.map(alert => `<option value="${escapeHtml(alert._id)}">${escapeHtml(alert.alertId)} · ${escapeHtml(alert.userName)} · ${escapeHtml(alert.status)}</option>`).join('');
    select.value = String(selected._id);
    selectedMapAlertId = String(selected._id);
    if (!select.dataset.bound) {
      select.addEventListener('change', () => {
        selectedMapAlertId = select.value;
        mapSelectionChanged = true;
        renderLocation(latestAlerts);
      });
      select.dataset.bound = 'true';
    }

    const latitude = Number(selected.latitude);
    const longitude = Number(selected.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      map.classList.add('hidden');
      openMap.classList.add('hidden');
      status.textContent = 'This alert does not contain valid coordinates.';
      return;
    }
    const mapUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
    if (map.src !== mapUrl) map.src = mapUrl;
    map.classList.remove('hidden');
    openMap.href = selected.locationLink;
    openMap.classList.remove('hidden');
    status.textContent = `${selected.alertId} · ${latitude.toFixed(5)}, ${longitude.toFixed(5)} · ±${selected.accuracy ?? 'Unknown'} m · Updated ${new Date(selected.lastLocationUpdate || selected.triggerTime).toLocaleString()}`;
  }

  let loading = false;
  async function load(showErrors = false) {
    if (loading) return;
    loading = true;
    try {
      const data = await api.request('/police/dashboard');
      document.getElementById('activeCount').textContent = data.stats.active;
      document.getElementById('acknowledgedCount').textContent = data.stats.acknowledged;
      document.getElementById('resolvedCount').textContent = data.stats.resolved;
      renderLocation(data.alerts);
      renderAlerts(data.alerts);
      document.getElementById('refreshStatus').textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      document.getElementById('refreshStatus').textContent = 'Could not refresh alerts';
      if (showErrors) {
        document.getElementById('policeAlerts').innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
      }
      if (!api.token) location.replace('login.html');
    } finally {
      loading = false;
    }
  }

  async function acknowledge(id, button) {
    button.disabled = true;
    try {
      await api.request(`/police/alerts/${encodeURIComponent(id)}/acknowledge`, { method: 'PUT' });
      await load(true);
    } catch (error) {
      button.disabled = false;
      document.getElementById('refreshStatus').textContent = error.message;
    }
  }

  async function resolve(id, button) {
    if (!confirm('Resolve this emergency? The user’s live location tracking will stop.')) return;
    button.disabled = true;
    try {
      await api.request(`/police/alerts/${encodeURIComponent(id)}/resolve`, { method: 'PUT' });
      await load(true);
    } catch (error) {
      button.disabled = false;
      document.getElementById('refreshStatus').textContent = error.message;
    }
  }

  let me;
  try { me = await api.request('/auth/me'); }
  catch { return location.replace('login.html'); }
  if (me.user.role !== 'police') {
    return location.replace(me.user.role === 'admin' ? 'admin.html' : 'dashboard.html');
  }
  await load(true);
  window.setInterval(() => { if (!document.hidden) load(); }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
});
