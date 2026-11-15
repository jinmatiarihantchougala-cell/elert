document.addEventListener('DOMContentLoaded',async()=>{
 if(!api.token)return location.href='login.html?admin=1';
 document.getElementById('logoutBtn').onclick=()=>api.logout();
 try{
  const me=await api.request('/auth/me');if(me.user.role!=='admin')return location.replace(me.user.role==='police'?'police.html':'dashboard.html');
  const [dashboard,alerts,users]=await Promise.all([api.request('/admin/dashboard'),api.request('/admin/alerts'),api.request('/admin/users')]);
  const s=dashboard.stats;document.getElementById('stats').innerHTML=`<article class="card"><span class="muted">Registered users</span><div class="stat-value">${s.users}</div></article><article class="card"><span class="muted">Total alerts</span><div class="stat-value">${s.alerts}</div></article><article class="card"><span class="muted">Active emergencies</span><div class="stat-value" style="color:#ff6b69">${s.active}</div></article>`;
  document.getElementById('adminAlerts').innerHTML=alerts.alerts.length?`<table class="table"><thead><tr><th>Alert ID</th><th>User ID</th><th>Status</th><th>Triggered</th><th>Location</th><th>Notifications</th></tr></thead><tbody>${alerts.alerts.map(a=>`<tr><td>${esc(a.alertId)}</td><td>${esc(a.user)}</td><td>${esc(a.status)}</td><td>${new Date(a.triggerTime).toLocaleString()}</td><td><a href="${a.locationLink}" target="_blank" rel="noopener">Map</a></td><td>${a.notifications.map(n=>`${esc(n.channel)}: ${esc(n.status)}`).join('<br>')||'None'}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">No alerts recorded.</p>';
  document.getElementById('adminUsers').innerHTML=users.users.length?`<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead><tbody>${users.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone||'-')}</td><td>${esc(u.role)}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">No users.</p>';
 }catch(error){document.getElementById('adminAlerts').innerHTML=`<p class="muted">${esc(error.message)}</p>`}
 function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML}
});
