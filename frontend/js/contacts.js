document.addEventListener('DOMContentLoaded', async () => {
  if (!api.token) return location.href = 'login.html';
  try {
    const { user } = await api.request('/auth/me');
    if (user.role !== 'user') return location.replace(user.role === 'police' ? 'police.html' : 'admin.html');
  } catch {
    return location.replace('login.html');
  }

  window.toast = (message, type = '') => {
    let area = document.querySelector('.toast-area');
    if (!area) {
      area = document.createElement('div');
      area.className = 'toast-area';
      document.body.appendChild(area);
    }
    const element = document.createElement('div');
    element.className = `toast ${type}`;
    element.textContent = message;
    area.appendChild(element);
    setTimeout(() => element.remove(), 5000);
  };

  const modal = document.getElementById('contactModal');
  const form = document.getElementById('contactForm');
  let editingId = null;
  document.getElementById('logoutBtn').onclick = () => api.logout();

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  }

  function open(contact = null) {
    editingId = contact?._id || null;
    form.reset();
    document.getElementById('modalTitle').textContent = contact ? 'Edit contact' : 'Add contact';
    if (contact) {
      for (const key of ['name', 'relationship', 'phone', 'email']) form.elements[key].value = contact[key] || '';
    }
    modal.classList.remove('hidden');
  }

  function close() {
    modal.classList.add('hidden');
    editingId = null;
  }

  function verificationStatus(contact, channel) {
    const verified = channel === 'email' ? contact.emailVerified : contact.phoneVerified;
    const legacyVerified = contact.verified && !contact.emailVerified && !contact.phoneVerified;
    return verified || legacyVerified;
  }

  async function load() {
    try {
      const { contacts } = await api.request('/contacts');
      document.getElementById('contactsList').innerHTML = contacts.length
        ? `<table class="table"><thead><tr><th>Name</th><th>Relationship</th><th>Phone</th><th>Email</th><th>Verification</th><th>Actions</th></tr></thead><tbody>${contacts.map(contact => {
          const emailStatus = contact.email ? `Email: ${verificationStatus(contact, 'email') ? 'Verified' : contact.emailVerificationPending ? 'Code sent' : 'Not verified'}` : '';
          const phoneStatus = contact.phone ? `Phone: ${verificationStatus(contact, 'sms') ? 'Verified' : contact.phoneVerificationPending ? 'Code sent' : 'Not verified'}` : '';
          const actions = [
            contact.email && !verificationStatus(contact, 'email') ? `<button class="btn btn-ghost small verify" data-id="${escapeHtml(contact._id)}" data-channel="email" data-pending="${Boolean(contact.emailVerificationPending)}">${contact.emailVerificationPending ? 'Enter email code' : 'Send email code'}</button>` : '',
            contact.phone && !verificationStatus(contact, 'sms') ? `<button class="btn btn-ghost small verify" data-id="${escapeHtml(contact._id)}" data-channel="sms" data-pending="${Boolean(contact.phoneVerificationPending)}">${contact.phoneVerificationPending ? 'Enter phone code' : 'Send phone code'}</button>` : '',
            `<button class="btn btn-ghost small edit" data-id="${escapeHtml(contact._id)}">Edit</button>`,
            `<button class="btn btn-danger small delete" data-id="${escapeHtml(contact._id)}">Delete</button>`
          ].filter(Boolean).join(' ');
          return `<tr><td>${escapeHtml(contact.name)}</td><td>${escapeHtml(contact.relationship || '-')}</td><td>${escapeHtml(contact.phone || '-')}</td><td>${escapeHtml(contact.email || '-')}</td><td>${escapeHtml(emailStatus)}<br>${escapeHtml(phoneStatus)}</td><td>${actions}</td></tr>`;
        }).join('')}</tbody></table>`
        : '<p class="muted">No emergency contacts yet. Add someone you trust.</p>';

      document.querySelectorAll('.edit').forEach(button => {
        button.onclick = () => open(contacts.find(contact => contact._id === button.dataset.id));
      });
      document.querySelectorAll('.delete').forEach(button => {
        button.onclick = () => removeContact(button.dataset.id);
      });
      document.querySelectorAll('.verify').forEach(button => {
        button.onclick = () => verifyContact(button.dataset.id, button.dataset.channel, button.dataset.pending === 'true');
      });
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function verificationSummary(verifications = []) {
    return verifications.map(item => `${item.channel}: ${item.status === 'sent' ? 'code sent' : `not sent (${item.error || 'provider unavailable'})`}`).join('; ');
  }

  async function verifyContact(id, channel, pending) {
    try {
      if (!pending) {
        await api.request(`/contacts/${encodeURIComponent(id)}/verification`, {
          method: 'POST',
          body: JSON.stringify({ channel })
        });
      }
      const code = prompt(`Enter the six-digit code sent by ${channel === 'email' ? 'email' : 'SMS'}:`);
      if (code === null) return;
      try {
        await api.request(`/contacts/${encodeURIComponent(id)}/verify`, {
          method: 'POST',
          body: JSON.stringify({ channel, code: code.trim() })
        });
      } catch (error) {
        if (pending && error.message.includes('code expired')) {
          toast('Code expired. Select Send code to request another one.', 'error');
          await load();
          return;
        }
        throw error;
      }
      toast(`${channel === 'email' ? 'Email' : 'Phone'} verified`, 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function removeContact(id) {
    if (!confirm('Delete this emergency contact?')) return;
    try {
      await api.request(`/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Contact deleted', 'success');
      await load();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  document.getElementById('addContactBtn').onclick = () => open();
  document.getElementById('closeModal').onclick = close;
  document.getElementById('cancelModal').onclick = close;
  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.phone && !data.email) return toast('Enter a phone number or email', 'error');
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const result = await api.request(editingId ? `/contacts/${encodeURIComponent(editingId)}` : '/contacts', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      const summary = verificationSummary(result.verifications);
      toast(summary ? `Contact saved. ${summary}` : editingId ? 'Contact updated' : 'Contact added', result.verifications?.some(item => item.status !== 'sent') ? 'error' : 'success');
      close();
      await load();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  };

  await load();
});
