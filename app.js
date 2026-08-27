// لا يعتمد التطبيق على مفاتيح Supabase في المتصفح؛ كل العمليات تمر عبر server.js.
const apiFetch=async (url,opt={})=>{
  const token=localStorage.getItem("wam_auth_token")||"";
  const headers={...(opt.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  if(opt.body && !(opt.body instanceof FormData) && !headers["Content-Type"]) headers["Content-Type"]="application/json";
  const r=await fetch(url,{...opt,headers});
  const text=await r.text(); let data={}; try{data=text?JSON.parse(text):{}}catch{data={error:text}};
  if(!r.ok) return {error:new Error(data.message||data.error||"حدث خطأ في الخادم"),data:null};
  return {error:null,data};
};
const uploadedUrls=new Map();
class QueryBuilder{
  constructor(table){this.table=table;this.method="GET";this.body=null;this.filters=[];this.orderBy="";this.single=false;this.prefer=""}
  select(){this.method="GET";return this}
  eq(k,v){this.filters.push([k,v]);return this}
  order(k,opt={}){this.orderBy=`${encodeURIComponent(k)}.${opt.ascending===false?'desc':'asc'}`;return this}
  maybeSingle(){this.single=true;return this}
  insert(body){this.method="POST";this.body=body;return this}
  upsert(body){this.method="POST";this.body=body;this.prefer="resolution=merge-duplicates";return this}
  update(body){this.method="PATCH";this.body=body;return this}
  delete(){this.method="DELETE";return this}
  async then(resolve,reject){try{
    let url=`/api/data/${encodeURIComponent(this.table)}`;
    const q=[]; for(const [k,v] of this.filters) q.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    if(this.orderBy) q.push(`order=${this.orderBy}`);
    if(q.length) url+=`?${q.join('&')}`;
    const headers={}; if(this.prefer) headers.Prefer=this.prefer;
    const r=await apiFetch(url,{method:this.method,headers,body:this.body?JSON.stringify(this.body):undefined});
    let data=r.data; if(this.single && Array.isArray(data)) data=data[0]||null;
    return resolve({data,error:r.error});
  }catch(e){return reject(e)}}
}
const sb={
  from:(table)=>new QueryBuilder(table),
  auth:{
    getSession:async()=>({data:{session:JSON.parse(localStorage.getItem("wam_auth_session")||"null")},error:null}),
    signInWithPassword:async({email,password})=>{
      const r=await apiFetch('/api/login',{method:'POST',body:JSON.stringify({email,password})});
      if(r.error)return {data:null,error:r.error};
      const session={access_token:r.data.token,user:r.data.user};
      localStorage.setItem('wam_auth_token',r.data.token||'');
      localStorage.setItem('wam_auth_user',JSON.stringify(r.data.user||{}));
      localStorage.setItem('wam_auth_session',JSON.stringify(session));
      return {data:{session,user:r.data.user},error:null};
    },
    signOut:async()=>{localStorage.removeItem('wam_auth_token');localStorage.removeItem('wam_auth_user');localStorage.removeItem('wam_auth_session');return {error:null}},
    updateUser:async({password})=>{const r=await apiFetch('/api/owner/change-password',{method:'POST',body:JSON.stringify({password})});return {data:null,error:r.error}}
  },
  storage:{from:(bucket)=>({
    upload:async(path,file)=>{const fd=new FormData();fd.append('images',file,file.name||'image');fd.append('path',path);fd.append('bucket',bucket);const r=await apiFetch('/api/upload',{method:'POST',body:fd});if(r.error)return {data:null,error:r.error};const url=r.data?.urls?.[0]||'';uploadedUrls.set(`${bucket}/${path}`,url);return {data:{path},error:null}},
    getPublicUrl:(path)=>({data:{publicUrl:uploadedUrls.get(`${bucket}/${path}`)||''}})
  })}
};
const configured=true;
let user=null, profile=null, properties=[], areas=[], tenants=[], contracts=[], settings={alertDays:7,whatsapp:""};
let searchHistory=JSON.parse(localStorage.getItem("wa_search_history")||"[]");
const $=id=>document.getElementById(id);
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600)}
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function fmt(n){return new Intl.NumberFormat("ar-JO").format(Number(n||0))}
function statusClass(s){if(s==="تحت الصيانة")return "status-تحت";if(s==="قريبة من التوفر")return "status-قريبة";return "status-"+s}
function daysTo(d){if(!d)return Infinity;return Math.ceil((new Date(d)-new Date())/86400000)}
function near(p){return p.available_date&&daysTo(p.available_date)>=0&&daysTo(p.available_date)<=Number(p.alert_days??settings.alertDays??7)}
function canEdit(){return profile?.role==="owner"||profile?.role==="admin"}

async function init(){
  $("configNotice").textContent="";
  bind();
  const {data:{session}}=await sb.auth.getSession();
  if(session) await enter(session.user); else showLogin();
}
function showLogin(){ $("loginView").classList.remove("hidden"); $("app").classList.add("hidden") }
async function enter(u){
  user=u; $("loginView").classList.add("hidden"); $("app").classList.remove("hidden");
  await loadAll(); showPage("home");
}
async function loadAll(){
  
  const p=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
  profile=p.data||{id:user.id,full_name:user.email,role:"admin",permissions:{}};
  const [pr,a,t,c]=await Promise.all([
    sb.from("properties").select("*").order("created_at",{ascending:false}),
    sb.from("areas").select("*").order("name"),
    sb.from("tenants").select("*").order("created_at",{ascending:false}),
    sb.from("contracts").select("*").order("created_at",{ascending:false})
  ]);
  properties=pr.data||[];areas=a.data||[];tenants=t.data||[];contracts=c.data||[];
  renderAll();
}
function renderAll(){
  renderAreas(); renderHistory(); renderProperties(); renderAdminProperties(); renderTenants(); renderContracts(); renderAlerts(); renderReports(); renderAdmins(); renderMessages(); renderProfile(); updateSearchArea();
  const n=properties.filter(near).length; const ac=$("alertCounter");
  ac.classList.toggle("hidden",!n); if(n)ac.innerHTML=`🔴 ${n} شقة ستصبح متاحة قريباً — <button class="btn small gold" data-page="alerts">عرض التنبيهات</button>`;
}
function bind(){
  $("loginForm").onsubmit=async e=>{e.preventDefault();const {data,error}=await sb.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)return toast(error.message);await enter(data.user)};
  $("logoutBtn").onclick=async()=>{if(sb)await sb.auth.signOut();showLogin()};
  $("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
  $("themeBtn").onclick=()=>document.body.classList.toggle("light");
  document.body.addEventListener("click",e=>{const p=e.target.closest("[data-page]")?.dataset.page;if(p){showPage(p);$("sidebar").classList.remove("open")}});
  $("doSearch").onclick=runSearch;$("clearSearch").onclick=clearSearch;
  $("newProperty").onclick=()=>openProperty();
  $("newTenant").onclick=()=>openTenant();
  $("newContract").onclick=()=>openContract();
  $("areaForm").onsubmit=addArea;$("saveSettings").onclick=saveSettings;
  $("addAdminBtn").onclick=()=>openAdmin();
  $("ownerPasswordBtn").onclick=changePassword;$("changePasswordBtn").onclick=changePassword;
  $("exportBtn").onclick=exportData;$("importFile").onchange=importData;
  $("chatForm").onsubmit=sendMessage;
  $("modalClose").onclick=closeModal;
}
function showPage(p){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  ($(p+"Page")||$("homePage")).classList.remove("hidden");
  if(p==="home")runSearch();
}
function updateSearchArea(){const s=$("searchArea");s.innerHTML='<option value="">كل المناطق</option>'+areas.map(a=>`<option>${esc(a.name)}</option>`).join("")}
function getFilters(){
 return {text:$("searchText").value.trim().toLowerCase(),area:$("searchArea").value,status:$("searchStatus").value,type:$("searchType").value,rooms:$("searchRooms").value,baths:$("searchBaths").value,salon:$("searchSalon").value,balcony:$("searchBalcony").value,min:$("searchMinPrice").value,max:$("searchMaxPrice").value,sort:$("sortBy").value}
}
function filterProps(f){
 let a=properties.filter(p=>(!f.text||[p.code,p.title,p.address,p.owner_name].join(" ").toLowerCase().includes(f.text))&&(!f.area||p.area===f.area)&&(!f.status||p.status===f.status||f.status==="قريبة من التوفر"&&near(p))&&(!f.type||p.property_type===f.type)&&(!f.rooms||Number(p.rooms)>=Number(f.rooms))&&(!f.baths||Number(p.bathrooms)>=Number(f.baths))&&(!f.salon||p.salon===f.salon)&&(!f.balcony||p.balcony===f.balcony)&&(!f.min||Number(p.price)>=Number(f.min))&&(!f.max||Number(p.price)<=Number(f.max)));
 if(f.sort==="priceAsc")a.sort((x,y)=>Number(x.price)-Number(y.price));else if(f.sort==="priceDesc")a.sort((x,y)=>Number(y.price)-Number(x.price));else a.sort((x,y)=>new Date(y.created_at)-new Date(x.created_at));return a
}
async function runSearch(){
 const f=getFilters();const a=filterProps(f);$("resultCount").textContent=`${a.length} نتيجة`;renderPropertyCards(a);
 const meaningful=Object.entries(f).some(([k,v])=>k!=="sort"&&v);
 if(meaningful){searchHistory=[f,...searchHistory.filter(x=>JSON.stringify(x)!==JSON.stringify(f))].slice(0,10);localStorage.setItem("wa_search_history",JSON.stringify(searchHistory));if(sb&&user)await sb.from("search_history").insert({user_id:user.id,label:historyLabel(f),query:f})}
 renderHistory()
}
function clearSearch(){["searchText","searchRooms","searchBaths","searchMinPrice","searchMaxPrice"].forEach(id=>$(id).value="");["searchArea","searchStatus","searchType","searchSalon","searchBalcony"].forEach(id=>$(id).value="");$("sortBy").value="new";runSearch()}
function historyLabel(f){return [f.text,f.area,f.status,f.type,f.rooms?f.rooms+"غرف":"",f.baths?f.baths+"حمامات":""].filter(Boolean).join(" • ")||"كل الشقق"}
function renderHistory(){const el=$("searchHistory");el.innerHTML=searchHistory.length?searchHistory.map((f,i)=>`<button data-history="${i}">${esc(historyLabel(f))}</button>`).join(""):"";el.querySelectorAll("[data-history]").forEach(b=>b.onclick=()=>{const f=searchHistory[+b.dataset.history];Object.keys(f).forEach(k=>{const el=$(searchKey(k));if(el)el.value=f[k]||""});runSearch()})}
function searchKey(k){return {text:"searchText",area:"searchArea",status:"searchStatus",type:"searchType",rooms:"searchRooms",baths:"searchBaths",salon:"searchSalon",balcony:"searchBalcony",min:"searchMinPrice",max:"searchMaxPrice",sort:"sortBy"}[k]}
function renderPropertyCards(a,target="propertyGrid"){
 const el=$(target);el.innerHTML=a.length?a.map(p=>card(p)).join(""):`<div class="panel">لا توجد شقق مطابقة للبحث.</div>`;
 el.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openProperty(b.dataset.open));
 el.querySelectorAll("[data-wa]").forEach(b=>b.onclick=()=>shareWhatsApp(b.dataset.wa));
}
function card(p){
 const imgs=Array.isArray(p.images)?p.images:[];const img=p.primary_image||imgs[0]||"";
 return `<article class="property-card"><div class="property-image">${img?`<img src="${esc(img)}" alt="">`:""}<span class="status ${statusClass(near(p)?"قريبة من التوفر":p.status)}">${esc(near(p)?"قريبة من التوفر":p.status)}</span><span class="image-count">📷 ${imgs.length}</span></div><div class="property-body"><h3>${esc(p.title)}</h3><div class="code">#${esc(p.code)} • ${esc(p.owner_name||"")}</div><div class="facts"><div class="fact">🛏 ${fmt(p.rooms)}</div><div class="fact">🛁 ${fmt(p.bathrooms)}</div><div class="fact">📐 ${fmt(p.size)}م²</div><div class="fact">💰 ${fmt(p.price)}</div></div><div class="actions"><button class="btn ghost" data-open="${p.id}">التفاصيل</button><button class="btn whatsapp" data-wa="${p.id}">🟢 واتساب</button></div></div></article>`
}
function renderProperties(){runSearch()}
function renderAdminProperties(){renderPropertyCards(properties,"propertyAdminGrid")}
function renderTenants(){ $("tenantList").innerHTML=`<table class="data-table"><thead><tr><th>الاسم</th><th>الهاتف</th><th>الهوية</th><th>الشقة</th><th>ملاحظات</th></tr></thead><tbody>${tenants.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.phone)}</td><td>${esc(t.id_number)}</td><td>${esc(properties.find(p=>p.id===t.property_id)?.code||"-")}</td><td>${esc(t.notes)}</td></tr>`).join("")}</tbody></table>`}
function renderContracts(){ $("contractList").innerHTML=`<table class="data-table"><thead><tr><th>الشقة</th><th>المستأجر</th><th>البداية</th><th>النهاية</th><th>الإيجار</th><th>التأمين</th></tr></thead><tbody>${contracts.map(c=>`<tr><td>${esc(properties.find(p=>p.id===c.property_id)?.code||"-")}</td><td>${esc(tenants.find(t=>t.id===c.tenant_id)?.name||"-")}</td><td>${esc(c.start_date||"")}</td><td>${esc(c.end_date||"")}</td><td>${fmt(c.rent)}</td><td>${fmt(c.deposit)}</td></tr>`).join("")}</tbody></table>`}
function renderAlerts(){const a=properties.filter(near);$("alertList").innerHTML=a.length?a.map(p=>`<div class="panel" style="margin-bottom:10px;border-color:#7d2934"><b>🔴 ${esc(p.title)} — #${esc(p.code)}</b><p>تاريخ التوفر: ${esc(p.available_date)} • الأيام المتبقية: ${Math.max(0,daysTo(p.available_date))}</p><button class="btn gold small" data-open="${p.id}">فتح الشقة</button></div>`).join(""):"<div class='panel'>لا توجد تنبيهات حالياً.</div>";$("alertList").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openProperty(b.dataset.open))}
function renderReports(){const total=properties.length,available=properties.filter(p=>p.status==="متاحة").length,rented=properties.filter(p=>p.status==="مؤجرة").length,nearN=properties.filter(near).length;$("reportCards").innerHTML=[["إجمالي الشقق",total],["متاحة",available],["مؤجرة",rented],["قريبة من التوفر",nearN]].map(x=>`<div class="stat"><span>${x[0]}</span><b>${fmt(x[1])}</b></div>`).join("")}
async function renderAdmins(){
 const el=$("adminsList"); if(!sb){el.innerHTML="";return}
 const {data}=await sb.from("profiles").select("*").order("created_at");const list=data||[];
 el.innerHTML=`<table class="data-table"><thead><tr><th>الاسم</th><th>الدور</th><th>الصلاحيات</th></tr></thead><tbody>${list.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${x.role==="owner"?"المالك":"مدير"}</td><td>${x.role==="owner"?"كاملة":"محددة حسب الصلاحيات"}</td></tr>`).join("")}</tbody></table>`;
}
async function renderMessages(){if(!sb){$("messages").innerHTML="";return}const {data}=await sb.from("messages").select("*").order("created_at");$("messages").innerHTML=(data||[]).map(m=>`<div class="message ${m.user_id===user?.id?"mine":""}"><b>${esc(m.sender_name)}</b><div>${esc(m.body)}</div></div>`).join("")}
async function sendMessage(e){e.preventDefault();const body=$("chatText").value.trim();if(!body)return;await sb.from("messages").insert({user_id:user.id,sender_name:profile.full_name||user.email,body});$("chatText").value="";renderMessages()}
function renderProfile(){$("profileInfo").innerHTML=`<p><b>الاسم:</b> ${esc(profile?.full_name||"")}</p><p><b>البريد:</b> ${esc(user?.email||"")}</p><p><b>الصلاحية:</b> ${profile?.role==="owner"?"المالك":"مدير"}</p>`}
async function addArea(e){e.preventDefault();const name=$("areaName").value.trim();if(!name)return;const {error}=await sb.from("areas").insert({name});if(error)return toast(error.message);$("areaName").value="";await loadAll();toast("تمت إضافة المنطقة")}
async function saveSettings(){settings.alertDays=Number($("defaultAlertDays").value||7);settings.whatsapp=$("whatsappNumber").value.trim();localStorage.setItem("wa_settings",JSON.stringify(settings));toast("تم حفظ الإعدادات")}
function renderAreas(){$("areasList").innerHTML=areas.map(a=>`<div class="area-chip"><span>${esc(a.name)}</span><button class="btn small danger" data-del-area="${a.id}">حذف</button></div>`).join("");$("areasList").querySelectorAll("[data-del-area]").forEach(b=>b.onclick=async()=>{if(confirm("حذف المنطقة؟")){await sb.from("areas").delete().eq("id",b.dataset.delArea);await loadAll()}})}
function openModal(html){$("modalBody").innerHTML=html;$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden");$("modalBody").innerHTML=""}
function openProperty(id=null){
 if(id){const p=properties.find(x=>x.id===id);if(!p)return;const imgs=Array.isArray(p.images)?p.images:[];openModal(propertyForm(p,imgs));bindPropertyForm(p.id,imgs);return}
 openModal(propertyForm({},[]));bindPropertyForm(null,[])
}
function propertyForm(p,imgs){return `<h2>${p.id?"تعديل الشقة":"إضافة شقة"}</h2><form id="propertyForm" class="form-grid">
<label>الكود<input name="code" required value="${esc(p.code||"")}"></label><label>العنوان/الاسم<input name="title" value="${esc(p.title||"شقة")}"></label>
<label>المالك<input name="owner_name" value="${esc(p.owner_name||"")}"></label><label>المنطقة<select name="area">${areas.map(a=>`<option ${a.name===p.area?"selected":""}>${esc(a.name)}</option>`).join("")}</select></label>
<label class="full">العنوان<input name="address" value="${esc(p.address||"")}"></label><label>نوع العقار<select name="property_type">${["شقة","فيلا","دوبلكس","استوديو"].map(x=>`<option ${x===p.property_type?"selected":""}>${x}</option>`).join("")}</select></label>
<label>الحالة<select name="status">${["متاحة","محجوزة","مؤجرة","تحت الصيانة"].map(x=>`<option ${x===p.status?"selected":""}>${x}</option>`).join("")}</select></label>
<label>السعر<input name="price" type="number" value="${esc(p.price||0)}"></label><label>المساحة م²<input name="size" type="number" value="${esc(p.size||0)}"></label>
<label>الغرف<input name="rooms" type="number" min="0" value="${esc(p.rooms||0)}"></label><label>الحمامات<input name="bathrooms" type="number" min="0" value="${esc(p.bathrooms||0)}"></label>
<label>صالون/صالة<select name="salon"><option ${p.salon==="نعم"?"selected":""}>نعم</option><option ${p.salon!=="نعم"?"selected":""}>لا</option></select></label><label>بلكونة<select name="balcony"><option ${p.balcony==="نعم"?"selected":""}>نعم</option><option ${p.balcony!=="نعم"?"selected":""}>لا</option></select></label>
<label>بداية العقد<input name="start_date" type="date" value="${esc(p.start_date||"")}"></label><label>نهاية العقد<input name="end_date" type="date" value="${esc(p.end_date||"")}"></label>
<label>تاريخ التوفر<input name="available_date" type="date" value="${esc(p.available_date||"")}"></label><label>أيام التنبيه<input name="alert_days" type="number" min="0" value="${esc(p.alert_days??settings.alertDays??7)}"></label>
<label>رقم واتساب<input name="whatsapp" value="${esc(p.whatsapp||"")}"></label><label>رابط الفيديو<input name="video_url" value="${esc(p.video_url||"")}"></label>
<label class="full">الوصف<textarea name="description" rows="4">${esc(p.description||"")}</textarea></label>
<div class="full upload-zone"><b>الصور JPG / PNG / WEBP — رفع متعدد</b><input id="propertyImages" type="file" accept="image/jpeg,image/png,image/webp" multiple><div id="thumbs" class="thumbs"></div></div>
<div class="full"><button class="btn gold wide" type="submit">حفظ الشقة والوسائط</button></div></form>`}
function bindPropertyForm(id,oldImgs){
 const input=$("propertyImages"),thumbs=$("thumbs"),files=[];
 function draw(){thumbs.innerHTML=oldImgs.map((u,i)=>`<span class="thumb-wrap"><img class="thumb ${i===0?"primary":""}" src="${esc(u)}"><button type="button" data-remove="${i}">×</button></span>`).join("")+files.map((f,i)=>`<span class="thumb-wrap"><img class="thumb" src="${URL.createObjectURL(f)}"><button type="button" data-newremove="${i}">×</button></span>`).join("");thumbs.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{oldImgs.splice(+b.dataset.remove,1);draw()});thumbs.querySelectorAll("[data-newremove]").forEach(b=>b.onclick=()=>{files.splice(+b.dataset.newremove,1);draw()})}
 input.onchange=e=>{files.push(...e.target.files);draw();input.value=""};draw();
 $("propertyForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target),data=Object.fromEntries(fd.entries());data.price=Number(data.price||0);data.size=Number(data.size||0);data.rooms=Number(data.rooms||0);data.bathrooms=Number(data.bathrooms||0);data.alert_days=Number(data.alert_days||settings.alertDays||7);
 const uploaded=[];for(const f of files){const path=`properties/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;const up=await sb.storage.from("property-media").upload(path,f,{upsert:false});if(up.error)return toast("فشل رفع صورة: "+up.error.message);const pub=sb.storage.from("property-media").getPublicUrl(path);uploaded.push(pub.data.publicUrl)}
 data.images=[...oldImgs,...uploaded];data.primary_image=data.images[0]||"";
 let res=id?await sb.from("properties").update(data).eq("id",id):await sb.from("properties").insert(data);if(res.error)return toast(res.error.message);closeModal();await loadAll();toast("تم حفظ الشقة والصور بنجاح")}
}
function openTenant(){openModal(`<h2>إضافة مستأجر</h2><form id="tenantForm" class="form-grid"><label>الاسم<input name="name" required></label><label>الهاتف<input name="phone"></label><label>رقم الهوية<input name="id_number"></label><label>الشقة<select name="property_id"><option value="">بدون</option>${properties.map(p=>`<option value="${p.id}">#${esc(p.code)}</option>`).join("")}</select></label><label class="full">ملاحظات<textarea name="notes"></textarea></label><button class="btn gold full">حفظ</button></form>`);$("tenantForm").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(sb){const {error}=await sb.from("tenants").insert(d);if(error)return toast(error.message);await loadAll()}closeModal()}}
function openContract(){openModal(`<h2>إضافة عقد</h2><form id="contractForm" class="form-grid"><label>الشقة<select name="property_id">${properties.map(p=>`<option value="${p.id}">#${esc(p.code)}</option>`).join("")}</select></label><label>المستأجر<select name="tenant_id">${tenants.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label><label>البداية<input name="start_date" type="date"></label><label>النهاية<input name="end_date" type="date"></label><label>الإيجار<input name="rent" type="number"></label><label>التأمين<input name="deposit" type="number"></label><label class="full">ملاحظات<textarea name="notes"></textarea></label><button class="btn gold full">حفظ العقد</button></form>`);$("contractForm").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.rent=Number(d.rent||0);d.deposit=Number(d.deposit||0);if(sb){const {error}=await sb.from("contracts").insert(d);if(error)return toast(error.message);await loadAll()}closeModal()}}
function openAdmin(){openModal(`<h2>إضافة مدير</h2><p class="muted">إنشاء مستخدم Auth جديد يحتاج دعوة/إنشاء من Supabase Authentication. من هنا يمكن تسجيل بيانات الصلاحيات بعد إنشاء الحساب.</p><form id="adminForm"><label>UUID المستخدم<input name="id" required></label><label>اسم المدير<input name="full_name" required></label><label>الدور<select name="role"><option value="admin">مدير</option><option value="owner">مالك</option></select></label><label>الصلاحيات JSON<textarea name="permissions" rows="5">{}</textarea></label><button class="btn gold wide">حفظ الصلاحيات</button></form>`);$("adminForm").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));try{d.permissions=JSON.parse(d.permissions)}catch{return toast("صيغة الصلاحيات غير صحيحة")}if(sb){const {error}=await sb.from("profiles").upsert(d);if(error)return toast(error.message);await renderAdmins();closeModal()}}}
async function changePassword(){const html=`<h2>تغيير كلمة المرور</h2><form id="pwForm"><label>كلمة المرور الجديدة<input name="password" type="password" minlength="6" required></label><label>تأكيد كلمة المرور<input name="confirm" type="password" minlength="6" required></label><button class="btn gold wide">تغيير</button></form>`;openModal(html);$("pwForm").onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(d.password!==d.confirm)return toast("كلمتا المرور غير متطابقتين");const {error}=await sb.auth.updateUser({password:d.password});if(error)return toast(error.message);closeModal();toast("تم تغيير كلمة المرور")}
}
async function shareWhatsApp(id){
 const p=properties.find(x=>x.id===id); if(!p)return;

 const text=`🏠 *عقارات غرب عمّان*

🏢 *${p.title||"شقة"}* — #${p.code||"-"}
📍 المنطقة: ${p.area||"-"}
📌 العنوان: ${p.address||"-"}
💰 السعر: ${fmt(p.price)} دينار
🛏 الغرف: ${p.rooms||0}
🛁 الحمامات: ${p.bathrooms||0}
🛋 الصالون: ${p.salon||"غير محدد"}
🌤 البلكونة: ${p.balcony||"غير محدد"}
📐 المساحة: ${fmt(p.size)} م²
🏷 الحالة: ${p.status||"-"}
📅 التوفر: ${p.available_date||"متاح حسب الحالة"}

📝 ${p.description||"للمزيد من التفاصيل تواصل معنا."}`;

 const imgs=(Array.isArray(p.images)?p.images:[]).filter(Boolean).slice(0,10);

 // مشاركة أصلية من الهاتف: عند اختيار WhatsApp تُرسل الصور كصور فعلية مع النص.
 if(typeof navigator!=="undefined" && typeof navigator.share==="function"){
   try{
     const files=[];
     for(let i=0;i<imgs.length;i++){
       try{
         const r=await fetch(imgs[i],{mode:"cors",cache:"no-store"});
         if(!r.ok)continue;
         const blob=await r.blob();
         if(!blob.type.startsWith("image/"))continue;
         const ext=(blob.type.split("/")[1]||"jpeg").replace("jpeg","jpg");
         files.push(new File([blob],`عقار-${p.code||"شقة"}-${i+1}.${ext}`,{type:blob.type}));
       }catch(_){}
     }
     const data=files.length
       ? {title:p.title||"عقارات غرب عمّان",text,files}
       : {title:p.title||"عقارات غرب عمّان",text};

     if(!files.length || !navigator.canShare || navigator.canShare({files})){
       await navigator.share(data);
       return;
     }
   }catch(e){
     if(e && e.name==="AbortError")return;
   }
 }

 // احتياط للمتصفحات التي لا تدعم مشاركة الملفات: النص فقط.
 const phone=(p.whatsapp||settings.whatsapp||"").replace(/\D/g,"");
 location.href=phone
   ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
   : `https://wa.me/?text=${encodeURIComponent(text)}`;
}
function exportData(){const data={exportedAt:new Date().toISOString(),properties,areas,tenants,contracts,settings};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="west-amman-backup.json";a.click()}
async function importData(e){const f=e.target.files[0];if(!f||!sb)return;try{const d=JSON.parse(await f.text());if(d.areas?.length)for(const x of d.areas)await sb.from("areas").upsert({name:x.name});if(d.properties?.length)for(const x of d.properties){delete x.id;await sb.from("properties").upsert(x,{onConflict:"code"})}if(d.tenants?.length)for(const x of d.tenants){delete x.id;await sb.from("tenants").insert(x)}if(d.contracts?.length)for(const x of d.contracts){delete x.id;await sb.from("contracts").insert(x)}await loadAll();toast("تمت الاستعادة")}catch(err){toast("ملف النسخة غير صالح")}}
init();