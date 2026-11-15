document.addEventListener('DOMContentLoaded',async()=>{
 if(!api.token)return location.href='login.html';
 try{const {user}=await api.request('/auth/me');if(user.role!=='user')return location.replace(user.role==='police'?'police.html':'admin.html')}catch{return location.replace('login.html')}
 window.toast=(m,t='')=>alert(m);
 document.getElementById('logoutBtn').onclick=()=>api.logout();
 async function load(){
  try{const data=await api.request('/alerts');document.getElementById('alertsList').innerHTML=data.alerts.length?`<table class="table"><thead><tr><th>Alert ID</th><th>Status</th><th>Triggered</th><th>Resolved</th><th>Location accuracy</th><th>Location</th><th></th></tr></thead><tbody>${data.alerts.map(a=>`<tr><td>${esc(a.alertId)}</td><td><span class="status-pill ${a.status==='Active'?'danger':a.status==='Resolved'?'':''}">${a.status}</span></td><td>${new Date(a.triggerTime).toLocaleString()}</td><td>${a.resolutionTime?new Date(a.resolutionTime).toLocaleString():'-'}</td><td>${a.accuracy!=null?'±'+Math.round(a.accuracy)+' m':'Unknown'}</td><td><a class="btn btn-ghost small" href="${a.locationLink}" target="_blank" rel="noopener">Map</a></td><td>${a.status!=='Resolved'?`<button class="btn btn-success small resolve" data-id="${a._id}">Resolve</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">No emergency history.</p>';document.querySelectorAll('.resolve').forEach(b=>b.onclick=()=>resolve(b.dataset.id));}catch(error){document.getElementById('alertsList').innerHTML=`<p class="muted">${esc(error.message)}</p>`}
 }
 function esc(v){const d=document.createElement('div');d.textContent=v||'';return d.innerHTML}
 async function resolve(id){if(!confirm('Resolve this emergency and stop location tracking?'))return;try{await api.request(`/alerts/${id}/resolve`,{method:'PUT'});load()}catch(error){alert(error.message)}}
 load();
});
