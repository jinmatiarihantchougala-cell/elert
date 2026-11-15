document.addEventListener('DOMContentLoaded', async () => {
  if (!api.token) return location.href='login.html';
  let session;
  try { session = await api.request('/auth/me'); }
  catch { return location.replace('login.html'); }
  if (session.user.role === 'police') return location.replace('police.html');
  if (session.user.role === 'admin') return location.replace('admin.html');
  window.toast=(message,type='')=>{let area=document.querySelector('.toast-area')||Object.assign(document.createElement('div'),{className:'toast-area'});if(!area.parentNode)document.body.appendChild(area);const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;area.appendChild(el);setTimeout(()=>el.remove(),5000);};
  const user=api.getUser(); if(user?.discreetMode)document.documentElement.classList.add('discreet');
  document.getElementById('welcomeName').textContent=`Welcome, ${user?.name||'User'}`;
  document.getElementById('profileName').textContent=user?.name||'User';document.getElementById('profileEmail').textContent=user?.email||'';
  document.getElementById('logoutBtn').onclick=()=>api.logout();
  document.getElementById('editProfileBtn').onclick=async()=>{
    const current=api.getUser();
    const name=prompt('Full name',current?.name||''); if(name===null)return;
    const phone=prompt('Phone number',current?.phone||''); if(phone===null)return;
    const discreet=confirm('Enable discreet light interface?');
    try{const result=await api.request('/auth/profile',{method:'PUT',body:JSON.stringify({name:name.trim(),phone:phone.trim(),discreetMode:discreet})});api.setSession(api.token,result.user);if(discreet)document.documentElement.classList.add('discreet');else document.documentElement.classList.remove('discreet');toast('Profile updated','success');await load();}catch(error){toast(error.message,'error')}
  };
  document.getElementById('quickExit').onclick=()=>location.replace('https://www.google.com');

  let activeAlert=null, watchId=null, watchingAlertId=null, holding=false, holdTimer=null, loading=false;
  async function load(showErrors=false) {
    if(loading)return;
    loading=true;
    try {
      const [me,contacts,alerts]=await Promise.all([api.request('/auth/me'),api.request('/contacts'),api.request('/alerts')]);
      document.getElementById('profileName').textContent=me.user.name;document.getElementById('welcomeName').textContent=`Welcome, ${me.user.name}`;
      document.getElementById('contactCount').textContent=contacts.contacts.length;
      activeAlert=alerts.alerts.find(a=>a.status==='Active'||a.status==='Acknowledged')||null;
      document.getElementById('activeCount').textContent=activeAlert?1:0;document.getElementById('recentCount').textContent=alerts.alerts.length;
      const status=document.getElementById('overallStatus');status.textContent=activeAlert?(activeAlert.status==='Acknowledged'?'Acknowledged':'Emergency active'):'Safe';status.className=`status-pill ${activeAlert?'danger':''}`;
      document.getElementById('alertStatus').textContent=activeAlert?(activeAlert.status==='Acknowledged'?'A responder has acknowledged this emergency.':'Waiting for a responder to acknowledge.'):'No active emergency';
      document.getElementById('activeAlertActions').classList.toggle('hidden',!activeAlert);
      if(activeAlert){document.getElementById('latestLocation').textContent=`${activeAlert.latitude.toFixed(5)}, ${activeAlert.longitude.toFixed(5)} (±${activeAlert.accuracy||'?'} m)`;document.getElementById('locationTime').textContent=`Last location update: ${new Date(activeAlert.lastLocationUpdate||activeAlert.triggerTime).toLocaleTimeString()}`;const link=document.getElementById('mapLink');link.href=activeAlert.locationLink;link.classList.remove('hidden');if(watchId&&watchingAlertId!==activeAlert._id)stopWatch();if(!watchId)startWatch();}
      else if(watchId!==null){stopWatch();document.getElementById('gpsStatus').textContent='Tracking stopped';}
      const recent=alerts.alerts.slice(0,5);document.getElementById('recentAlerts').innerHTML=recent.length?`<table class="table"><thead><tr><th>Alert ID</th><th>Status</th><th>Triggered</th><th>Location</th></tr></thead><tbody>${recent.map(a=>`<tr><td>${escapeHtml(a.alertId)}</td><td>${a.status}</td><td>${new Date(a.triggerTime).toLocaleString()}</td><td><a href="${a.locationLink}" target="_blank" rel="noopener">Map</a></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No emergency history.</p>';
    } catch(error){if(showErrors)toast(error.message,'error');else document.getElementById('alertStatus').textContent=`Live updates unavailable: ${error.message}`;if(!api.token)location.replace('login.html');}
    finally{loading=false;}
  }
  function escapeHtml(value){const div=document.createElement('div');div.textContent=value||'';return div.innerHTML;}
  function getLocation(){
    if(!navigator.geolocation)return Promise.reject(new Error('Geolocation is not supported by this browser.'));
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
  }
  function startWatch(){
    if(!navigator.geolocation||!activeAlert)return;
    watchingAlertId=activeAlert._id;
    document.getElementById('gpsStatus').textContent='Tracking active alert';
    watchId=navigator.geolocation.watchPosition(async position=>{
      if(!activeAlert)return;
      const alertId=activeAlert._id;
      const {latitude,longitude,accuracy}=position.coords;document.getElementById('gpsStatus').textContent=`Live · ±${Math.round(accuracy)} m`;
      try{const result=await api.request(`/alerts/${alertId}/location`,{method:'POST',body:JSON.stringify({latitude,longitude,accuracy})});if(activeAlert?._id!==alertId)return;activeAlert=result.alert;document.getElementById('latestLocation').textContent=`${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)} m)`;document.getElementById('locationTime').textContent=`Updated ${new Date().toLocaleTimeString()}`;const link=document.getElementById('mapLink');link.href=activeAlert.locationLink;link.classList.remove('hidden');}catch(error){if(error.message.includes('Resolved alerts')){await load();}else toast(error.message,'error');}
    },error=>{document.getElementById('gpsStatus').textContent=locationError(error);}, {enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  }
  function stopWatch(){if(watchId!==null&&navigator.geolocation){navigator.geolocation.clearWatch(watchId);watchId=null;}watchingAlertId=null;}
  function locationError(error){return {1:'Location permission denied by browser',2:'GPS unavailable',3:'Location request timed out'}[error.code]||'Location unavailable';}
  const sos=document.getElementById('sosButton');
  async function activate(){
    if(holding||activeAlert)return;
    holding=true;sos.classList.add('holding');document.getElementById('sosHint').textContent='Activating emergency...';
    try{const position=await getLocation();const {latitude,longitude,accuracy}=position.coords;document.getElementById('gpsStatus').textContent=`Live · ±${Math.round(accuracy)} m`;const result=await api.request('/alerts/trigger',{method:'POST',body:JSON.stringify({latitude,longitude,accuracy})});activeAlert=result.alert;toast(`Emergency activated: ${result.alert.alertId}`,'success');await load();}catch(error){toast(error.message,'error');document.getElementById('gpsStatus').textContent=error.code?locationError(error):'Unavailable';}finally{holding=false;sos.classList.remove('holding');document.getElementById('sosHint').textContent='Press and hold for 1.5 seconds';}
  }
  sos.addEventListener('pointerdown',()=>{if(activeAlert)return;sos.classList.add('holding');holdTimer=setTimeout(activate,1500);});
  ['pointerup','pointerleave','pointercancel'].forEach(name=>sos.addEventListener(name,()=>{clearTimeout(holdTimer);sos.classList.remove('holding');}));
  document.getElementById('resolveBtn').onclick=async()=>{if(!activeAlert)return;if(!confirm('Resolve this emergency? Location tracking will stop and the alert will be marked resolved.'))return;try{const result=await api.request(`/alerts/${activeAlert._id}/resolve`,{method:'PUT'});stopWatch();activeAlert=null;toast('Emergency resolved','success');await load();}catch(error){toast(error.message,'error');}};
  await load(true);
  window.setInterval(()=>{if(!document.hidden)load();},3000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
});
