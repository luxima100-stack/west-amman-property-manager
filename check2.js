
let token=localStorage.getItem("wa_token"),me=null,D=null,page="home",search="";
try{me=JSON.parse(localStorage.getItem("wa_me")||"null")}catch(e){localStorage.removeItem("wa_me");localStorage.removeItem("wa_token");token=null;me=null}
const statuses=["متاحة","قريبة من التوفر","الحجز ينتهي قريباً","مؤجرة / محجوزة","غير متاحة / صيانة"];
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
async function api(url,opt={}){opt.headers={...(opt.headers||{}),Authorization:"Bearer "+token};if(opt.body&&!opt.headers["Content-Type"])opt.headers["Content-Type"]="application/json";let r=await fetch(url,opt);let j=await r.json();if(!r.ok)throw Error(j.error||"خطأ");return j}
function login(){ $("root").innerHTML=`<div class="login"><div class="loginbox"><div class="logo">⌂</div><h1>إدارة عقارات غرب عمّان</h1><p class="muted" style="text-align:center">النظام النهائي — هاتف وكمبيوتر</p><div class="demo"><b>بيانات التجربة:</b><br>owner / 1234 — مالك<br>admin / 1234 — مدير<br>user / 1234 — عرض فقط</div><div class="field"><label>اسم المستخدم</label><input id="lu" autocomplete="username" value="owner"></div><div class="field"><label>كلمة المرور</label><div class="v541-password-box"><input id="lp" autocomplete="current-password" type="password" value="1234"><button type="button" class="v541-eye" onclick="toggleLoginPassword()">👁️</button></div></div><div id="loginError" class="notice danger-note" style="display:none;margin-top:10px"></div><button id="loginBtn" class="btn primary" style="width:100%;margin-top:10px" onclick="doLogin()">تسجيل الدخول</button></div></div>`}
function toggleLoginPassword(){const x=$("lp");if(!x)return;x.type=x.type==="password"?"text":"password";const b=document.querySelector(".v541-eye");if(b)b.textContent=x.type==="password"?"👁️":"🙈";}
async function doLogin(){const btn=$("loginBtn"),err=$("loginError");try{
 const username=($("lu")?.value||"").trim(),password=$("lp")?.value||"";
 if(!username||!password)throw Error("يرجى إدخال اسم المستخدم وكلمة المرور");
 if(btn){btn.disabled=true;btn.textContent="جاري تسجيل الدخول…"}
 const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({username,password})});
 const raw=await r.text();let j={};try{j=JSON.parse(raw)}catch{throw Error("تعذر الاتصال بخادم تسجيل الدخول")}
 if(!r.ok||!j.token)throw Error(j.error||"اسم المستخدم أو كلمة المرور غير صحيحة");
 token=j.token;me=j.user;
 localStorage.setItem("wa_token",token);localStorage.setItem("wa_me",JSON.stringify(me));
 await load();
}catch(e){if(err){err.textContent=e.message||"تعذر تسجيل الدخول";err.style.display="block"}else alert(e.message);if(btn){btn.disabled=false;btn.textContent="تسجيل الدخول"}}}{try{let j=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:lu.value,password:lp.value})}).then(r=>r.json());if(!j.token)throw Error(j.error);token=j.token;me=j.user;localStorage.setItem("wa_token",token);localStorage.setItem("wa_me",JSON.stringify(me));await load()}catch(e){alert(e.message)}}
async function load(){
 if(!token||!me){return login();}
 try{D=await api("/api/bootstrap");render();}
 catch(e){localStorage.removeItem("wa_token");localStorage.removeItem("wa_me");token=null;me=null;login();}
}
function nav(p){page=p;search="";render()}
function role(){return me.role==="owner"?"المالك":me.role==="admin"?"مسؤول النظام":"مستخدم عادي"}
function shell(){let titles={home:"الرئيسية",apartments:"الشقق والعقارات",tenants:"المستأجرون والعقود",finance:"الدفعات والمالية",users:"المستخدمون والصلاحيات",logs:"سجل العمليات",security:"النسخ الاحتياطي والحماية",chat:"محادثة المالك وAdmin"};$("root").innerHTML=`<div class="app"><aside class="side"><div class="brand"><div class="logo v513-logo3d v539-logo"><img src="/west-amman-luxury-logo.jpg" alt="عقارات عمان الغربية"></div><div><b>عقارات غرب عمّان</b><br><small>نظام الإدارة</small></div></div><div class="nav">
<button class="${page==="home"?"active":""}" onclick="nav('home')">⌂ الرئيسية</button><button class="${page==="apartments"?"active":""}" onclick="nav('apartments')">▦ الشقق</button><button class="${page==="tenants"?"active":""}" onclick="nav('tenants')">♙ المستأجرون</button><button class="${page==="finance"?"active":""}" onclick="nav('finance')">د.أ المالية</button><button class="${page==="users"?"active":""}" onclick="nav('users')">◉ الصلاحيات</button><button class="${page==="logs"?"active":""}" onclick="nav('logs')">◷ السجل</button>${["owner","admin"].includes(me.role)?`<button class="${page==="chat"?"active":""}" onclick="nav('chat')">💬 المحادثة</button>`:""}<button onclick="logout()">↪ خروج</button></div></aside><main class="main"><div class="top"><h2>${titles[page]}</h2><div class="user">${role()} <div class="avatar">${me.role==="owner"?"♛":"●"}</div></div></div><div class="content">${view()}</div><footer>نظام إدارة عقارات غرب عمّان • PWA • SQLite</footer></main></div>`}
function view(){return page==="home"?home():page==="apartments"?apartments():page==="tenants"?tenants():page==="finance"?finance():page==="users"?users():page==="chat"?chat():page==="security"?securityBackupPage():logs()}
function home(){
 let st=D.stats||{}, money=Number(D.money?.total||0).toLocaleString();
 let apartments=(D.apartments||[]).slice(0,6);
 return `<div class="lux-home">
  <section class="lux-hero">
   <div class="lux-hero-copy">
    <span class="lux-kicker">عقارات غرب عمّان</span>
    <h1>خيــارك الأفضل لحياة أرقى</h1>
    <p>شقق • فلل • مكاتب • أراضي</p>
    <button class="btn lux-gold" onclick="nav('apartments')">استكشف العقارات</button>
   </div>
  </section>
  <section class="lux-trust">
   <div><b>♛</b><span>تصميم فاخر<br><small>وسهولة استخدام</small></span></div>
   <div><b>⌂</b><span>عقارات موثوقة<br><small>بأفضل الأسعار</small></span></div>
   <div><b>⬟</b><span>عروض مميزة<br><small>ومحدثة باستمرار</small></span></div>
   <div><b>⌖</b><span>جميع مناطق<br><small>عمان الغربية</small></span></div>
  </section>
  <section class="lux-search panel">
   <div class="lux-search-row">
    <div><label>نوع العقار</label><select><option>الكل</option><option>شقة</option><option>فيلا</option><option>مكتب</option><option>أرض</option></select></div>
    <div><label>المنطقة</label><select><option>جميع المناطق</option></select></div>
    <div><label>عدد الغرف</label><select><option>الكل</option><option>1</option><option>2</option><option>3</option><option>4+</option></select></div>
    <div><label>عدد الحمامات</label><select><option>الكل</option><option>1</option><option>2</option><option>3+</option></select></div>
    <button class="btn lux-gold lux-search-btn" onclick="nav('apartments')">بحث 🔎</button>
   </div>
   <button class="btn ghost lux-advanced" onclick="nav('apartments')">⌄ بحث متقدم</button>
  </section>
  <section class="lux-section">
   <div class="lux-title"><span></span><h2>أحدث العقارات</h2><span></span></div>
   <div class="lux-cards">${apartments.map(card).join("")||'<div class="empty">لا توجد عقارات مضافة بعد</div>'}</div>
  </section>
  <section class="lux-trust lux-bottom">
   <div><b>🛡</b><span>أمان وخصوصية<br><small>لحماية بياناتك</small></span></div>
   <div><b>♧</b><span>خدمة عملاء<br><small>على مدار الساعة</small></span></div>
   <div><b>✦</b><span>عقارات مميزة<br><small>بأفضل الأسعار</small></span></div>
   <div><b>✓</b><span>جميع العروض<br><small>موثقة ومعتمدة</small></span></div>
  </section>
  <footer class="lux-footer"><b>عقارات عمّان الغربية</b><span>© جميع الحقوق محفوظة</span><span>واتساب • Instagram • Facebook</span></footer>
 </div>`;
}
function card(a){
 let photos=D.documents.filter(d=>d.apartment_id===a.id&&d.kind==='صورة شقة');
 let videos=D.documents.filter(d=>d.apartment_id===a.id&&d.kind==='فيديو شقة');
 let src=photos[0]?.filename?`/uploads/${encodeURIComponent(photos[0].filename)}`:"";
 let img=src?`<div class="lux-card-photo"><img src="${src}" alt="صورة العقار"><span class="lux-photo-count">▣ ${photos.length}</span>${videos.length?`<span class="lux-video-count">▶ ${videos.length}</span>`:""}</div>`:`<div class="lux-card-photo lux-no-photo">عقارات غرب عمّان</div>`;
 return `<article class="card lux-card" data-apartment-id="${a.id}">${img}<div class="lux-card-body"><div class="lux-status">${badge(a.status)}</div><h3>${esc(a.title||'شقة')} ${esc(a.number||'')}</h3><div class="lux-location">⌖ ${esc(a.area||'عمان الغربية')}</div><div class="lux-price">${Number(a.rent||0).toLocaleString()} د.أ <small>شهرياً</small></div><div class="lux-specs"><span>▧ ${a.size_m2||0}م²</span><span>▤ ${a.rooms||0} غرف</span><span>♨ ${a.baths||0} حمام</span></div><div class="lux-card-actions"><button class="btn lux-gold" onclick="editA(${a.id})">عرض التفاصيل</button><button class="btn lux-wa" onclick="shareWA(${a.id})">واتساب ☎</button></div></div></article>`;
}
function apartments(){return `<div class="panel"><div class="head"><h3>إدارة العقارات</h3>${me.role!=="user"?'<button class="btn primary" onclick="addA()">＋ إضافة شقة</button>':""}</div><div class="toolbar"><input id="aq" placeholder="بحث برقم الشقة أو المنطقة..." oninput="drawA()"><select id="af" onchange="drawA()"><option value="">كل المناطق</option>${D.areas.map(a=>`<option>${esc(a.name)}</option>`).join("")}</select><select id="as" onchange="drawA()"><option value="">كل الحالات</option>${statuses.map(s=>`<option>${s}</option>`).join("")}</select><button class="btn ghost" onclick="location.href='/api/export/apartments.csv'">تصدير CSV</button></div><div class="notice" style="margin-top:10px">حالة الشقة تظهر الآن بمربع واضح بلون مميز: <span class="status-square available">متاحة</span> <span class="status-square reserved">مؤجرة / محجوزة</span> <span class="status-square repair">صيانة</span></div><div id="alist" class="cards" style="margin-top:16px"></div></div><div class="panel"><div class="head"><h3>مناطق غرب عمّان</h3><span class="muted">${D.areas.length} منطقة/حي</span></div><div class="cards">${D.areas.map(a=>`<div class="card"><b>${esc(a.name)}</b><div class="meta">منطقة متاحة للإسناد إلى الشقق</div></div>`).join("")}</div></div>`}
function drawA(){let q=($("aq")?.value||"").toLowerCase(),ar=$("af")?.value||"",st=$("as")?.value||"";let x=D.apartments.filter(a=>(a.number+" "+a.area).toLowerCase().includes(q)&&(!ar||a.area===ar)&&(!st||a.status===st));$("alist").innerHTML=x.length?x.map(card).join(""):'<div class="empty">لا توجد نتائج</div>'}
function aForm(a={}){return `<div class="formgrid"><div class="field"><label>رقم الشقة</label><input id="an" value="${esc(a.number)}"></div><div class="field"><label>المنطقة</label><select id="aa">${D.areas.map(x=>`<option value="${x.id}" ${(x.id===a.area_id||x.name===a.area)?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div><div class="field"><label>الحالة</label><select id="ast">${statuses.map(s=>`<option ${s===a.status?"selected":""}>${s}</option>`).join("")}</select></div><div class="field"><label>الإيجار الشهري (د.أ)</label><input id="ar" type="number" value="${a.rent||0}"></div><div class="field"><label>المساحة (م²)</label><input id="az" type="number" value="${a.size_m2||0}"></div><div class="field"><label>الغرف</label><input id="ro" type="number" value="${a.rooms||2}"></div><div class="field"><label>الحمامات</label><input id="ba" type="number" value="${a.baths||1}"></div><div class="field"><label>الطابق</label><input id="fl" type="number" value="${a.floor||1}"></div><div class="field full"><label>ملاحظات</label><textarea id="no">${esc(a.notes)}</textarea></div></div>`}
function addA(){modal(`<div class="modalhead"><h3>إضافة شقة جديدة</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div>${aForm()}<button class="btn primary" style="margin-top:14px" onclick="saveA()">حفظ</button>`)}
function editA(id){let a=D.apartments.find(x=>x.id===id);let photos=D.documents.filter(d=>d.apartment_id===id&&d.kind==='صورة شقة');let videos=D.documents.filter(d=>d.apartment_id===id&&d.kind==='فيديو شقة');modal(`<div class="modalhead"><h3>الشقة ${esc(a.number)}</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div>${aForm(a)}${me.role==="owner"?`<div class="v55-share-row"><button class="v55-share-btn v55-share-details" onclick="shareApartmentDetails(${id})">📝 مشاركة التفاصيل كصورة</button></div>`:""}<div class="panel" style="margin-top:14px;padding:14px"><div class="head"><h3>📷 صور الشقة</h3><span class="muted">${photos.length} صورة • حتى 30 صورة في الرفع الواحد</span></div>${me.role==="owner"&&photos.length?`<button class="v55-share-btn v55-share-photos" onclick="shareApartmentPhotos(${id})">🖼 مشاركة الصور</button>`:""}${me.role!=="user"?`<input id="apPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="uploadApartmentPhotos(${id})">`:""}<div id="photos_${id}" class="photos">${photos.length?photos.map((p,i)=>photoHtml(p,i)).join(""): '<div class="photoempty full">لا توجد صور لهذه الشقة</div>'}</div></div><div class="panel" style="margin-top:14px;padding:14px"><div class="head"><h3>🎥 فيديو الشقة</h3><span class="muted">${videos.length} فيديو</span></div>${me.role!=="user"?`<label class="btn ghost" style="display:inline-flex;align-items:center;gap:6px">🎥 تحميل فيديو الشقة<input id="apVideo" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" onchange="uploadApartmentVideo(${id})" style="display:none"></label>`:""}${videos.length?videos.map(videoHtml).join(""):'<div class="photoempty">لا يوجد فيديو لهذه الشقة</div>'}
</div><div style="display:flex;gap:8px;margin-top:14px"><button class="btn primary" onclick="saveA(${id})">حفظ</button>${me.role==="owner"?`<button class="btn danger" onclick="delA(${id})">حذف</button>`:""}</div>`)}
function photoHtml(d,i){return `<div class="photo" data-apartment="${d.apartment_id}" onclick="openApartmentGallery(${d.apartment_id},${i})"><img src="/uploads/${encodeURIComponent(d.filename)}" alt="${esc(d.original_name)}"><button onclick="event.stopPropagation();deletePhoto(${d.id})">حذف</button></div>`}
function videoHtml(d){return `<div class="video-wrap v55-video-card" onclick="openMiniVideo(${d.apartment_id})"><div class="v55-video-play-label">▶ تشغيل مصغر</div><video class="v55-video-thumb" muted playsinline preload="metadata" src="/uploads/${encodeURIComponent(d.filename)}"></video><div class="row" onclick="event.stopPropagation()"><span class="muted">${esc(d.original_name)}</span><div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn ghost" onclick="openMiniVideo(${d.apartment_id})">▶ تشغيل</button>${me.role==="owner"?`<button class="v55-share-btn v55-share-video" onclick="shareApartmentVideo(${d.apartment_id})">🎥 مشاركة الفيديو</button>`:""}${me.role!=="user"?`<button class="btn danger" onclick="deleteVideo(${d.id},${d.apartment_id})">حذف</button>`:""}</div></div></div>`}


async function shareMediaFiles(id, kind){
  try{
    if(me?.role!=="owner"){alert("المشاركة متاحة للمالك فقط");return;}
    const docs=D.documents.filter(d=>d.apartment_id===id && d.kind===kind);
    if(!docs.length){alert(kind==="صورة شقة"?"لا توجد صور لهذه الشقة":"لا يوجد فيديو لهذه الشقة");return;}

    const files=[];
    for(const d of docs){
      const r=await fetch("/uploads/"+encodeURIComponent(d.filename),{credentials:"same-origin"});
      if(!r.ok) continue;
      const blob=await r.blob();
      let type=blob.type;
      if(!type){
        const ext=(d.filename||"").toLowerCase().split(".").pop();
        type=kind==="صورة شقة" ? (ext==="png"?"image/png":ext==="webp"?"image/webp":"image/jpeg")
                               : (ext==="webm"?"video/webm":"video/mp4");
      }
      files.push(new File([blob],d.original_name||d.filename,{type}));
    }
    if(!files.length) throw Error("لم يتم تجهيز الملفات");

    if(navigator.share && navigator.canShare && navigator.canShare({files})){
      await navigator.share({
        title: kind==="صورة شقة" ? "صور الشقة" : "فيديو الشقة",
        files
      });
      return;
    }

    // Fallback: open the first media so the user can use the device's share menu.
    const u=URL.createObjectURL(files[0]);
    const a=document.createElement("a"); a.href=u; a.download=files[0].name; a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
    alert("متصفحك لا يدعم مشاركة الوسائط مباشرة. تم تجهيز الملف الأول للمشاركة من الجهاز.");
  }catch(e){
    if(e?.name==="AbortError") return;
    console.error(e);
    alert("تعذر مشاركة الوسائط. تأكد من السماح للمتصفح بالمشاركة ثم جرّب مرة أخرى.");
  }
}
function detailsLinesForApartment(a){
  return [
    `الكود: ${a.number||"—"}`,
    `المنطقة: ${a.area||"—"}`,
    `الحالة: ${a.status||"—"}`,
    `الغرف: ${a.rooms||0} | الحمامات: ${a.baths||0}`,
    `الصالات: ${a.living_rooms||0} | الصالونات: ${a.salons||0} | البلكونات: ${a.balconies||0}`,
    `المساحة: ${a.size_m2||0} م² | الطابق: ${a.floor||0}`,
    `الإيجار: ${Number(a.rent||0).toLocaleString()} د.أ / شهر`,
    `موعد التوفر: ${a.availability_date||"غير محدد"}`,
    `الملاحظات: ${a.notes||"—"}`
  ];
}

function openMiniVideo(id){
  const videos=D.documents.filter(d=>d.apartment_id===id&&d.kind==="فيديو شقة");
  if(!videos.length){alert("لا يوجد فيديو لهذه الشقة");return;}
  const p=videos[0];
  const box=document.createElement("div");
  box.className="v55-video-modal";
  box.innerHTML=`
    <div class="v55-video-panel">
      <button class="v55-video-close" aria-label="إغلاق">×</button>
      <div class="v55-video-title">🎥 فيديو الشقة</div>
      <video class="v55-mini-video" controls autoplay playsinline preload="metadata"
        src="/uploads/${encodeURIComponent(p.filename)}"></video>
    </div>`;
  document.body.appendChild(box);
  const v=box.querySelector("video");
  box.querySelector(".v55-video-close").onclick=()=>{v.pause();box.remove()};
  box.onclick=e=>{if(e.target===box){v.pause();box.remove()}};
}

async function uploadApartmentVideo(id){try{let input=$("apVideo");if(!input.files.length)return;let fd=new FormData();fd.append("video",input.files[0]);let r=await fetch("/api/apartments/"+id+"/video",{method:"POST",headers:{Authorization:"Bearer "+token},body:fd});let j=await r.json();if(!r.ok)throw Error(j.error||"فشل رفع الفيديو");alert("تم رفع الفيديو بنجاح");await load();editA(id)}catch(e){alert(e.message)}}
async function deleteVideo(id,apartmentId){if(!confirm("حذف فيديو الشقة؟"))return;try{await api("/api/documents/"+id,{method:"DELETE"});await load();editA(apartmentId)}catch(e){alert(e.message)}}

async function shareFilesForApartment(id, kind){
  try{
    if(me?.role!=="owner"){alert("المشاركة متاحة للمالك فقط");return;}
    const a=D.apartments.find(x=>x.id===id);
    if(!a) throw Error("الشقة غير موجودة");
    let docs=[];
    let title="";
    if(kind==="photos"){
      docs=D.documents.filter(d=>d.apartment_id===id&&d.kind==="صورة شقة");
      title=`صور شقة ${a.number}`;
      if(!docs.length){alert("لا توجد صور لهذه الشقة");return;}
    }else if(kind==="video"){
      docs=D.documents.filter(d=>d.apartment_id===id&&d.kind==="فيديو شقة");
      title=`فيديو شقة ${a.number}`;
      if(!docs.length){alert("لا يوجد فيديو لهذه الشقة");return;}
    }

    if(!navigator.share){
      const links=docs.map(d=>location.origin+"/uploads/"+encodeURIComponent(d.filename));
      await navigator.clipboard.writeText(links.join("\\n"));
      alert("تم نسخ روابط الملفات. متصفحك لا يدعم مشاركة الملفات مباشرة.");
      return;
    }

    const files=[];
    for(const d of docs){
      const r=await fetch("/uploads/"+encodeURIComponent(d.filename),{credentials:"same-origin"});
      if(!r.ok) continue;
      const blob=await r.blob();
      const fallbackType=kind==="video"?"video/mp4":"image/jpeg";
      files.push(new File([blob],d.original_name||d.filename,{type:blob.type||fallbackType}));
    }

    if(files.length && navigator.canShare && navigator.canShare({files})){
      await navigator.share({title,files});
    }else{
      const links=docs.map(d=>location.origin+"/uploads/"+encodeURIComponent(d.filename));
      await navigator.share({title,text:links.join("\\n")});
    }
  }catch(e){
    if(e?.name==="AbortError") return;
    alert("تعذر مشاركة الملف. جرّب مرة أخرى.");
  }
}

async function shareApartmentPhotos(id){return shareFilesForApartment(id,"photos")}
async function shareApartmentVideo(id){return shareFilesForApartment(id,"video")}

async function shareApartmentDetails(id){
  try{
    if(me?.role!=="owner"){alert("المشاركة متاحة للمالك فقط");return;}
    const a=D.apartments.find(x=>x.id===id);
    if(!a) throw Error("الشقة غير موجودة");
    const text=[
      `🏠 شقة ${a.number}`,
      `المنطقة: ${a.area||"—"}`,
      `الحالة: ${a.status||"—"}`,
      `الغرف: ${a.rooms||0} | الحمامات: ${a.baths||0}`,
      `الصالات: ${a.living_rooms||0} | الصالونات: ${a.salons||0} | البلكونات: ${a.balconies||0}`,
      `المساحة: ${a.size_m2||0} م² | الطابق: ${a.floor||0}`,
      `الإيجار: ${Number(a.rent||0).toLocaleString()} د.أ / شهر`,
      `الملاحظات: ${a.notes||"—"}`
    ].join("\\n");
    if(navigator.share){
      await navigator.share({title:`تفاصيل شقة ${a.number}`,text});
    }else{
      await navigator.clipboard.writeText(text);
      alert("تم نسخ تفاصيل الشقة.");
    }
  }catch(e){
    if(e?.name==="AbortError") return;
    alert("تعذر مشاركة التفاصيل.");
  }
}

function openApartmentGallery(apartmentId,index){
  const photos=D.documents.filter(d=>d.apartment_id===apartmentId&&d.kind==="صورة شقة");
  if(!photos.length)return;
  let i=Math.max(0,Math.min(index||0,photos.length-1));
  const box=document.createElement("div");
  box.className="v55-gallery";
  box.innerHTML=`
    <div class="v55-gallery-box">
      <button class="v55-gallery-close" aria-label="إغلاق">×</button>
      <button class="v55-gallery-prev" aria-label="الصورة السابقة">›</button>
      <img class="v55-gallery-img" alt="صورة الشقة">
      <button class="v55-gallery-next" aria-label="الصورة التالية">‹</button>
      <div class="v55-gallery-count"></div>
    </div>`;
  document.body.appendChild(box);
  const img=box.querySelector(".v55-gallery-img");
  const count=box.querySelector(".v55-gallery-count");
  const render=()=>{
    const p=photos[i];
    img.src="/uploads/"+encodeURIComponent(p.filename);
    img.alt=p.original_name||"صورة الشقة";
    count.textContent=`${i+1} / ${photos.length}`;
  };
  const next=()=>{i=(i+1)%photos.length;render()};
  const prev=()=>{i=(i-1+photos.length)%photos.length;render()};
  box.querySelector(".v55-gallery-close").onclick=()=>box.remove();
  box.querySelector(".v55-gallery-next").onclick=next;
  box.querySelector(".v55-gallery-prev").onclick=prev;
  box.onclick=e=>{if(e.target===box)box.remove()};
  document.addEventListener("keydown",function handler(e){
    if(!document.body.contains(box)){document.removeEventListener("keydown",handler);return}
    if(e.key==="Escape"){box.remove();document.removeEventListener("keydown",handler)}
    if(e.key==="ArrowLeft")next();
    if(e.key==="ArrowRight")prev();
  });
  let sx=null;
  img.addEventListener("touchstart",e=>{sx=e.touches[0].clientX},{passive:true});
  img.addEventListener("touchend",e=>{
    if(sx===null)return;
    const dx=e.changedTouches[0].clientX-sx;
    if(Math.abs(dx)>40)(dx<0?next:prev)();
    sx=null;
  },{passive:true});
  render();
}

async function uploadApartmentPhotos(id){try{let input=$("apPhotos");if(!input.files.length)return;let fd=new FormData();[...input.files].forEach(f=>fd.append("photos",f));let r=await fetch("/api/apartments/"+id+"/photos",{method:"POST",headers:{Authorization:"Bearer "+token},body:fd});let j=await r.json();if(!r.ok)throw Error(j.error||"فشل رفع الصور");alert("تم رفع الصور بنجاح");await load();editA(id)}catch(e){alert(e.message)}}
async function deletePhoto(id){if(!confirm("حذف هذه الصورة؟"))return;try{await api("/api/documents/"+id,{method:"DELETE"});await load();let d=D.documents.find(x=>x.id===id);if(d)editA(d.apartment_id);else closeM();}catch(e){alert(e.message)}}
async function saveA(id){try{let b={number:an.value,area_id:+aa.value,status:ast.value,rent:+ar.value,size_m2:+az.value,rooms:+ro.value,baths:+ba.value,kitchen:1,floor:+fl.value,notes:no.value};await api(id?"/api/apartments/"+id:"/api/apartments",{method:id?"PUT":"POST",body:JSON.stringify(b)});closeM();await load()}catch(e){alert(e.message)}}
async function delA(id){if(!confirm("هل تريد حذف الشقة؟"))return;try{await api("/api/apartments/"+id,{method:"DELETE"});closeM();await load()}catch(e){alert(e.message)}}
function tenants(){return `<div class="panel"><div class="head"><h3>المستأجرون والعقود</h3>${me.role!=="user"?'<button class="btn primary" onclick="addT()">＋ إضافة مستأجر</button>':""}</div><table><thead><tr><th>المستأجر</th><th>الشقة</th><th>الهاتف</th><th>الإيجار</th><th>بداية العقد</th><th>نهاية العقد</th><th>الحالة</th></tr></thead><tbody>${D.tenants.map(t=>`<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.apartment||"—")}</td><td>${esc(t.phone)}</td><td>${Number(t.monthly_rent||0).toLocaleString()}</td><td>${esc(t.contract_start||"—")}</td><td>${esc(t.contract_end||"—")}</td><td>${badge(t.status)}</td></tr>`).join("")||'<tr><td colspan="7" class="empty">لا يوجد مستأجرون</td></tr>'}</tbody></table></div>`}
function addT(){modal(`<div class="modalhead"><h3>إضافة مستأجر وعقد</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div><div class="formgrid"><div class="field"><label>الاسم</label><input id="tn"></div><div class="field"><label>الهاتف</label><input id="tp"></div><div class="field"><label>رقم الهوية</label><input id="tid"></div><div class="field"><label>الشقة</label><select id="ta"><option value="">بدون</option>${D.apartments.map(a=>`<option value="${a.id}">${a.number} — ${a.area}</option>`).join("")}</select></div><div class="field"><label>بداية العقد</label><input id="cs" type="date"></div><div class="field"><label>نهاية العقد</label><input id="ce" type="date"></div><div class="field"><label>الإيجار الشهري</label><input id="tr" type="number"></div><div class="field"><label>التأمين</label><input id="dep" type="number"></div><div class="field full"><label>ملاحظات</label><textarea id="tnote"></textarea></div></div><button class="btn primary" style="margin-top:14px" onclick="saveT()">حفظ</button>`)}
async function saveT(){try{await api("/api/tenants",{method:"POST",body:JSON.stringify({name:tn.value,phone:tp.value,national_id:tid.value,apartment_id:ta.value?+ta.value:null,contract_start:cs.value,contract_end:ce.value,monthly_rent:+tr.value,deposit:+dep.value,status:"نشط",notes:tnote.value})});closeM();await load()}catch(e){alert(e.message)}}
function finance(){return `<div class="panel"><div class="head"><h3>الدفعات والتحصيل</h3>${me.role!=="user"?'<button class="btn primary" onclick="addP()">＋ تسجيل دفعة</button>':""}</div><div class="stats"><div class="stat"><div class="n">${Number(D.money?.total||0).toLocaleString()}</div><div class="l">إجمالي دفعات الشهر د.أ</div></div></div><table><thead><tr><th>التاريخ</th><th>المستأجر</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th></tr></thead><tbody>${D.payments.map(p=>`<tr><td>${esc(p.payment_date)}</td><td>${esc(p.tenant||"—")}</td><td><b>${Number(p.amount).toLocaleString()} د.أ</b></td><td>${esc(p.method)}</td><td>${esc(p.reference||"—")}</td></tr>`).join("")||'<tr><td colspan="5" class="empty">لا توجد دفعات</td></tr>'}</tbody></table></div>`}
function addP(){modal(`<div class="modalhead"><h3>تسجيل دفعة</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div><div class="formgrid"><div class="field"><label>المستأجر</label><select id="pt">${D.tenants.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div><div class="field"><label>المبلغ</label><input id="pa" type="number" step="0.01"></div><div class="field"><label>التاريخ</label><input id="pd" type="date" value="${new Date().toISOString().slice(0,30)}"></div><div class="field"><label>طريقة الدفع</label><select id="pm"><option>نقدي</option><option>تحويل بنكي</option><option>إي فواتيركم</option><option>شيك</option></select></div><div class="field"><label>المرجع</label><input id="pr"></div><div class="field full"><label>ملاحظات</label><textarea id="pn"></textarea></div></div><button class="btn primary" style="margin-top:14px" onclick="saveP()">حفظ</button>`)}
async function saveP(){try{await api("/api/payments",{method:"POST",body:JSON.stringify({tenant_id:+pt.value,amount:+pa.value,payment_date:pd.value,method:pm.value,reference:pr.value,notes:pn.value})});closeM();await load()}catch(e){alert(e.message)}}
function chat(){if(!["owner","admin"].includes(me.role))return '<div class="empty">المحادثة متاحة للمالك وAdmin فقط</div>';return `<div class="panel"><div class="head"><div><h3>💬 محادثة داخلية</h3><span class="muted">محادثة خاصة بين المالك وAdmin</span></div><button class="btn ghost" onclick="loadChat()">↻ تحديث</button></div><div id="chatMessages" class="chat-messages"><div class="empty">جاري تحميل الرسائل...</div></div><div class="chatbox" style="margin-top:12px"><textarea id="chatInput" rows="3" maxlength="2000" placeholder="اكتب رسالتك للمالك أو Admin..."></textarea><button class="btn primary" onclick="sendChat()">إرسال الرسالة</button></div></div>`}
async function loadChat(){try{let r=await fetch("/api/messages",{headers:{Authorization:"Bearer "+token}});let j=await r.json();if(!r.ok)throw Error(j.error||"فشل تحميل المحادثة");let box=$("chatMessages");if(!box)return;box.innerHTML=j.length?j.map(m=>`<div class="msg ${m.sender_username===me.username?"mine":""}"><div class="meta2">${esc(m.sender_username)} • ${esc(m.created_at)}</div><div>${esc(m.message)}</div></div>`).join(""):'<div class="empty">لا توجد رسائل بعد</div>';box.scrollTop=box.scrollHeight}catch(e){let box=$("chatMessages");if(box)box.innerHTML=`<div class="notice">${esc(e.message)}</div>`}}
async function sendChat(){let input=$("chatInput");let message=(input?.value||"").trim();if(!message)return;try{await api("/api/messages",{method:"POST",body:JSON.stringify({message})});input.value="";await loadChat()}catch(e){alert(e.message)}}
function users(){return `<div class="panel"><div class="head"><h3>المستخدمون والصلاحيات</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${me.role==="owner"?'<button class="btn primary" onclick="addU()">＋ إضافة مستخدم</button>':""}<button class="btn dark" onclick="changePassword()">🔐 تغيير كلمة المرور</button></div></div><div class="notice">اختر المستخدم لفتح صفحته وتحديد المهام المسموحة له بشكل واضح.</div><div id="usersProfiles" class="v533-user-grid"><div class="empty">جاري تحميل المستخدمين…</div></div></div>`}
async function loadUsersProfiles(){
  const box=document.getElementById('usersProfiles'); if(!box)return;
  try{
    const j=await api('/api/users');
    const list=j.users||j||[];
    box.innerHTML=list.map(u=>`<div class="v533-user-card">
      <div class="v533-user-top"><div><div class="v533-user-name">👤 ${esc(u.username)}</div><div class="v533-user-role">${u.role==='owner'?'مالك':u.role==='admin'?'Admin':'User'} • ${u.active?'مفعّل':'متوقف'}</div></div>
      ${me.role==='owner'&&u.role!=='owner'?`<button class="btn primary" onclick="openUserPermissions(${u.id})">⚙️ الصلاحيات</button>`:''}</div>
      <div class="v533-perm-summary">${u.role==='owner'?'إدارة كاملة':u.role==='admin'?'تحديد مهام Admin من صفحة الصلاحيات':'تحديد أقسام User المسموح له رؤيتها'}</div>
    </div>`).join('')||'<div class="empty">لا يوجد مستخدمون</div>';
  }catch(e){box.innerHTML=`<div class="notice">${esc(e.message)}</div>`}
}
async function openUserPermissions(id){
  try{
    const j=await api('/api/users/'+id+'/permissions');
    const u=j.user;
    const isAdmin=u.role==='admin';
    const items=isAdmin
      ? [['home','الصفحة الرئيسية','السماح بالدخول إلى الصفحة الرئيسية'],['apartments','الشقق والعقارات','إضافة وتعديل وإدارة الشقق'],['tenants','المستأجرون والحجوزات','إدارة المستأجرين والحجوزات'],['finance','الدفعات والمالية','إدارة الدفعات والبيانات المالية'],['chat','المحادثة','الدخول إلى المحادثة'],['logs','سجل العمليات','عرض سجل العمليات']]
      : [['home','الصفحة الرئيسية','السماح بالدخول إلى الصفحة الرئيسية'],['view_apartments','عرض الشقق','مشاهدة الشقق والبحث'],['view_tenants','عرض المستأجرين والحجوزات','مشاهدة بيانات المستأجرين والحجوزات'],['view_finance','عرض الدفعات','مشاهدة الدفعات فقط'],['view_chat','عرض المحادثة','الدخول للمحادثة'],['view_logs','عرض السجل','مشاهدة سجل العمليات']];
    modal(`<div class="modalhead"><h3>صلاحيات ${isAdmin?'Admin':'User'}: ${esc(u.username)}</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div>
      <div class="notice">حدد المهام التي تريد السماح بها لهذا المستخدم. يمكنك الدخول إلى هذه الصفحة وتعديلها في أي وقت.</div>
      <div class="v533-perm-form">${items.map(x=>`<label class="v533-perm-row"><input type="checkbox" data-p="${x[0]}" ${u.permissions?.includes(x[0])?'checked':''} onchange="setUserPermission(${u.id},'${x[0]}',this.checked)"><span><b>${x[1]}</b><small>${x[2]}</small></span></label>`).join('')}</div>
      <button class="btn primary" onclick="closeM()">تم</button>`);
  }catch(e){alert(e.message)}
}
async function setUserPermission(id,permission,enabled){
  try{await api('/api/users/'+id+'/permissions',{method:'PUT',body:JSON.stringify({permission,enabled})});notify(enabled?'تم تفعيل الصلاحية':'تم إلغاء الصلاحية')}
  catch(e){alert(e.message)}
}
function changePassword(){modal(`<div class="modalhead"><h3>تغيير كلمة المرور</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div><div class="notice">الحساب الحالي: <b>${esc(me.username)}</b></div><div class="field"><label>كلمة المرور الحالية</label><input id="cp" type="password" autocomplete="current-password"></div><div class="field"><label>كلمة المرور الجديدة</label><input id="np" type="password" minlength="6" autocomplete="new-password"></div><div class="field"><label>تأكيد كلمة المرور الجديدة</label><input id="np2" type="password" minlength="6" autocomplete="new-password"></div><button class="btn primary" onclick="savePassword()">حفظ كلمة المرور</button>`)}
async function savePassword(){try{if(np.value!==np2.value)throw Error("كلمتا المرور الجديدتان غير متطابقتين");if(np.value.length<6)throw Error("كلمة المرور الجديدة يجب أن تكون 6 أحرف/أرقام على الأقل");await api("/api/change-password",{method:"POST",body:JSON.stringify({currentPassword:cp.value,newPassword:np.value})});closeM();alert("تم تغيير كلمة المرور بنجاح. استخدمها في تسجيل الدخول القادم.")}catch(e){alert(e.message)}}

function addU(){modal(`<div class="modalhead"><h3>إضافة مستخدم</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div><div class="field"><label>اسم المستخدم</label><input id="un"></div><div class="field"><label>كلمة المرور</label><input id="up" type="password"></div><div class="field"><label>الصلاحية</label><select id="ur"><option value="admin">Admin</option><option value="user">User</option></select></div><button class="btn primary" onclick="saveU()">حفظ</button>`)}
async function saveU(){
 try{
  let username=un.value.trim(),role=ur.value;
  if(!username) throw Error("اسم المستخدم مطلوب");
  if(!up.value) throw Error("كلمة المرور مطلوبة");
  let j=await api("/api/users",{method:"POST",body:JSON.stringify({username,password:up.value,role})});
  closeM(); render();
  if(role!=="owner" && j.id) setTimeout(()=>openUserPermissions(j.id),100);
  else alert("تم إنشاء المستخدم");
 }catch(e){alert(e.message)}
}
function logs(){return `<div class="panel"><div class="head"><h3>سجل العمليات</h3></div><div class="timeline">${D.logs.map(l=>`<div class="event"><b>${esc(l.action)}</b> — ${esc(l.detail)}<br><small>${esc(l.created_at)} • ${esc(l.who)}</small></div>`).join("")||'<div class="empty">لا توجد عمليات</div>'}</div></div>`}
function modal(x){
  const box=$("modalbox");
  box.innerHTML=x;
  const old=box.querySelector(".mobile-modal-close"); if(old) old.remove();
  const close=document.createElement("button");
  close.type="button"; close.className="mobile-modal-close"; close.setAttribute("aria-label","إغلاق نافذة التفاصيل"); close.title="إغلاق"; close.textContent="×";
  close.onclick=closeM;
  box.prepend(close);
  $("modal").classList.add("show");
  document.body.style.overflow="hidden";
}
function closeM(){$("modal").classList.remove("show");document.body.style.overflow=""}
function logout(){localStorage.clear();token=null;me=null;login()}
function render(){shell();if(page==="apartments")drawA();if(page==="chat")loadChat();if(page==="users")setTimeout(loadUsersProfiles,60)}
window.addEventListener("load",()=>{});
if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
if(token&&me) load(); else login();
