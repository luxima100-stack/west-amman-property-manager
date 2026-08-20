
/* v5.18: production backup + restore panel — owner only */
async function loadBackupPanel(){
  if(me?.role!=='owner') return;
  const box=document.getElementById('backupPanel');
  if(!box) return;
  try{
    const r=await fetch('/api/backup/status',{headers:{Authorization:'Bearer '+token}});
    const j=await r.json();
    if(!r.ok) throw Error(j.error||'تعذر قراءة حالة النسخ الاحتياطي');
    const st=j.state||{};
    const last=st.lastSuccessAt?new Date(st.lastSuccessAt).toLocaleString('ar-JO'):'لم تُنشأ بعد';
    const list=(j.backups||[]).map((b,i)=>`<div class="backup-row"><div><b>${i===0?'أحدث نسخة':'نسخة احتياطية'}</b><div class="muted">${esc(b.name)} • ${(b.size/1024/1024).toFixed(2)} MB</div><small>${new Date(b.created_at).toLocaleString('ar-JO')}</small></div><div style="display:flex;gap:7px;flex-wrap:wrap"><a class="btn ghost" href="/api/backup/download/${encodeURIComponent(b.name)}" target="_blank">⬇ حفظ</a><button class="btn danger backup-restore-btn" data-name="${esc(b.name)}">♻️ استرجاع</button></div></div>`).join('')||'<div class="empty">لا توجد نسخ احتياطية حتى الآن</div>';
    box.innerHTML=`<div class="head"><div><h3>💾 النسخ الاحتياطي والحماية</h3><span class="muted">نسخة تلقائية كل 24 ساعة • الاحتفاظ بآخر 10 نسخ</span></div><button class="btn primary" id="backupNowBtn">إنشاء نسخة الآن</button></div><div class="backup-status-grid"><div><b>آخر نسخة ناجحة</b><span>${esc(last)}</span></div><div><b>عدد النسخ</b><span>${j.backups?.length||0} / 10</span></div><div><b>الحالة</b><span>${st.lastError?'⚠️ يوجد خطأ يحتاج مراجعة':'✅ النسخ الاحتياطي يعمل'}</span></div></div>${st.lastError?`<div class="notice danger-note">${esc(st.lastError)}</div>`:''}<div class="backup-list">${list}</div>`;
    document.getElementById('backupNowBtn')?.addEventListener('click',async()=>{
      if(!(await v58Confirm('إنشاء نسخة احتياطية','سيتم إنشاء نسخة من قاعدة البيانات والصور والملفات المهمة قبل المتابعة.')))return;
      const b=document.getElementById('backupNowBtn'); b.disabled=true; b.textContent='جاري الحفظ…';
      try{const rr=await fetch('/api/backup/now',{method:'POST',headers:{Authorization:'Bearer '+token}});const jj=await rr.json();if(!rr.ok)throw Error(jj.error||'تعذر إنشاء النسخة');notify('تم إنشاء النسخة الاحتياطية بنجاح');await loadBackupPanel()}catch(e){alert(e.message)}finally{if(document.getElementById('backupNowBtn')){document.getElementById('backupNowBtn').disabled=false;document.getElementById('backupNowBtn').textContent='إنشاء نسخة الآن'}}
    });
    box.querySelectorAll('.backup-restore-btn').forEach(btn=>btn.addEventListener('click',async()=>{
      const name=btn.dataset.name;
      if(!(await v58Confirm('استرجاع النسخة الاحتياطية',`سيتم أولًا إنشاء نسخة أمان من الوضع الحالي، ثم استرجاع النسخة: ${name}. سيعاد تشغيل الموقع تلقائيًا بعد الاسترجاع.`)))return;
      if(!confirm('تأكيد نهائي: هل تريد استرجاع هذه النسخة الآن؟'))return;
      btn.disabled=true; btn.textContent='جاري الاسترجاع…';
      try{
        const rr=await fetch('/api/backup/restore/'+encodeURIComponent(name),{method:'POST',headers:{Authorization:'Bearer '+token}});
        const jj=await rr.json();
        if(!rr.ok)throw Error(jj.error||'تعذر استرجاع النسخة');
        notify('تم تجهيز الاسترجاع وسيعاد تشغيل الموقع الآن');
        setTimeout(()=>location.reload(),2500);
      }catch(e){alert(e.message);btn.disabled=false;btn.textContent='♻️ استرجاع'}
    }));
  }catch(e){box.innerHTML=`<div class="notice danger-note">${esc(e.message)}</div>`}
}
const _v517_users=users;
users=function(){
  const base=_v517_users();
  if(me?.role!=='owner') return base;
  return base+`<div class="panel" id="backupPanel" style="margin-top:16px"><div class="empty">جاري تحميل حالة النسخ الاحتياطي…</div></div>`;
};
const _v517_render=render;
render=function(){_v517_render();if(page==='users')loadBackupPanel();};


/* v5.27 final photo controls: bulk delete + restored WhatsApp clear selection */
function photoHtml(d,i){
  return `<div class="photo" data-apartment="${d.apartment_id}" onclick="openApartmentGallery(${d.apartment_id},${i})">
    <label class="photo-select" onclick="event.stopPropagation()" title="تحديد الصورة للحذف">
      <input type="checkbox" class="photo-bulk-check" data-photo-id="${d.id}" data-apartment-id="${d.apartment_id}" onchange="event.stopPropagation()">
      <span>تحديد</span>
    </label>
    <img src="/uploads/${encodeURIComponent(d.filename)}" alt="${esc(d.original_name)}">
    <button onclick="event.stopPropagation();deletePhoto(${d.id})">حذف</button>
  </div>`
}

async function deleteSelectedPhotos(apartmentId){
  if(me?.role!=='owner') return alert('حذف الصور بالجملة متاح للمالك فقط');
  const ids=[...document.querySelectorAll('.photo-bulk-check:checked')]
    .filter(x=>String(x.dataset.apartmentId)===String(apartmentId))
    .map(x=>Number(x.dataset.photoId)).filter(Boolean);
  if(!ids.length) return alert('حدد صورة واحدة على الأقل للحذف');
  if(!(await v58Confirm('تأكيد حذف الصور المحددة',`سيتم حذف ${ids.length} صورة نهائياً. لا يمكن التراجع عن هذا الإجراء.`))) return;
  try{
    for(const id of ids){ await api('/api/documents/'+id,{method:'DELETE'}); }
    await load();
    editA(apartmentId);
    notify(`تم حذف ${ids.length} صورة`);
  }catch(e){alert(e.message)}
}

function toggleAllPhotoSelection(apartmentId,checked){
  document.querySelectorAll(`.photo-bulk-check[data-apartment-id="${apartmentId}"]`).forEach(cb=>cb.checked=checked);
}

function editA(id){
  const a=D.apartments.find(x=>x.id===id),photos=D.documents.filter(d=>d.apartment_id===id&&d.kind==='صورة شقة');
  modal(`<div class="modalhead"><h3>تفاصيل الشقة ${esc(a.number)}</h3><button class="btn ghost" onclick="closeM()">✕ إغلاق</button></div>${aForm(a)}${me.role==='owner'?`<div class="v55-share-row"><button class="btn wa-btn" onclick="shareApartmentDetails(${id})">🟢 WhatsApp — التفاصيل</button></div>`:''}<div class="panel" style="margin-top:14px;padding:14px"><div class="head"><h3>📷 صور الشقة</h3><span class="muted">${photos.length} صورة</span></div>${photos.length?`<div class="photo-bulk-tools"><label class="btn ghost"><input type="checkbox" id="selectAllPhotos_${id}" onchange="toggleAllPhotoSelection(${id},this.checked)" style="margin-left:6px"> تحديد الكل</label>${me.role==='owner'?`<button class="btn danger" onclick="deleteSelectedPhotos(${id})">🗑 حذف الصور المحددة</button>`:''}</div>`:''}${me.role==='owner'&&photos.length?`<button class="btn wa-btn" onclick="shareApartmentPhotos(${id})">🟢 WhatsApp — الصور</button>`:''}${me.role!=='user'?`<input id="apPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="uploadApartmentPhotos(${id})">`:''}<div id="photos_${id}" class="photos">${photos.length?photos.map((p,i)=>photoHtml(p,i)).join(''):'<div class="photoempty full">لا توجد صور لهذه الشقة</div>'}</div></div><div class="v513-export-note">🎥 تم إخفاء قسم الفيديو من تفاصيل الشقة حسب طلبك.</div><div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary" onclick="saveA(${id})">حفظ التعديل</button>${me.role==='owner'?`<button class="btn danger" onclick="delA(${id})">حذف الشقة</button>`:''}</div>`)
}

async function shareApartmentPhotos(id){
  if(me?.role!=='owner')return alert('المشاركة متاحة للمالك فقط');
  const photos=D.documents.filter(d=>d.apartment_id===id&&d.kind==='صورة شقة');
  if(!photos.length)return alert('لا توجد صور لهذه الشقة');
  const box=document.createElement('div'); box.className='wa-picker';
  box.innerHTML=`<div class="wa-picker-box"><div class="modalhead"><h3>🟢 WhatsApp — اختر الصور</h3><button class="btn ghost" id="pc">✕ إغلاق</button></div><div class="notice">حدد الصور التي تريد إرسالها. يمكنك إلغاء تحديد الصور قبل الإرسال.</div><div class="wa-photo-list">${photos.map((p,i)=>`<label class="wa-photo-item"><input type="checkbox" data-i="${i}"><img src="/uploads/${encodeURIComponent(p.filename)}" alt="صورة ${i+1}"></label>`).join('')}</div><div class="wa-range-actions"><button class="btn ghost" id="pa">تحديد الكل</button><button class="btn ghost" id="pcancel">إلغاء تحديد الصور</button><button class="btn wa-btn" id="ps">🟢 WhatsApp — إرسال</button></div><div id="waCount" class="muted" style="margin-top:8px;text-align:center">0 صورة محددة</div></div>`;
  document.body.appendChild(box);
  const update=()=>{const n=box.querySelectorAll('input[type=checkbox]:checked').length;box.querySelector('#waCount').textContent=`${n} صورة محددة`};
  box.querySelector('#pc').onclick=()=>box.remove();
  box.onclick=e=>{if(e.target===box)box.remove()};
  box.querySelector('#pa').onclick=()=>{box.querySelectorAll('input[type=checkbox]').forEach(cb=>{cb.checked=true;cb.closest('.wa-photo-item')?.classList.add('selected')});update()};
  box.querySelector('#pcancel').onclick=()=>{box.querySelectorAll('input[type=checkbox]').forEach(cb=>{cb.checked=false;cb.closest('.wa-photo-item')?.classList.remove('selected')});update()};
  box.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.onchange=()=>{cb.closest('.wa-photo-item')?.classList.toggle('selected',cb.checked);update()});
  box.querySelector('#ps').onclick=async()=>{
    try{
      const chosen=[...box.querySelectorAll('input[type=checkbox]:checked')].map(cb=>photos[+cb.dataset.i]);
      if(!chosen.length)return alert('حدد صورة واحدة على الأقل');
      const files=[];
      for(const d of chosen){const r=await fetch('/uploads/'+encodeURIComponent(d.filename),{credentials:'same-origin',cache:'no-store'});if(r.ok){const b=await r.blob();files.push(new File([b],d.original_name||d.filename,{type:b.type||'image/jpeg'}))}}
      if(!files.length)throw Error('تعذر تجهيز الصور للمشاركة');
      await v511ShareFiles(files,`صور الشقة`);box.remove();
    }catch(e){if(e.name!=='AbortError')alert(e.message)}
  };
}

/* v5.33 authoritative password visibility */
(function(){
  function wirePasswords(){
    document.querySelectorAll('input[type="password"]:not([data-v533-pass])').forEach(function(inp){
      inp.setAttribute('data-v533-pass','1');
      var wrap=inp.parentElement;
      if(!wrap) return;
      wrap.style.position='relative';
      var b=document.createElement('button');
      b.type='button';
      b.className='v533-pass-toggle';
      b.textContent='👁️';
      b.title='إظهار كلمة المرور';
      b.setAttribute('aria-label','إظهار كلمة المرور');
      b.onclick=function(e){
        e.preventDefault();
        var show=inp.type==='password';
        inp.type=show?'text':'password';
        b.textContent=show?'🙈':'👁️';
        b.title=show?'إخفاء كلمة المرور':'إظهار كلمة المرور';
        b.setAttribute('aria-label',b.title);
      };
      wrap.appendChild(b);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',wirePasswords);
  else wirePasswords();
  new MutationObserver(wirePasswords).observe(document.documentElement,{subtree:true,childList:true});
})();


function securityBackupPage(){
  return `<div class="panel v536-security">
    <div class="head"><h3>🔐 النسخ الاحتياطي والحماية</h3><button class="btn ghost" onclick="go('home')">↩ الرئيسية</button></div>
    <div class="notice">هذه الصفحة مخصصة للمالك لإدارة النسخ الاحتياطية وحماية بيانات النظام.</div>
    <div class="v536-sec-grid">
      <div class="v536-sec-card"><h4>💾 النسخ الاحتياطي</h4><p>حفظ نسخة من بيانات النظام والصور قبل التحديثات أو التغييرات الكبيرة.</p>
        <div class="v536-sec-actions">
          ${me?.role==='owner'?'<button class="btn v536-soft" onclick="backupNow()">💾 إنشاء نسخة احتياطية</button>':''}
          ${me?.role==='owner'?'<button class="btn v536-soft" onclick="restoreBackup()">♻️ استعادة نسخة</button>':''}
        </div>
      </div>
      <div class="v536-sec-card"><h4>🛡️ الحماية</h4><p>إدارة كلمات المرور والصلاحيات والوصول إلى النظام.</p>
        <div class="v536-sec-actions">
          ${me?.role==='owner'?'<button class="btn v536-soft" onclick="go(\'users\')">👥 المستخدمون والصلاحيات</button>':''}
          <button class="btn v536-soft" onclick="changePassword()">🔐 تغيير كلمة المرور</button>
        </div>
      </div>
    </div>
  </div>`;
}


function homeAccessControl(){
  if(me?.role==="owner") return true;
  return !!(me?.permissions||[]).includes("home");
}

