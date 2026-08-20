from pathlib import Path
import re, json
base=Path('/mnt/data/project_new')
idx=base/'index.html'
srv=base/'server.js'
manifest=base/'manifest.json'
sw=base/'sw.js'

# manifest: Web Share Target for receiving external map links
m=json.loads(manifest.read_text())
m['start_url']='/'
m['share_target']={
    'action':'/share-location',
    'method':'GET',
    'enctype':'application/x-www-form-urlencoded',
    'params':{'title':'title','text':'text','url':'url'}
}
manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')

# service worker bump
sw.write_text(sw.read_text().replace("west-amman-v5-43-2","west-amman-v5-44-0"))

s=srv.read_text()
# Add share target route before root route, preserving query values safely.
needle='app.get("/",(req,res)=>{'
route='''// v5.44 Web Share Target: receive a Google Maps/location link shared from another app.\napp.get('/share-location',(req,res)=>{\n  const raw=String(req.query.url||req.query.text||'').trim();\n  const title=String(req.query.title||'').trim();\n  const q=new URLSearchParams();\n  if(raw) q.set('share_url',raw);\n  if(title) q.set('share_title',title);\n  res.redirect('/'+(q.toString()?('?'+q.toString()):''));\n});\n\n'''
if route not in s:
    s=s.replace(needle,route+needle,1)
# health version
s=s.replace('version:"5.43.2"','version:"5.44.0"')
srv.write_text(s)

h=idx.read_text()
# Change alert label to explicit user-defined days
h=h.replace('تنبيه قبل التوفر بعدد الأيام','التنبيه قبل موعد التوفر بـ (عدد الأيام)')

# Replace authoritative aForm/saveA to remove manual location fields and save only location_url from pending share.
start=h.find('  window.aForm=function(a={}){')
end=h.find('  window.shareApartmentDetails=', start)
if start==-1 or end==-1:
    raise SystemExit('authoritative block not found')
newblock=r'''  window.aForm=function(a={}){const rt=a.rental_type||'شهري';return `<div class="formgrid"><div class="field"><label>كود الشقة</label><input id="acode" value="${esc(a.code||a.number||'')}"></div><div class="field"><label>رقم الشقة</label><input id="an" value="${esc(a.number||'')}"></div><div class="field"><label>المنطقة</label><select id="aa">${D.areas.map(x=>`<option value="${x.id}" ${(x.id===a.area_id||x.name===a.area)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>الحالة</label><select id="ast">${statuses.map(s=>`<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>نوع الإيجار</label><select id="artype"><option ${rt==='يومي'?'selected':''}>يومي</option><option ${rt==='شهري'?'selected':''}>شهري</option><option ${rt==='سنوي'?'selected':''}>سنوي</option></select></div><div class="field"><label>المساحة م²</label><input id="az" type="number" value="${a.size_m2||0}"></div><div class="field"><label>الغرف</label><input id="ro" type="number" value="${a.rooms||0}"></div><div class="field"><label>الحمامات</label><input id="ba" type="number" value="${a.baths||0}"></div><div class="field"><label>الصالات</label><input id="lr" type="number" value="${a.living_rooms||0}"></div><div class="field"><label>البلكونات</label><input id="bal" type="number" value="${a.balconies||0}"></div><div class="field"><label>الطابق</label><input id="fl" type="number" value="${a.floor||1}"></div><div class="field"><label>الإيجار اليومي</label><input id="rd" type="number" value="${a.daily_rent||0}"></div><div class="field"><label>الإيجار الشهري</label><input id="rm" type="number" value="${a.monthly_rent||a.rent||0}"></div><div class="field"><label>الإيجار السنوي</label><input id="ry" type="number" value="${a.annual_rent||0}"></div><div class="field"><label>موعد التوفر</label><input id="avdate" type="date" value="${esc(a.available_date||'')}"></div><div class="field"><label>التنبيه قبل موعد التوفر بـ (عدد الأيام)</label><input id="avdays" type="number" min="0" max="365" value="${a.availability_alert_days||0}"></div><div class="field full"><label><input id="aven" type="checkbox" ${a.availability_alert_enabled?'checked':''}> تفعيل إشعار قرب التوفر + النغمة</label></div>${a.location_url?`<div class="notice field full">📍 تم حفظ موقع الشقة من المشاركة الخارجية. <a href="${esc(a.location_url)}" target="_blank" rel="noopener">فتح الموقع</a></div>`:'<div class="notice field full">📍 موقع الشقة يُضاف فقط من خلال زر «استلام موقع من المشاركة» بعد مشاركة رابط الموقع من Google Maps أو أي تطبيق خرائط.</div>'}<div class="field full"><label>ملاحظات</label><textarea id="no">${esc(a.notes||'')}</textarea></div></div>`};
  window.saveA=async function(id){try{const monthly=+($('rm')?.value||0),old=D.apartments.find(x=>x.id===id)||{};const b={number:$('an').value,code:$('acode').value||$('an').value,area_id:+$('aa').value,status:$('ast').value,rent:monthly,size_m2:+$('az').value,rooms:+$('ro').value,baths:+$('ba').value,kitchen:1,floor:+$('fl').value,notes:$('no').value,rental_type:$('artype').value,daily_rent:+$('rd').value,monthly_rent:monthly,annual_rent:+$('ry').value,available_date:$('avdate').value||null,living_rooms:+$('lr').value,salons:0,balconies:+$('bal').value,availability_alert_days:+$('avdays').value||0,availability_alert_enabled:$('aven').checked,latitude:old.latitude||null,longitude:old.longitude||null,location_url:old.location_url||'',location_label:old.location_label||''};await api(id?'/api/apartments/'+id:'/api/apartments',{method:id?'PUT':'POST',body:JSON.stringify(b)});closeM();await load();finalToast('تم حفظ بيانات الشقة') }catch(e){alert(e.message)}};
'''
h=h[:start]+newblock+h[end:]

# Add location sharing / notification script immediately before closing body.
insert_marker='</body>\n</html>'
script=r'''
<script id="v544-location-alerts">
(function(){
  // ---------- External location sharing ----------
  function extractSharedUrl(){
    const qs=new URLSearchParams(location.search);
    let raw=qs.get('share_url')||qs.get('url')||qs.get('text')||'';
    try{raw=decodeURIComponent(raw)}catch{}
    const m=String(raw).match(/https?:\/\/[^\s]+/i);
    return m?m[0]:String(raw).trim();
  }
  const incoming=extractSharedUrl();
  if(incoming){
    localStorage.setItem('wa_pending_location_url',incoming);
    localStorage.setItem('wa_pending_location_title',new URLSearchParams(location.search).get('share_title')||'');
    try{history.replaceState({},'',location.pathname)}catch{}
  }
  window.pendingSharedLocation=()=>localStorage.getItem('wa_pending_location_url')||'';

  function locationShareBox(){
    const url=window.pendingSharedLocation();
    if(!url){finalToast('لا يوجد رابط موقع مستلم حالياً');return}
    const opts=(D?.apartments||[]).map(a=>`<option value="${a.id}">شقة ${esc(a.number)} — ${esc(a.area||'')}</option>`).join('');
    modal(`<div class="modalhead"><h3>📍 استلام موقع من المشاركة</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div>
      <div class="notice" style="background:#f7f0e3;border:1px solid #d8bf82">تم استلام رابط موقع من تطبيق الخرائط. اختر الشقة التي تريد حفظ الموقع لها.</div>
      <div class="field"><label>الشقة</label><select id="sharedLocA">${opts||'<option value="">لا توجد شقق</option>'}</select></div>
      <div class="field"><label>رابط الموقع المستلم</label><input id="sharedLocUrl" value="${esc(url)}" readonly></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" onclick="saveSharedLocation()">💾 حفظ الموقع للشقة</button><button class="btn ghost" onclick="window.open('${esc(url)}','_blank')">فتح الموقع</button></div>`);
  }
  window.saveSharedLocation=async function(){
    const id=Number($('sharedLocA')?.value||0),url=$('sharedLocUrl')?.value||'';
    if(!id||!url){finalToast('اختر الشقة أولاً');return}
    try{
      const a=D.apartments.find(x=>x.id===id); if(!a)throw Error('الشقة غير موجودة');
      const b={...a,location_url:url,location_label:'موقع مستلم من مشاركة خارجية'};
      delete b.id;delete b.area;delete b.created_at;
      await api('/api/apartments/'+id,{method:'PUT',body:JSON.stringify(b)});
      localStorage.removeItem('wa_pending_location_url');localStorage.removeItem('wa_pending_location_title');
      closeM();await load();finalToast('تم حفظ موقع الشقة من المشاركة الخارجية 📍');
    }catch(e){alert(e.message)}
  };
  window.receiveLocationShare=locationShareBox;

  // ---------- Elegant availability notification ----------
  window.finalSoundOn=localStorage.getItem('wa_final_sound')==='1';
  window.playFinalTone=function(){if(!window.finalSoundOn)return;try{const C=window.AudioContext||window.webkitAudioContext,ctx=new C();const now=ctx.currentTime;[659.25,783.99,987.77].forEach((freq,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.0001,now+i*.11);g.gain.exponentialRampToValueAtTime(.045,now+i*.11+.025);g.gain.exponentialRampToValueAtTime(.0001,now+i*.11+.28);o.connect(g);g.connect(ctx.destination);o.start(now+i*.11);o.stop(now+i*.11+.3)});}catch{}};
  window.enableAvailabilityNotifications=async function(){
    window.finalSoundOn=true;localStorage.setItem('wa_final_sound','1');
    if('Notification' in window && Notification.permission==='default'){try{await Notification.requestPermission()}catch{}}
    playFinalTone();finalToast(Notification?.permission==='granted'?'تم تفعيل الإشعارات والنغمة الراقية 🔔':'تم تفعيل النغمة. اسمح بالإشعارات من إعدادات المتصفح.');
  };
  window.toggleFinalSound=function(){window.finalSoundOn=!window.finalSoundOn;localStorage.setItem('wa_final_sound',window.finalSoundOn?'1':'0');if(window.finalSoundOn)playFinalTone();finalToast(window.finalSoundOn?'تم تشغيل نغمة الإشعارات':'تم إيقاف نغمة الإشعارات')};
  window.showAvailabilityNotification=async function(a){
    const key='wa_alerted_'+a.id+'_'+String(a.available_date||'');
    if(localStorage.getItem(key))return;
    localStorage.setItem(key,'1');
    playFinalTone();
    if('Notification' in window && Notification.permission==='granted'){
      try{new Notification('🔔 قرب توفر شقة '+a.number,{body:`متبقي ${a.days_until_available} يوم على موعد التوفر`,icon:'/hero-realestate.svg',tag:'wa-'+a.id})}catch{}
    }
  };
  let alertTimer=null;
  window.checkAvailabilityAlerts=async function(){
    if(!token||!me||!['owner','admin'].includes(me.role))return;
    try{const j=await api('/api/availability-alerts',{cache:'no-store'});const alerts=j.alerts||[];for(const a of alerts)await showAvailabilityNotification(a);window.__availabilityAlerts=alerts;}catch{}
  };
  window.startAvailabilityWatcher=function(){if(alertTimer)clearInterval(alertTimer);checkAvailabilityAlerts();alertTimer=setInterval(checkAvailabilityAlerts,5*60*1000)};

  // Add a premium control to the apartments header without changing the existing layout.
  const oldApartments=window.apartments;
  window.apartments=function(){
    const html=oldApartments();
    return html.replace('<h3>إدارة العقارات</h3>',`<div><h3>إدارة العقارات</h3><small class="muted">الموقع يُستلم من المشاركة الخارجية</small></div>`)
      .replace('<button class="btn primary" onclick="addA()">＋ إضافة شقة</button>',`<div style="display:flex;gap:7px;flex-wrap:wrap">${me.role!=="user"?'<button class="btn primary" onclick="addA()">＋ إضافة شقة</button>':''}<button class="btn ghost" onclick="receiveLocationShare()">📍 استلام موقع من المشاركة</button></div>`);
  };

  const oldHome=window.home;
  window.home=function(){
    let html=oldHome();
    const n=Number(D?.stats?.soon||0);
    const control=`<div class="panel v544-notify-panel"><div class="head"><div><h3>🔔 تنبيهات قرب التوفر</h3><span class="muted">حدد لكل شقة عدد الأيام قبل موعد التوفر، وسيصلك إشعار مع نغمة راقية.</span></div><button class="btn primary" onclick="enableAvailabilityNotifications()">تفعيل الإشعارات والنغمة</button></div>${n?`<div class="notice" style="border:1px solid #c62828;background:#fff0f0;color:#8e1b1b;font-weight:800">🔴 يوجد ${n} شقة قريبة من التوفر. سيتم التنبيه حسب عدد الأيام الذي حددته لكل شقة.</div>`:'<div class="notice">لا توجد حالياً شقق ضمن فترة التنبيه المحددة.</div>'}</div>`;
    return html+control;
  };

  // If the app was opened through the Android share menu, show the receiver after login/data load.
  const oldLoad=window.load;
  window.load=async function(){await oldLoad();startAvailabilityWatcher();if(window.pendingSharedLocation()&&token&&me)setTimeout(()=>receiveLocationShare(),350)};
  // Ensure watcher starts on first authenticated render even if load was already executed before this patch.
  if(token&&me){startAvailabilityWatcher();if(window.pendingSharedLocation())setTimeout(()=>receiveLocationShare(),500)}
})();
</script>
<style id="v544-location-notify-css">
.v544-notify-panel{background:linear-gradient(145deg,#fffdf8,#f7f0e3);border:1px solid #d8bf82!important}.v544-notify-panel h3{color:#8d6920}.final-loc-box{display:none!important}.final-loc-actions{display:none!important}
@media(max-width:600px){.v544-notify-panel .head{align-items:stretch}.v544-notify-panel .head button{width:100%}}
</style>
'''
if 'id="v544-location-alerts"' not in h:
    h=h.replace(insert_marker,script+insert_marker)

idx.write_text(h)
