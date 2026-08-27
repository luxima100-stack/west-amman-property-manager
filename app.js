/* WEST AMMAN PROPERTY MANAGER - FINAL FLAT BUILD */
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
const seedImages=[
'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82',
'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=82'
];
const DEFAULT_AREAS=['عبدون','أم أذينة','الرابية','خلدا','دير غبار','دابوق','الصويفية','وادي السير','بيادر وادي السير','أم السماق','تلاع العلي','الشميساني','جبل عمان','العبدلي','مرج الحمام','شارع مكة','الدوار الأول','الدوار الثاني','الدوار الثالث','الدوار الرابع','الدوار الخامس','الدوار السادس'];
const PERMS=[
['dashboard','لوحة التحكم'],['properties','الشقق'],['tenants','المستأجرون'],
['contracts','العقود'],['reports','التقارير'],['settings','الإعدادات'],['messages','المحادثات']
];
const state={
 user:null,token:'',properties:[],users:[],settings:{areas:DEFAULT_AREAS,alertDays:7},
 page:'home',
 filter:{q:'',area:'الكل',status:'الكل',rooms:'الكل',baths:'الكل',balcony:'الكل',minPrice:'',maxPrice:'',sort:'newest'},
 alerts:[],modalOpen:false
};
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(msg,good=true){const r=$('#toast-root');const e=document.createElement('div');e.className='toast '+(good?'good':'bad');e.textContent=msg;r.appendChild(e);setTimeout(()=>e.remove(),3200)}
async function api(url,opt={}){
 opt.headers={...(opt.headers||{}),...(state.token?{'Authorization':'Bearer '+state.token}:{})};
 const r=await fetch(url,opt); const x=await r.json().catch(()=>({}));
 if(!r.ok) throw Error(x.message||x.error||'حدث خطأ');
 return x;
}
function statusClass(s){return s==='متاحة'?'green':s==='مؤجرة'?'blue':s==='محجوزة'?'orange':'red'}
function can(p){return state.user?.role==='owner'||state.user?.permissions?.includes(p)}
async function loadPublic(){try{state.properties=await api('/api/public/properties')}catch{state.properties=[]}render()}
async function loadAdmin(){state.properties=await api('/api/properties');state.settings=await api('/api/settings');await loadAlerts();render()}
async function loadAlerts(){try{state.alerts=await api('/api/alerts')}catch{state.alerts=[]}}
function header(){
 return `<header class="topbar">
  <button class="mobile-menu icon-btn" id="menuBtn">☰</button>
  <div class="brand"><div class="brand-mark">⌂</div><div><b>عقارات غرب عمان</b><small>${state.user?'لوحة الإدارة':'العقارات المتاحة'}</small></div></div>
  <div class="top-actions">${state.user?`<button class="ghost-btn" id="logout">خروج</button>`:`<button class="ghost-btn" id="loginBtn">دخول المالك / المدير</button>`}</div>
 </header>`;
}
function filters(){
 const f=state.filter, areas=['الكل',...(state.settings.areas||DEFAULT_AREAS)];
 return `<form id="searchForm" class="filters">
  <div class="field search"><label>بحث</label><input id="q" value="${esc(f.q)}" placeholder="الكود أو الاسم أو المنطقة"></div>
  <div class="field"><label>المنطقة</label><select id="area">${areas.map(x=>`<option ${x===f.area?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
  <div class="field"><label>الحالة</label><select id="status">${['الكل','متاحة','مؤجرة','محجوزة','قريبة من الانتهاء','تحت الصيانة'].map(x=>`<option ${x===f.status?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="field"><label>الغرف</label><select id="rooms">${['الكل','1','2','3','4','5','6','7'].map(x=>`<option ${x===f.rooms?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="field"><label>الحمامات</label><select id="baths">${['الكل','1','2','3','4','5'].map(x=>`<option ${x===f.baths?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="field"><label>بلكونة</label><select id="balcony"><option value="الكل">الكل</option><option value="1" ${f.balcony==='1'?'selected':''}>نعم</option><option value="0" ${f.balcony==='0'?'selected':''}>لا</option></select></div>
  <div class="field"><label>السعر من</label><input id="minPrice" type="number" value="${esc(f.minPrice)}"></div>
  <div class="field"><label>السعر إلى</label><input id="maxPrice" type="number" value="${esc(f.maxPrice)}"></div>
  <div class="field"><label>الترتيب</label><select id="sort"><option value="newest" ${f.sort==='newest'?'selected':''}>الأحدث</option><option value="priceAsc" ${f.sort==='priceAsc'?'selected':''}>الأقل سعراً</option><option value="priceDesc" ${f.sort==='priceDesc'?'selected':''}>الأعلى سعراً</option></select></div>
  <button class="btn">🔍 بحث</button>
 </form>`;
}
function filtered(){
 let ps=[...state.properties],f=state.filter;
 if(f.q){const q=f.q.toLowerCase();ps=ps.filter(p=>`${p.name} ${p.code} ${p.area} ${p.notes||''}`.toLowerCase().includes(q))}
 if(f.area!=='الكل')ps=ps.filter(p=>p.area===f.area);
 if(f.status!=='الكل')ps=ps.filter(p=>p.status===f.status);
 if(f.rooms!=='الكل')ps=ps.filter(p=>String(p.rooms)===f.rooms);
 if(f.baths!=='الكل')ps=ps.filter(p=>String(p.baths)===f.baths);
 if(f.balcony!=='الكل')ps=ps.filter(p=>String(!!p.balcony)===(f.balcony==='1'));
 if(f.minPrice!=='')ps=ps.filter(p=>Number(p.price)>=Number(f.minPrice));
 if(f.maxPrice!=='')ps=ps.filter(p=>Number(p.price)<=Number(f.maxPrice));
 if(f.sort==='priceAsc')ps.sort((a,b)=>a.price-b.price);
 if(f.sort==='priceDesc')ps.sort((a,b)=>b.price-a.price);
 return ps;
}
function cards(ps,admin=false){
 if(!ps.length)return '<div class="empty">لا توجد شقق مطابقة.</div>';
 return `<div class="cards">${ps.map(p=>`<article class="card">
  <div class="card-media"><img src="${esc(p.images?.[0]||seedImages[0])}" alt="${esc(p.name)}" onerror="this.src='${seedImages[0]}'">
  <span class="badge ${statusClass(p.status)}">${esc(p.status)}</span><span class="photo-count">📷 ${p.images?.length||0}</span></div>
  <div class="card-body"><h3>${esc(p.name)}</h3><div class="muted">#${esc(p.code)} • ${esc(p.area)}</div>
  <div class="card-meta"><span>🛏 ${p.rooms||0}</span><span>🛁 ${p.baths||0}</span><span>📐 ${p.area_size||0}م²</span><span>💰 ${Number(p.price||0).toLocaleString('ar-JO')}</span></div>
  <div class="card-actions"><button class="ghost-btn" data-view="${p.id}">التفاصيل</button>${state.user?`<button class="btn" data-wa="${p.id}">واتساب</button>`:''}</div></div>
 </article>`).join('')}</div>`;
}
function publicHome(){
 const soon=state.properties.filter(p=>p.status==='قريبة من الانتهاء').length;
 return `${header()}<main class="content">
  <section class="hero"><div class="hero-content"><div class="eyebrow">♛ عقارات غرب عمان</div><h1>إدارة عقاراتك بسهولة واحترافية</h1><p>استعرض الشقق المتاحة وابحث بالتفاصيل التي تناسبك.</p></div></section>
  ${soon?`<div class="landing-strip danger-strip">🔴 ${soon} شقة قريبة من التوفر</div>`:''}
  <section class="panel landing-search"><div class="panel-title"><div><h2>🔎 البحث عن شقة</h2><span class="muted">اختر المعايير ثم اضغط بحث</span></div></div>${filters()}
  <div class="result-line muted">${filtered().length} نتيجة</div>${cards(filtered())}</section>
 </main>`;
}
function sidebar(){
 const items=[['dashboard','⌂','الرئيسية'],['properties','▦','الشقق'],['tenants','♙','المستأجرون'],['contracts','▤','العقود'],['reports','▥','التقارير'],['settings','⚙','الإعدادات'],['messages','💬','المحادثات']];
 if(state.user.role==='owner')items.push(['admins','♛','المالك والمديرين']);
 return `<aside class="sidebar" id="sidebar"><div class="side-title">لوحة التحكم</div>${items.filter(x=>x[0]==='dashboard'||can(x[0])||x[0]==='admins'&&state.user.role==='owner').map(x=>`<button class="nav-item ${state.page===x[0]?'active':''}" data-page="${x[0]}"><span>${x[1]}</span>${x[2]}</button>`).join('')}
 <div class="side-footer"><b>${esc(state.user.name)}</b><br><small>${state.user.role==='owner'?'المالك':'مدير النظام'}</small></div></aside>`;
}
function adminShell(){return `${header()}<div class="layout">${sidebar()}<main class="content">${pageContent()}</main></div>`}
function adminDashboard(){
 const a=state.properties;
 return `<section><div class="hero"><div class="hero-content"><div class="eyebrow">♛ لوحة الإدارة</div><h1>مرحباً ${esc(state.user.name)}</h1><p>جميع بيانات العقارات محفوظة في قاعدة البيانات.</p></div></div>
 <div class="stats"><div class="stat green"><div>متاحة</div><b>${a.filter(x=>x.status==='متاحة').length}</b></div><div class="stat blue"><div>مؤجرة</div><b>${a.filter(x=>x.status==='مؤجرة').length}</b></div><div class="stat orange"><div>محجوزة</div><b>${a.filter(x=>x.status==='محجوزة').length}</b></div><div class="stat red"><div>تنبيهات قريبة</div><b>${state.alerts.length}</b></div></div>
 ${state.alerts.length?`<div class="panel alert-panel"><div class="panel-title"><h2>🔴 شقق ستصبح متاحة قريباً</h2></div>${state.alerts.map(x=>`<div class="alert-row"><b>#${esc(x.code)}</b><span>${esc(x.name)}</span><span>${esc(x.availability_date)}</span><strong>${x.days_until_available} يوم</strong></div>`).join('')}</div>`:''}
 </section>`;
}
function adminProperties(){return `<section><div class="panel"><div class="panel-title"><div><h2>إدارة الشقق</h2><div class="muted">الإضافة والتعديل والحذف</div></div><button class="btn" id="newProperty">+ إضافة شقة</button></div>${filters()}${cards(filtered(),true)}</div></section>`}
async function adminsPage(){
 let users=[];try{users=await api('/api/users')}catch(e){return `<div class="panel"><h2>المالك والمديرين</h2><p>${esc(e.message)}</p></div>`}
 return `<section><div class="panel"><div class="panel-title"><div><h2>المالك والمديرين</h2><div class="muted">إدارة الحسابات والصلاحيات وكلمات المرور</div></div>${state.user.role==='owner'?'<button class="btn" id="newUser">+ إضافة مدير</button>':''}</div>
 <div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>إجراء</th></tr></thead><tbody>${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role==='owner'?'المالك':'مدير'}</td><td>${state.user.role==='owner'?`<button class="ghost-btn" data-pass="${u.id}">تغيير كلمة السر</button>`:''}</td></tr>`).join('')}</tbody></table></div></div></section>`;
}
function settingsPage(){
 const areas=state.settings.areas||[];
 return `<section><div class="panel"><div class="panel-title"><div><h2>الإعدادات</h2><div class="muted">إعدادات التطبيق والمناطق والتنبيهات</div></div></div>
 <div class="settings-grid">
  <div class="setting-card"><h3>المناطق</h3><div class="area-add"><input id="newArea" placeholder="اسم المنطقة"><button class="btn" id="addArea">إضافة</button></div><div class="area-chips">${areas.map(a=>`<span class="area-chip">${esc(a)}<button data-delarea="${esc(a)}">×</button></span>`).join('')}</div></div>
  <div class="setting-card"><h3>تنبيه قرب التوفر</h3><label>عدد الأيام</label><input id="alertDays" type="number" min="0" value="${Number(state.settings.alertDays||7)}"><button class="btn" id="saveSettings">حفظ الإعدادات</button></div>
  <div class="setting-card"><h3>نسخ احتياطي</h3><p class="muted">تنزيل نسخة JSON من بيانات التطبيق.</p><button class="btn" id="backupBtn">تنزيل النسخة الاحتياطية</button></div>
 </div></div></section>`;
}
async function entityPage(kind,title){
 const endpoint=kind==='tenant'?'/api/tenants':'/api/contracts';
 let rows=[];try{rows=await api(endpoint)}catch(e){return `<section><div class="panel"><h2>${title}</h2><p>${esc(e.message)}</p></div></section>`}
 const isTenant=kind==='tenant';
 return `<section><div class="panel"><div class="panel-title"><div><h2>${title}</h2><div class="muted">إضافة وتعديل وحذف البيانات</div></div><button class="btn" id="newEntity">+ إضافة</button></div>
 <div class="table-wrap"><table class="table"><thead><tr>${isTenant?'<th>الاسم</th><th>الهاتف</th><th>الشقة</th><th>ملاحظات</th>':'<th>الشقة</th><th>المستأجر</th><th>البداية</th><th>النهاية</th><th>القيمة</th>'}<th>إجراء</th></tr></thead><tbody>
 ${rows.map(r=>isTenant?`<tr><td>${esc(r.name)}</td><td>${esc(r.phone||'')}</td><td>${esc(r.property_code||'')}</td><td>${esc(r.notes||'')}</td><td><button class="ghost-btn" data-delentity="${r.id}">حذف</button></td></tr>`:`<tr><td>${esc(r.property_code||'')}</td><td>${esc(r.tenant_name||'')}</td><td>${esc(r.start_date||'')}</td><td>${esc(r.end_date||'')}</td><td>${esc(r.amount||0)}</td><td><button class="ghost-btn" data-delentity="${r.id}">حذف</button></td></tr>`).join('')}
 </tbody></table></div></div></section>`;
}

function pageContent(){
 if(state.page==='dashboard')return adminDashboard();
 if(state.page==='properties')return adminProperties();
 if(state.page==='admins')return adminsPage();
 if(state.page==='settings')return settingsPage();
 if(state.page==='tenants')return '<div id="asyncPage"></div>';
 if(state.page==='contracts')return '<div id="asyncPage"></div>';
 if(state.page==='reports')return `<section><div class="panel"><h2>التقارير والإحصائيات</h2><div class="stats"><div class="stat"><div>إجمالي الشقق</div><b>${state.properties.length}</b></div><div class="stat green"><div>متاحة</div><b>${state.properties.filter(x=>x.status==='متاحة').length}</b></div><div class="stat blue"><div>مؤجرة</div><b>${state.properties.filter(x=>x.status==='مؤجرة').length}</b></div></div></div></section>`;
 if(state.page==='messages')return `<section><div class="panel"><h2>المحادثات</h2><div class="chat"><div class="empty">ابدأ المحادثة الداخلية بين المالك والمدير.</div><div class="chat-compose"><input id="msgInput" placeholder="اكتب رسالة"><button class="btn" id="sendMsg">إرسال</button></div></div></div></section>`;
 return adminDashboard();
}
function modal(html){
 $('#modal-root')?.remove();const r=document.createElement('div');r.id='modal-root';r.innerHTML=`<div class="modal"><div class="modal-box">${html}</div></div>`;document.body.appendChild(r);
 r.querySelectorAll('.closeModal').forEach(b=>b.onclick=()=>r.remove());r.querySelector('.modal')?.addEventListener('click',e=>{if(e.target.classList.contains('modal'))r.remove()});
}
function details(p){
 const text=`🏠 عقارات غرب عمان\n🔑 كود الشقة: ${p.code}\n📍 المنطقة: ${p.area}\n🛏️ الغرف: ${p.rooms||0}\n🛁 الحمامات: ${p.baths||0}\n🌿 بلكونة: ${p.balcony?'نعم':'لا'}\n📐 المساحة: ${p.area_size||0} م²\n💰 السعر: ${p.price||0} دينار\n📅 التوفر: ${p.availability_date||'-'}\n📌 الحالة: ${p.status}`;
 modal(`<div class="modal-head"><h2>${esc(p.name)}</h2><button class="icon-btn closeModal">✕</button></div><div class="muted">#${esc(p.code)} • ${esc(p.area)}</div>
 <div class="details-gallery">${(p.images||[]).map(x=>`<img src="${esc(x)}" onerror="this.style.display='none'">`).join('')}</div>
 ${p.video_url?`<video controls src="${esc(p.video_url)}"></video>`:''}<div class="detail-grid">
 ${[['الكود',p.code],['المنطقة',p.area],['الغرف',p.rooms||0],['الحمامات',p.baths||0],['البلكونة',p.balcony?'نعم':'لا'],['الطابق',p.floor??'-'],['المساحة',(p.area_size||0)+' م²'],['السعر',Number(p.price||0).toLocaleString('ar-JO')+' دينار'],['الحالة',p.status]].map(x=>`<div><b>${x[0]}</b><span>${esc(x[1])}</span></div>`).join('')}</div>
 <div class="copy-box"><label>التفاصيل الكاملة</label><textarea id="copyText" rows="8">${esc(text)}</textarea><button class="btn" id="copyDetails">نسخ التفاصيل</button></div>
 <div class="btn-row"><button class="btn" id="shareWa">واتساب</button>${state.user?`<button class="ghost-btn" id="editProperty">تعديل</button><button class="btn danger" id="deleteProperty">حذف</button>`:''}</div>`);
 $('#copyDetails').onclick=()=>navigator.clipboard?.writeText(text).then(()=>toast('تم نسخ التفاصيل'));
 $('#shareWa').onclick=()=>shareWhatsApp(p);
 $('#editProperty')?.addEventListener('click',()=>propertyForm(p));
 $('#deleteProperty')?.addEventListener('click',async()=>{if(confirm('حذف الشقة نهائياً؟')){await api('/api/properties/'+p.id,{method:'DELETE'});$('#modal-root')?.remove();await loadAdmin();toast('تم حذف الشقة')}});
}
function shareWhatsApp(p){
 const text=`🏠 عقارات غرب عمان\n${p.name} #${p.code}\n📍 ${p.area}\n🛏 ${p.rooms||0} غرف | 🛁 ${p.baths||0} حمامات\n📐 ${p.area_size||0} م²\n💰 ${p.price||0} دينار\n📌 ${p.status}`;
 const urls=(p.images||[]).slice(0,10);
 const body=encodeURIComponent(text+(urls.length?'\n\n'+urls.join('\n'):''));window.open('https://wa.me/?text='+body,'_blank');
}
async function uploadImages(files){
 const selected=[...files].slice(0,10);
 for(const f of selected){if(f.size>6*1024*1024)throw Error('حجم الصورة يجب ألا يتجاوز 6MB.');}
 const fd=new FormData();selected.forEach(f=>fd.append('images',f));
 const d=await api('/api/upload',{method:'POST',body:fd});return d.urls||[];
}
function propertyForm(p=null){
 let imgs=[...(p?.images||[])];
 modal(`<div class="modal-head"><h2>${p?'تعديل الشقة':'إضافة شقة'}</h2><button class="icon-btn closeModal">✕</button></div>
 <form id="propertyForm" class="form-grid">
 <div class="field"><label>كود الشقة</label><input id="code" required value="${esc(p?.code||'')}"></div>
 <div class="field"><label>اسم الشقة</label><input id="name" required value="${esc(p?.name||'')}"></div>
 <div class="field"><label>المنطقة</label><select id="area">${(state.settings.areas||DEFAULT_AREAS).map(x=>`<option ${x===p?.area?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
 <div class="field"><label>الحالة</label><select id="status">${['متاحة','مؤجرة','محجوزة','قريبة من الانتهاء','تحت الصيانة'].map(x=>`<option ${x===(p?.status||'متاحة')?'selected':''}>${x}</option>`).join('')}</select></div>
 <div class="field"><label>عدد الغرف</label><input id="rooms" type="number" min="0" value="${p?.rooms||0}"></div>
 <div class="field"><label>عدد الحمامات</label><input id="baths" type="number" min="0" value="${p?.baths||0}"></div>
 <div class="field"><label>بلكونة</label><select id="balcony"><option value="1" ${p?.balcony?'selected':''}>نعم</option><option value="0" ${!p?.balcony?'selected':''}>لا</option></select></div>
 <div class="field"><label>الطابق</label><input id="floor" type="number" value="${p?.floor??''}"></div>
 <div class="field"><label>المساحة م²</label><input id="areaSize" type="number" value="${p?.area_size??''}"></div>
 <div class="field"><label>السعر الشهري</label><input id="price" type="number" value="${p?.price??''}"></div>
 <div class="field"><label>تاريخ التوفر</label><input id="availability" type="date" value="${esc(p?.availability_date||'')}"></div>
 <div class="field"><label>رابط الفيديو</label><input id="video" value="${esc(p?.video_url||'')}"></div>
 <div class="field full"><label>ملاحظات</label><textarea id="notes">${esc(p?.notes||'')}</textarea></div>
 <div class="field full"><label>الصور JPG / PNG / WEBP — حتى 10 صور</label><input id="images" type="file" accept="image/jpeg,image/png,image/webp" multiple>
 <div class="photos" id="previews">${imgs.map((x,i)=>`<div class="photo"><img src="${esc(x)}"><button type="button" data-removeimg="${i}">×</button></div>`).join('')}</div></div>
 <div class="full btn-row"><button class="btn" id="saveProperty">حفظ الشقة</button><button type="button" class="ghost-btn closeModal">إلغاء</button></div></form>`);
 const refresh=()=>{$('#previews').innerHTML=imgs.map((x,i)=>`<div class="photo"><img src="${esc(x)}"><button type="button" data-removeimg="${i}">×</button></div>`).join('');$$('[data-removeimg]').forEach(b=>b.onclick=()=>{imgs.splice(Number(b.dataset.removeimg),1);refresh()})};refresh();
 $('#images').onchange=async e=>{try{const newUrls=await uploadImages(e.target.files);imgs.push(...newUrls);refresh();toast('تم رفع الصور وحفظها مؤقتاً')}catch(err){toast(err.message,false)}e.target.value=''};
 $('#propertyForm').onsubmit=async e=>{e.preventDefault();const btn=$('#saveProperty');btn.disabled=true;btn.textContent='جارٍ الحفظ...';try{
  const body={code:$('#code').value.trim(),name:$('#name').value.trim(),area:$('#area').value,status:$('#status').value,rooms:Number($('#rooms').value||0),baths:Number($('#baths').value||0),balcony:Number($('#balcony').value||0),floor:$('#floor').value===''?null:Number($('#floor').value),areaSize:$('#areaSize').value===''?null:Number($('#areaSize').value),price:Number($('#price').value||0),availabilityDate:$('#availability').value||null,video:$('#video').value.trim(),notes:$('#notes').value.trim(),images:imgs.slice(0,10)};
  const saved=await api(p?'/api/properties/'+p.id:'/api/properties',{method:p?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});$('#modal-root')?.remove();await loadAdmin();toast('تم حفظ الشقة والصور بنجاح')}catch(err){toast(err.message,false)}finally{btn.disabled=false;btn.textContent='حفظ الشقة'}};
}
function userForm(){
 modal(`<div class="modal-head"><h2>إضافة مدير</h2><button class="icon-btn closeModal">✕</button></div><form id="userForm" class="form-grid">
 <div class="field"><label>الاسم</label><input id="un" required></div><div class="field"><label>البريد الإلكتروني</label><input id="ue" type="email" required></div><div class="field"><label>كلمة المرور</label><input id="up" type="password" required minlength="6"></div>
 <div class="field full"><label>الصلاحيات</label><div class="checks">${PERMS.map(x=>`<label><input type="checkbox" value="${x[0]}" checked> ${x[1]}</label>`).join('')}</div></div>
 <div class="full btn-row"><button class="btn">إنشاء المدير</button><button type="button" class="ghost-btn closeModal">إلغاء</button></div></form>`);
 $('#userForm').onsubmit=async e=>{e.preventDefault();try{const permissions=$$('.checks input:checked').map(x=>x.value);await api('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('#un').value.trim(),email:$('#ue').value.trim(),password:$('#up').value,permissions})});$('#modal-root')?.remove();render();toast('تم إنشاء المدير')}catch(err){toast(err.message,false)}};
}
function passwordForm(id,name){
 modal(`<div class="modal-head"><h2>تغيير كلمة السر</h2><button class="icon-btn closeModal">✕</button></div><p class="muted">${esc(name)}</p><form id="passForm"><div class="field"><label>كلمة المرور الجديدة</label><input id="newPass" type="password" minlength="6" required></div><div class="btn-row"><button class="btn">حفظ كلمة السر</button><button type="button" class="ghost-btn closeModal">إلغاء</button></div></form></div>`);
 $('#passForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/users/'+id+'/password',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#newPass').value})});$('#modal-root')?.remove();toast('تم تغيير كلمة السر بنجاح')}catch(err){toast(err.message,false)}};
}
function bind(){
 $('#loginBtn')?.addEventListener('click',()=>{state.page='login';render()});
 $('#menuBtn')?.addEventListener('click',()=>$('#sidebar')?.classList.toggle('open'));
 $('#logout')?.addEventListener('click',()=>{state.user=null;state.token='';localStorage.removeItem('wam_token');localStorage.removeItem('wam_user');loadPublic()});
 $('#backHome')?.addEventListener('click',loadPublic);
 $('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();try{const d=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#email').value.trim(),password:$('#password').value})});state.user=d.user;state.token=d.token;localStorage.setItem('wam_token',d.token);localStorage.setItem('wam_user',JSON.stringify(d.user));state.page='dashboard';await loadAdmin()}catch(err){toast(err.message,false)}});
 $$('[data-page]').forEach(b=>b.onclick=async()=>{state.page=b.dataset.page;$('#sidebar')?.classList.remove('open');if(state.page==='admins')await renderAsync();else render()});
 $$('[data-view]').forEach(b=>b.onclick=()=>{const p=state.properties.find(x=>String(x.id)===String(b.dataset.view));if(p)details(p)});
 $$('[data-wa]').forEach(b=>b.onclick=()=>{const p=state.properties.find(x=>String(x.id)===String(b.dataset.wa));if(p)shareWhatsApp(p)});
 $('#newProperty')?.addEventListener('click',()=>propertyForm());
 $('#newUser')?.addEventListener('click',userForm);
 $$('[data-pass]').forEach(b=>b.onclick=()=>{const u=state.users.find(x=>String(x.id)===String(b.dataset.pass));passwordForm(b.dataset.pass,u?.name||'')});
 $('#searchForm')?.addEventListener('submit',async e=>{e.preventDefault();state.filter={q:$('#q').value.trim(),area:$('#area').value,status:$('#status').value,rooms:$('#rooms').value,baths:$('#baths').value,balcony:$('#balcony').value,minPrice:$('#minPrice').value,maxPrice:$('#maxPrice').value,sort:$('#sort').value};state.user?await loadAdmin():await loadPublic()});
 $('#addArea')?.addEventListener('click',async()=>{const v=$('#newArea').value.trim();if(!v)return;try{await api('/api/areas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:v})});state.settings=await api('/api/settings');render();toast('تمت إضافة المنطقة')}catch(e){toast(e.message,false)}});
 $$('[data-delarea]').forEach(b=>b.onclick=async()=>{try{await api('/api/areas?name='+encodeURIComponent(b.dataset.delarea),{method:'DELETE'});state.settings=await api('/api/settings');render();toast('تم حذف المنطقة')}catch(e){toast(e.message,false)}});
 $('#saveSettings')?.addEventListener('click',async()=>{try{await api('/api/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({alertDays:Number($('#alertDays').value||7)})});state.settings=await api('/api/settings');await loadAlerts();render();toast('تم حفظ الإعدادات')}catch(e){toast(e.message,false)}});
 $('#backupBtn')?.addEventListener('click',async()=>{try{const d=await api('/api/backup');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));a.download='west-amman-backup.json';a.click();URL.revokeObjectURL(a.href)}catch(e){toast(e.message,false)}});
 $('#sendMsg')?.addEventListener('click',async()=>{const v=$('#msgInput').value.trim();if(!v)return;try{await api('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:v})});$('#msgInput').value='';toast('تم إرسال الرسالة')}catch(e){toast(e.message,false)}});
}
async function renderAsync(){
 if(state.page==='admins'){try{state.users=await api('/api/users')}catch{state.users=[]}}
 if(state.page==='tenants'||state.page==='contracts'){
   const kind=state.page==='tenants'?'tenant':'contract';
   const title=state.page==='tenants'?'المستأجرون':'العقود';
   document.querySelector('#app').innerHTML=state.user?adminShell():publicHome();
   const holder=$('#asyncPage'); if(holder){holder.innerHTML=await entityPage(kind,title); bindEntity(kind);}
   return;
 }
 render();
}
function bindEntity(kind){
 $('#newEntity')?.addEventListener('click',()=>entityForm(kind));
 $$('[data-delentity]').forEach(b=>b.onclick=async()=>{if(confirm('حذف السجل؟')){try{await api((kind==='tenant'?'/api/tenants/':'/api/contracts/')+b.dataset.delentity,{method:'DELETE'});await renderAsync();toast('تم الحذف')}catch(e){toast(e.message,false)}}});
}
function entityForm(kind){
 const tenant=kind==='tenant';
 modal(`<div class="modal-head"><h2>${tenant?'إضافة مستأجر':'إضافة عقد'}</h2><button class="icon-btn closeModal">✕</button></div>
 <form id="entityForm" class="form-grid">
 ${tenant?`<div class="field"><label>اسم المستأجر</label><input id="ename" required></div><div class="field"><label>الهاتف</label><input id="ephone"></div><div class="field"><label>كود الشقة</label><input id="ecode"></div><div class="field full"><label>ملاحظات</label><textarea id="enotes"></textarea></div>`
 :`<div class="field"><label>كود الشقة</label><input id="ecode" required></div><div class="field"><label>اسم المستأجر</label><input id="ename" required></div><div class="field"><label>تاريخ البداية</label><input id="estart" type="date"></div><div class="field"><label>تاريخ النهاية</label><input id="eend" type="date"></div><div class="field"><label>القيمة</label><input id="eamount" type="number"></div>`}
 <div class="full btn-row"><button class="btn">حفظ</button><button type="button" class="ghost-btn closeModal">إلغاء</button></div></form>`);
 $('#entityForm').onsubmit=async e=>{e.preventDefault();try{
  const body=tenant?{name:$('#ename').value.trim(),phone:$('#ephone').value.trim(),property_code:$('#ecode').value.trim(),notes:$('#enotes').value.trim()}:{property_code:$('#ecode').value.trim(),tenant_name:$('#ename').value.trim(),start_date:$('#estart').value||null,end_date:$('#eend').value||null,amount:Number($('#eamount').value||0)};
  await api(tenant?'/api/tenants':'/api/contracts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  $('#modal-root')?.remove();await renderAsync();toast('تم الحفظ بنجاح');
 }catch(err){toast(err.message,false)}};
}
function loginView(){return `<div class="login"><div class="login-box"><div class="brand"><div class="brand-mark">⌂</div><div><b>عقارات غرب عمان</b><small>دخول آمن</small></div></div><h1>تسجيل الدخول</h1><p class="login-note">الدخول متاح للمالك والمدير فقط</p><form id="loginForm" class="login-form"><div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" required></div><div class="field"><label>كلمة المرور</label><input id="password" type="password" required></div><button class="btn">دخول إلى لوحة التحكم</button><button type="button" class="ghost-btn" id="backHome">العودة للموقع</button></form></div></div>`}
function render(){if(state.page==='login'){document.querySelector('#app').innerHTML=loginView();bind();return}document.querySelector('#app').innerHTML=state.user?adminShell():publicHome();bind()}
(async()=>{try{const t=localStorage.getItem('wam_token'),u=JSON.parse(localStorage.getItem('wam_user')||'null');if(t&&u){state.token=t;state.user=u;state.page='dashboard';await loadAdmin();return}}catch{}await loadPublic()})();
