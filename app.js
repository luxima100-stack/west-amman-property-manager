const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];

const AREAS=["الكل","عبدون","أم أذينة","الرابية","خلدا","دير غبار","دابوق","الصويفية","وادي السير","بيادر وادي السير","أم السماق","تلاع العلي","الشميساني","جبل عمان","العبدلي","مرج الحمام","شارع مكة","الدوار الأول","الدوار الثاني","الدوار الثالث","الدوار الرابع","الدوار الخامس","الدوار السادس"];
const PERMISSIONS=[
  ["dashboard","الرئيسية"],["properties","الشقق"],["tenants","المستأجرين"],
  ["reports","التقارير"],["settings","الإعدادات"],["messages","المحادثات"]
];

const state={
  user:null,token:"",properties:[],users:[],
  settings:{design:"blue",whatsapp:"",notificationDays:7,heroTitle:"إدارة عقاراتك بسهولة واحترافية",heroSubtitle:"نظام متكامل لإدارة الشقق في غرب عمان",light:false,soundEnabled:true,areas:[...AREAS.slice(1)]},
  history:[],
  page:"dashboard",
  filter:{q:"",area:"الكل",status:"الكل",rooms:"الكل",baths:"الكل",balcony:"الكل",minPrice:"",maxPrice:"",sort:"newest"}
};

function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(msg,good=true){
  const r=$("#toast-root"); if(!r){alert(msg);return}
  const e=document.createElement("div");e.className="toast "+(good?"good":"bad");e.textContent=msg;r.appendChild(e);setTimeout(()=>e.remove(),3200)
}
async function api(url,opt={}){
  opt.headers={...(opt.headers||{}),...(state.token?{"Authorization":"Bearer "+state.token}:{})};
  const r=await fetch(url,opt); const x=await r.json().catch(()=>({}));
  if(!r.ok) throw Error(x.message||x.error||"حدث خطأ");
  return x;
}
function can(p){return state.user?.role==="owner" || state.user?.permissions?.includes(p)}
function statusClass(s){return s==="متاحة"?"green":s==="مؤجرة"?"blue":s==="محجوزة"?"orange":"red"}
function daysUntil(d){if(!d)return 9999;return Math.ceil((new Date(d+"T23:59:59")-Date.now())/86400000)}
function formatDate(d){if(!d)return "-";try{return new Intl.DateTimeFormat("ar-JO",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(d+"T00:00:00"))}catch{return d}}

async function loadState(){
  try{
    const x=await api("/api/app-state");
    state.settings={...state.settings,...(x.settings||{})};
    state.history=Array.isArray(x.search_history)?x.search_history:[];
    state.settings.areas=[...new Set([...(state.settings.areas||[]),...AREAS.slice(1)])];
  }catch{}
}
async function loadPublic(){try{state.properties=await api("/api/public/properties")}catch{state.properties=[]}render()}
async function loadAdmin(){state.properties=await api("/api/properties");await loadState();render()}
async function persistState(){
  try{await api("/api/app-state",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({settings:state.settings,search_history:state.history})})}
  catch(e){toast(e.message,false)}
}
function saveHistory(){
  const f=state.filter;
  if(!f.q&&f.area==="الكل"&&f.status==="الكل"&&f.rooms==="الكل"&&f.baths==="الكل"&&f.balcony==="الكل"&&f.minPrice===""&&f.maxPrice==="") return;
  const label=[f.q&&`بحث: ${f.q}`,f.area!=="الكل"&&`المنطقة: ${f.area}`,f.status!=="الكل"&&`الحالة: ${f.status}`,f.rooms!=="الكل"&&`غرف: ${f.rooms}`,f.baths!=="الكل"&&`حمامات: ${f.baths}`,f.balcony!=="الكل"&&`بلكونة: ${f.balcony==="1"?"نعم":"لا"}`,f.minPrice!==""&&`من: ${f.minPrice}`,f.maxPrice!==""&&`إلى: ${f.maxPrice}`].filter(Boolean).join(" • ");
  state.history=[{...f,label,date:new Date().toLocaleString("ar-JO",{dateStyle:"short",timeStyle:"short"})},...state.history.filter(h=>h.label!==label)].slice(0,12);
  if(state.user) persistState();
}
function filtered(){
  let ps=[...state.properties],f=state.filter;
  if(f.q){const q=f.q.toLowerCase();ps=ps.filter(p=>`${p.name} ${p.code} ${p.area} ${p.notes||""}`.toLowerCase().includes(q))}
  if(f.area!=="الكل")ps=ps.filter(p=>p.area===f.area);
  if(f.status!=="الكل")ps=ps.filter(p=>p.status===f.status);
  if(f.rooms!=="الكل")ps=ps.filter(p=>String(p.rooms)===f.rooms);
  if(f.baths!=="الكل")ps=ps.filter(p=>String(p.baths)===f.baths);
  if(f.balcony!=="الكل")ps=ps.filter(p=>String(!!p.balcony)===(f.balcony==="1"));
  if(f.minPrice!=="")ps=ps.filter(p=>Number(p.price)>=Number(f.minPrice));
  if(f.maxPrice!=="")ps=ps.filter(p=>Number(p.price)<=Number(f.maxPrice));
  if(f.sort==="priceAsc")ps.sort((a,b)=>Number(a.price)-Number(b.price));
  if(f.sort==="priceDesc")ps.sort((a,b)=>Number(b.price)-Number(a.price));
  return ps;
}
function searchForm(){
  const f=state.filter;
  return `<form id="searchForm" class="filters">
    <div class="field search"><label>بحث</label><input id="q" value="${esc(f.q)}" placeholder="الكود أو الاسم أو المنطقة"></div>
    <div class="field"><label>المنطقة</label><select id="area">${AREAS.map(x=>`<option ${x===f.area?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
    <div class="field"><label>الحالة</label><select id="status">${["الكل","متاحة","مؤجرة","محجوزة"].map(x=>`<option ${x===f.status?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="field"><label>الغرف</label><select id="rooms">${["الكل","1","2","3","4","5","6"].map(x=>`<option ${x===f.rooms?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="field"><label>الحمامات</label><select id="baths">${["الكل","1","2","3","4","5"].map(x=>`<option ${x===f.baths?"selected":""}>${x}</option>`).join("")}</select></div>
    <div class="field"><label>بلكونة</label><select id="balcony"><option value="الكل">الكل</option><option value="1" ${f.balcony==="1"?"selected":""}>نعم</option><option value="0" ${f.balcony==="0"?"selected":""}>لا</option></select></div>
    <div class="field"><label>السعر من</label><input id="minPrice" type="number" value="${esc(f.minPrice)}"></div>
    <div class="field"><label>السعر إلى</label><input id="maxPrice" type="number" value="${esc(f.maxPrice)}"></div>
    <div class="field"><label>الترتيب</label><select id="sort"><option value="newest" ${f.sort==="newest"?"selected":""}>الأحدث</option><option value="priceAsc" ${f.sort==="priceAsc"?"selected":""}>الأقل سعراً</option><option value="priceDesc" ${f.sort==="priceDesc"?"selected":""}>الأعلى سعراً</option></select></div>
    <button class="btn">🔎 بحث</button>
  </form>`;
}
function historyBar(){
  if(!state.history.length)return "";
  return `<div class="history-bar"><b>سجل البحث</b>${state.history.slice(0,8).map((h,i)=>`<button class="history-chip" data-history="${i}">${esc(h.label)}</button>`).join("")}</div>`;
}
function cards(ps,admin=false){
  if(!ps.length)return `<div class="empty">لا توجد شقق مطابقة للبحث.</div>`;
  return `<div class="cards">${ps.map(p=>`<article class="card">
    <div class="card-media">
      <img src="${esc((p.images||[])[0]||"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=82")}" alt="${esc(p.name)}">
      <span class="badge ${statusClass(p.status)}">${esc(p.status)}</span>
      <span class="photo-count">📷 ${(p.images||[]).length}</span>
    </div>
    <div class="card-body"><h3>${esc(p.name)}</h3><div class="muted">#${esc(p.code)} • ${esc(p.area)}</div>
      <div class="card-meta"><span>🛏 ${p.rooms||0}</span><span>🛁 ${p.baths||0}</span><span>🌿 ${p.balcony?"نعم":"لا"}</span><span>💰 ${Number(p.price||0).toLocaleString("ar-JO")}</span></div>
      <div class="card-actions"><button class="ghost-btn" data-view="${p.id}">التفاصيل</button>${admin?`<button class="danger-btn" data-delete="${p.id}">حذف</button>`:""}</div>
    </div>
  </article>`).join("")}</div>`;
}
function header(){
  return `<header class="topbar"><button class="brand-btn" id="homeBtn"><span class="brand-mark">⌂</span><span>عقارات غرب عمان<small>${state.user?"لوحة الإدارة":"العقارات المتاحة"}</small></span></button>
    <div class="top-actions">${state.user?`<button class="ghost-btn" id="logout">خروج</button>`:`<button class="ghost-btn" id="loginBtn">🔐 دخول</button>`}</div></header>`;
}
function publicHome(){
  return `${header()}<main class="content">
    <section class="hero"><div class="hero-content"><div class="eyebrow">♛ الأزرق الراقي</div><h1>${esc(state.settings.heroTitle)}</h1><p>${esc(state.settings.heroSubtitle)}</p><div class="hero-actions"><button class="btn" id="scrollSearch">استعراض العقارات</button></div></div></section>
    <section class="panel landing-search" id="landingSearch"><div class="panel-title"><h2>🔎 البحث عن شقة</h2></div>${historyBar()}${searchForm()}${cards(filtered())}</section>
  </main>`;
}
function sidebar(){
  const items=[["dashboard","⌂","الرئيسية"],["properties","▦","الشقق"],["tenants","♙","المستأجرين"],["reports","▥","التقارير"],["settings","⚙","الإعدادات"],["admins","♙","إدارة المديرين"],["messages","✉","المحادثات"]];
  return `<aside class="sidebar"><div class="side-title">لوحة التحكم</div>${items.filter(x=>x[0]==="admins"?state.user.role==="owner":can(x[0])).map(x=>`<button class="nav-item ${state.page===x[0]?"active":""}" data-page="${x[0]}">${x[1]} <span>${x[2]}</span></button>`).join("")}<div class="side-user"><b>${esc(state.user.name)}</b><br>${state.user.role==="owner"?"المالك":"مدير النظام"}</div></aside>`;
}
function adminShell(body){return `${header()}<div class="layout">${sidebar()}<main class="content">${body}</main></div>`}
function dashboard(){
  const p=state.properties;
  const soon=p.filter(x=>x.status!=="متاحة"&&x.availability_date&&daysUntil(x.availability_date)>=0&&daysUntil(x.availability_date)<=Number(x.alert_days??state.settings.notificationDays??7));
  return `<section class="hero compact"><button class="icon-btn closePage page-close">✕</button><div class="hero-content"><div class="eyebrow">♛ لوحة الإدارة</div><h1>مرحباً ${esc(state.user.name)}</h1><p>بيانات العقارات محفوظة في Supabase.</p></div></section>
  ${soon.length?`<button class="alert-panel" id="soonBtn">🔴 ${soon.length} ${soon.length===1?"شقة ستصبح":"شقق ستصبح"} متاحة قريباً</button>`:""}
  <div class="stats"><div class="stat green"><b>متاحة</b><strong>${p.filter(x=>x.status==="متاحة").length}</strong></div><div class="stat blue"><b>مؤجرة</b><strong>${p.filter(x=>x.status==="مؤجرة").length}</strong></div><div class="stat orange"><b>محجوزة</b><strong>${p.filter(x=>x.status==="محجوزة").length}</strong></div><div class="stat red"><b>إجمالي الشقق</b><strong>${p.length}</strong></div></div>`;
}
function propertiesPage(){
  return `<section class="panel"><div class="panel-title"><div><h2>إدارة الشقق</h2><p class="muted">الإضافة والتعديل والحذف محفوظة في قاعدة البيانات.</p></div><div class="btn-row"><button class="btn" id="newProperty">＋ إضافة شقة</button><button class="icon-btn closePage">✕</button></div></div>${historyBar()}${searchForm()}${cards(filtered(),true)}</section>`;
}
function settingsPage(){
  const s=state.settings;
  return `<section class="panel"><div class="panel-title"><h2>الإعدادات</h2><button class="icon-btn closePage">✕</button></div>
    <form id="settingsForm" class="form-grid">
      <div class="field"><label>رقم واتساب المشاركة</label><input id="whatsapp" value="${esc(s.whatsapp||"")}"></div>
      <div class="field"><label>عدد أيام تنبيه قرب التوفر</label><input id="notificationDays" type="number" min="0" value="${Number(s.notificationDays??7)}"></div>
      <div class="field full"><label>عنوان الصفحة الرئيسية</label><input id="heroTitle" value="${esc(s.heroTitle||"")}"></div>
      <div class="field full"><label>الوصف الرئيسي</label><textarea id="heroSubtitle">${esc(s.heroSubtitle||"")}</textarea></div>
      <div class="field"><label>الوضع الفاتح</label><select id="light"><option value="0" ${!s.light?"selected":""}>لا</option><option value="1" ${s.light?"selected":""}>نعم</option></select></div>
      <div class="field"><label>التصميم</label><select id="design"><option value="blue" ${(s.design||"blue")==="blue"?"selected":""}>الأزرق الراقي</option><option value="turquoise" ${s.design==="turquoise"?"selected":""}>التركواز الفاخر</option><option value="gold" ${s.design==="gold"?"selected":""}>الأبيض والذهبي الراقي</option></select></div>
      <div class="field"><label>صوت التنبيه</label><select id="soundEnabled"><option value="1" ${s.soundEnabled!==false?"selected":""}>مفعل</option><option value="0" ${s.soundEnabled===false?"selected":""}>متوقف</option></select></div>
      <div class="full btn-row"><button class="btn">حفظ الإعدادات</button></div>
    </form>
    <hr><div class="panel-title"><h3>الأمان</h3></div>
    <form id="passwordForm" class="form-grid"><div class="field"><label>كلمة المرور الجديدة</label><input id="newPassword" type="password" minlength="6" required></div><div class="full btn-row"><button class="btn">تغيير كلمة المرور الخاصة بي</button></div></form>
    ${state.user.role==="owner"?`<hr><form id="ownerPasswordForm" class="form-grid"><div class="field"><label>كلمة سر المالك الجديدة</label><input id="ownerPassword" type="password" minlength="6" required></div><div class="full btn-row"><button class="btn">تعديل كلمة سر المالك</button></div></form>`:""}
  </section>`;
}
async function usersPage(){
  let users=[];try{users=await api("/api/users")}catch(e){return `<section class="panel"><h2>إدارة المديرين</h2><p>${esc(e.message)}</p></section>`}
  return `<section class="panel"><div class="panel-title"><h2>إدارة المديرين والصلاحيات</h2><div class="btn-row"><button class="btn" id="newAdmin">＋ إضافة مدير</button><button class="icon-btn closePage">✕</button></div></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الصلاحيات</th></tr></thead><tbody>
    ${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role==="owner"?"المالك":"مدير"}</td><td>${u.role==="owner"?"كامل":(u.permissions||[]).map(x=>PERMISSIONS.find(p=>p[0]===x)?.[1]||x).join("، ")}</td></tr>`).join("")}
    </tbody></table></div></section>`;
}
function modal(html){$("#modal-root")?.remove();const r=document.createElement("div");r.id="modal-root";r.innerHTML=`<div class="modal"><div class="modal-box">${html}</div></div>`;document.body.appendChild(r);r.addEventListener("click",e=>{if(e.target.classList.contains("modal"))r.remove();});$(".closeModal",r)?.addEventListener("click",()=>r.remove())}
function details(p){
  const text=`🏠 عقارات غرب عمان\n🔑 الكود: ${p.code}\n📍 المنطقة: ${p.area}\n🛏 الغرف: ${p.rooms||0}\n🛁 الحمامات: ${p.baths||0}\n🌿 بلكونة: ${p.balcony?"نعم":"لا"}\n📐 المساحة: ${p.area_size||"-"} م²\n💰 السعر: ${p.price||0} دينار\n📌 الحالة: ${p.status}`;
  modal(`<div class="modal-head"><h2>${esc(p.name)}</h2><button class="icon-btn closeModal">✕</button></div>
    <div class="muted">#${esc(p.code)} • ${esc(p.area)}</div>
    <div class="details-gallery">${(p.images||[]).map(x=>`<img src="${esc(x)}">`).join("")||"<div class='empty'>لا توجد صور</div>"}</div>
    ${p.video_url?`<video controls src="${esc(p.video_url)}"></video>`:""}
    <div class="detail-grid"><div><b>الغرف</b><span>${p.rooms||0}</span></div><div><b>الحمامات</b><span>${p.baths||0}</span></div><div><b>البلكونة</b><span>${p.balcony?"نعم":"لا"}</span></div><div><b>المساحة</b><span>${p.area_size||"-"} م²</span></div><div><b>السعر</b><span>${p.price||0} دينار</span></div><div><b>الحالة</b><span class="badge ${statusClass(p.status)}">${esc(p.status)}</span></div></div>
    <div class="copy-box"><label>التفاصيل الكاملة</label><textarea id="shareText">${esc(text)}</textarea></div>
    <div class="btn-row"><button class="btn" id="copyDetails">نسخ التفاصيل</button>${state.user&&can("properties")?`<button class="ghost-btn" id="editProperty">تعديل</button>`:""}${state.user&&state.user.role==="owner"&&state.settings.whatsapp?`<button class="btn" id="waShare">واتساب</button>`:""}</div>`);
  $("#copyDetails")?.addEventListener("click",async()=>{await navigator.clipboard?.writeText(text);toast("تم نسخ التفاصيل")});
  $("#editProperty")?.addEventListener("click",()=>propertyModal(p));
  $("#waShare")?.addEventListener("click",()=>{const n=String(state.settings.whatsapp).replace(/\D/g,"");location.href=`https://wa.me/${n}?text=${encodeURIComponent(text)}`});
}
function propertyModal(p=null){
  let imgs=[...(p?.images||[])];
  modal(`<div class="modal-head"><h2>${p?"تعديل الشقة":"إضافة شقة"}</h2><button class="icon-btn closeModal">✕</button></div>
    <form id="propertyForm" class="form-grid">
      <div class="field"><label>كود الشقة</label><input id="code" required value="${esc(p?.code||"")}"></div>
      <div class="field"><label>اسم الشقة</label><input id="name" required value="${esc(p?.name||"")}"></div>
      <div class="field"><label>المنطقة</label><select id="area">${AREAS.slice(1).map(x=>`<option ${x===p?.area?"selected":""}>${esc(x)}</option>`).join("")}</select></div>
      <div class="field"><label>الحالة</label><select id="status">${["متاحة","مؤجرة","محجوزة"].map(x=>`<option ${x===(p?.status||"متاحة")?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="field"><label>عدد الغرف</label><input id="rooms" type="number" min="0" value="${p?.rooms||0}"></div>
      <div class="field"><label>عدد الحمامات</label><input id="baths" type="number" min="0" value="${p?.baths||0}"></div>
      <div class="field"><label>البلكونة</label><select id="balcony"><option value="1" ${p?.balcony?"selected":""}>نعم</option><option value="0" ${!p?.balcony?"selected":""}>لا</option></select></div>
      <div class="field"><label>الطابق</label><input id="floor" type="number" value="${p?.floor??""}"></div>
      <div class="field"><label>المساحة م²</label><input id="areaSize" type="number" value="${p?.area_size??""}"></div>
      <div class="field"><label>السعر الشهري</label><input id="price" type="number" value="${p?.price??""}"></div>
      <div class="field"><label>تاريخ التوفر</label><input id="availability" type="date" value="${esc(p?.availability_date||"")}"></div>
      <div class="field"><label>أيام التنبيه لهذه الشقة</label><input id="alertDays" type="number" min="0" value="${p?.alert_days??state.settings.notificationDays??7}"></div>
      <div class="field full"><label>ملاحظات</label><textarea id="notes">${esc(p?.notes||"")}</textarea></div>
      <div class="field full"><label>رابط الفيديو</label><input id="video" value="${esc(p?.video_url||"")}" placeholder="https://..."></div>
      <div class="field full"><label>صور JPG / PNG / WEBP — حتى 30 صورة</label><input id="images" type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="photos" id="previews">${imgs.map(x=>`<div class="photo"><img src="${esc(x)}"><button type="button" class="photo-remove" data-remove-image="${esc(x)}">×</button></div>`).join("")}</div></div>
      <div class="full btn-row"><button class="btn" id="saveProperty">حفظ الشقة</button><button type="button" class="ghost-btn closeModal">إلغاء</button></div>
    </form>`);
  const previews=$("#previews");
  $("#images").addEventListener("change",e=>{
    for(const f of [...e.target.files].slice(0,30-imgs.length)){
      if(!["image/jpeg","image/png","image/webp"].includes(f.type)){toast("يسمح فقط JPG / PNG / WEBP",false);continue}
      const u=URL.createObjectURL(f);const item={file:f,url:u};const d=document.createElement("div");d.className="photo pending";d.innerHTML=`<img src="${u}"><span>جديد</span><button type="button" class="photo-remove" data-remove-pending>×</button>`;d.dataset.imageKey=String(imgs.length);previews.appendChild(d);imgs.push(item);
    }
  });
  previews.addEventListener("click",e=>{const b=e.target.closest("[data-remove-image],[data-remove-pending]");if(!b)return;const card=b.closest(".photo");if(b.hasAttribute("data-remove-image")){imgs=imgs.filter(x=>x!==b.dataset.removeImage)}else{const key=card?.dataset.imageKey;const item=key!=null?imgs[Number(key)]:null;if(item?.url)URL.revokeObjectURL(item.url);imgs=imgs.filter(x=>x!==item)}card?.remove()});
  $("#propertyForm").addEventListener("submit",async e=>{
    e.preventDefault();const btn=$("#saveProperty");btn.disabled=true;btn.textContent="جاري الحفظ...";
    try{
      const files=imgs.filter(x=>typeof x==="object"&&x.file).map(x=>x.file);
      let uploaded=[];
      if(files.length){
        const fd=new FormData();files.forEach(f=>fd.append("images",f));
        const u=await api("/api/upload",{method:"POST",body:fd});uploaded=u.urls||[];
      }
      const old=imgs.filter(x=>typeof x==="string");
      const payload={code:$("#code").value.trim(),name:$("#name").value.trim(),area:$("#area").value,status:$("#status").value,rooms:$("#rooms").value,baths:$("#baths").value,balcony:$("#balcony").value,floor:$("#floor").value,areaSize:$("#areaSize").value,price:$("#price").value,availabilityDate:$("#availability").value,alertDays:$("#alertDays").value,notes:$("#notes").value,video:$("#video").value,images:[...old,...uploaded]};
      const saved=p?await api(`/api/properties/${p.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}):await api("/api/properties",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      $("#modal-root")?.remove();toast("تم حفظ الشقة والصور بنجاح");await loadAdmin();
    }catch(e){toast(e.message,false);btn.disabled=false;btn.textContent="حفظ الشقة"}
  });
}
function adminModal(){
  modal(`<div class="modal-head"><h2>إضافة مدير وصلاحيات</h2><button class="icon-btn closeModal">✕</button></div><form id="adminForm" class="form-grid">
    <div class="field"><label>اسم المدير</label><input id="adminName" required></div><div class="field"><label>البريد الإلكتروني</label><input id="adminEmail" type="email" required></div><div class="field"><label>كلمة المرور</label><input id="adminPass" type="password" minlength="6" required></div>
    <div class="field full"><label>الصلاحيات</label><div class="checks">${PERMISSIONS.map(p=>`<label><input type="checkbox" value="${p[0]}" ${["dashboard","properties"].includes(p[0])?"checked":""}> ${p[1]}</label>`).join("")}</div></div>
    <div class="full btn-row"><button class="btn">إنشاء المدير</button></div></form>`);
  $("#adminForm").addEventListener("submit",async e=>{e.preventDefault();try{
    const permissions=$$("#adminForm input[type=checkbox]:checked").map(x=>x.value);
    await api("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:$("#adminName").value,email:$("#adminEmail").value,password:$("#adminPass").value,permissions})});
    $("#modal-root")?.remove();toast("تم إنشاء المدير");render();
  }catch(err){toast(err.message,false)}});
}
function soonModal(){
  const s=state.properties.filter(x=>x.status!=="متاحة"&&x.availability_date&&daysUntil(x.availability_date)>=0&&daysUntil(x.availability_date)<=Number(x.alert_days??state.settings.notificationDays??7));
  modal(`<div class="modal-head"><h2>🔔 الشقق القريبة من التوفر</h2><button class="icon-btn closeModal">✕</button></div>${s.map(p=>`<div class="soon-card"><b>#${esc(p.code)} — ${esc(p.name)}</b><span>${esc(p.area)} • ${formatDate(p.availability_date)}</span></div>`).join("")||"<div class='empty'>لا توجد تنبيهات.</div>"}`);
}
function page(){
  if(state.page==="dashboard")return dashboard();
  if(state.page==="properties")return propertiesPage();
  if(state.page==="settings")return settingsPage();
  if(state.page==="admins")return usersPage();
  return `<section class="panel"><div class="panel-title"><h2>${esc((PERMISSIONS.find(x=>x[0]===state.page)||["","القسم"])[1])}</h2><button class="icon-btn closePage">✕</button></div><div class="empty">هذا القسم جاهز للربط بالبيانات الإضافية عند الحاجة.</div></section>`;
}
function loginView(){
  return `<div class="login"><div class="login-box"><div class="brand-large"><span class="brand-mark">⌂</span><b>عقارات غرب عمان</b></div><h1>تسجيل الدخول</h1><p>الدخول للمالك والمديرين المصرح لهم فقط</p><form id="loginForm"><div class="field"><label>البريد الإلكتروني</label><input id="email" type="email" required></div><div class="field"><label>كلمة المرور</label><input id="password" type="password" required></div><button class="btn">دخول إلى النظام</button><button type="button" class="ghost-btn" id="backHome">العودة</button></form></div></div>`;
}
function render(){
  document.body.className=(state.settings.light?"light ":"")+"design-"+(state.settings.design||"blue");
  if(!state.user){$("#app").innerHTML=publicHome();bindPublic();return}
  $("#app").innerHTML=adminShell(page());bindAdmin();
}
function bindPublic(){
  $("#loginBtn")?.addEventListener("click",()=>{$("#app").innerHTML=loginView();bindLogin()});
  $("#homeBtn")?.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
  $("#scrollSearch")?.addEventListener("click",()=>$("#landingSearch")?.scrollIntoView({behavior:"smooth"}));
  bindSearch(false);
  $$("[data-view]").forEach(b=>b.addEventListener("click",()=>details(state.properties.find(p=>String(p.id)===String(b.dataset.view)))));
  $$("[data-history]").forEach(b=>b.addEventListener("click",()=>{const h=state.history[Number(b.dataset.history)];if(h){state.filter={q:h.q||"",area:h.area||"الكل",status:h.status||"الكل",rooms:h.rooms||"الكل",baths:h.baths||"الكل",balcony:h.balcony||"الكل",minPrice:h.minPrice||"",maxPrice:h.maxPrice||"",sort:h.sort||"newest"};render()}}));
}
function bindLogin(){
  $("#backHome")?.addEventListener("click",loadPublic);
  $("#loginForm")?.addEventListener("submit",async e=>{e.preventDefault();try{
    const d=await api("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("#email").value,password:$("#password").value})});
    state.user=d.user;state.token=d.token;localStorage.setItem("wam_token",d.token);localStorage.setItem("wam_user",JSON.stringify(d.user));state.page="dashboard";await loadAdmin();
  }catch(err){toast(err.message,false)}});
}
function bindSearch(admin){
  $("#searchForm")?.addEventListener("submit",async e=>{e.preventDefault();state.filter={q:$("#q").value.trim(),area:$("#area").value,status:$("#status").value,rooms:$("#rooms").value,baths:$("#baths").value,balcony:$("#balcony").value,minPrice:$("#minPrice").value,maxPrice:$("#maxPrice").value,sort:$("#sort").value};saveHistory();render()});
  $$("[data-view]").forEach(b=>b.addEventListener("click",()=>details(state.properties.find(p=>String(p.id)===String(b.dataset.view)))));
  if(admin)$$("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(confirm("حذف الشقة؟"))try{await api(`/api/properties/${b.dataset.delete}`,{method:"DELETE"});toast("تم الحذف");await loadAdmin()}catch(e){toast(e.message,false)}}));
}
function bindAdmin(){
  $("#logout")?.addEventListener("click",()=>{state.user=null;state.token="";localStorage.removeItem("wam_token");localStorage.removeItem("wam_user");state.page="dashboard";loadPublic()});
  $("#homeBtn")?.addEventListener("click",()=>{state.page="dashboard";render()});
  $(".closePage")?.addEventListener("click",()=>{state.page="dashboard";render()});
  $$("[data-page]").forEach(b=>b.addEventListener("click",async()=>{state.page=b.dataset.page;if(state.page==="properties")await loadAdmin();else render()}));
  if(state.page==="properties")bindSearch(true);
  $("#newProperty")?.addEventListener("click",()=>propertyModal());
  $("#newAdmin")?.addEventListener("click",adminModal);
  $("#soonBtn")?.addEventListener("click",soonModal);
  $("#settingsForm")?.addEventListener("submit",async e=>{e.preventDefault();state.settings.whatsapp=$("#whatsapp").value.trim();state.settings.notificationDays=Number($("#notificationDays").value||7);state.settings.heroTitle=$("#heroTitle").value.trim();state.settings.heroSubtitle=$("#heroSubtitle").value.trim();state.settings.light=$("#light").value==="1";state.settings.design=$("#design").value;state.settings.soundEnabled=$("#soundEnabled").value==="1";await persistState();render();toast("تم حفظ الإعدادات")});
  $("#passwordForm")?.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({newPassword:$("#newPassword").value})});e.target.reset();toast("تم تغيير كلمة المرور")}catch(err){toast(err.message,false)}});
  $("#ownerPasswordForm")?.addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/admin/change-owner-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({newPassword:$("#ownerPassword").value})});e.target.reset();toast("تم تغيير كلمة سر المالك")}catch(err){toast(err.message,false)}});
  $$("[data-view]").forEach(b=>b.addEventListener("click",()=>details(state.properties.find(p=>String(p.id)===String(b.dataset.view)))));
  $$("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(confirm("حذف الشقة؟"))try{await api(`/api/properties/${b.dataset.delete}`,{method:"DELETE"});toast("تم الحذف");await loadAdmin()}catch(e){toast(e.message,false)}}));
}
(async()=>{
  const t=localStorage.getItem("wam_token");
  let u=null;try{u=JSON.parse(localStorage.getItem("wam_user")||"null")}catch{localStorage.removeItem("wam_user")}

  if(t&&u){state.token=t;state.user=u;try{await loadAdmin();return}catch{localStorage.removeItem("wam_token");localStorage.removeItem("wam_user");state.user=null;state.token=""}}
  await loadPublic();
})();
