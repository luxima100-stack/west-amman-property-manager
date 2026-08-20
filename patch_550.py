from pathlib import Path
p=Path('/mnt/data/project_new/index.html')
s=p.read_text()
css=r'''
<style id="v550-final-ui">
/* v5.50 calm formal palette: replace remaining gold accents */
:root{--g:#496b8a;--g2:#d9e5ef;--n:#17324a;--n2:#0d2233;--bg:#f3f6f8;--c:#ffffff;--t:#1d2a35;--m:#697986;--line:#dbe3e9;--shadow:0 8px 24px rgba(20,42,58,.09)}
.primary{background:#496b8a!important;color:#fff!important;box-shadow:0 3px 9px rgba(38,67,91,.16)!important}
.side{background:linear-gradient(180deg,#17324a,#0d2233)!important}.nav button:hover,.nav button.active{background:#496b8a22!important;border-right-color:#7ea4c5!important}
.hero{background:linear-gradient(135deg,#17324a,#244c68)!important}.hero small{color:#d9e5ef!important}
.v55-share-photos,.v55-share-details,.v55-share-image{background:#496b8a!important;color:#fff!important}
.v55-share-video{background:#5f7080!important;color:#fff!important}
/* brighter but controlled apartment statuses */
.status-square.available{background:#b9f0d1!important;color:#087548!important;border-color:#70d8a2!important}
.status-square.near{background:#fff0a8!important;color:#806000!important;border-color:#e5c85d!important}
.status-square.soon{background:#b9ddff!important;color:#1766a3!important;border-color:#76b8ef!important}
.status-square.reserved{background:#ffd0b2!important;color:#a84a00!important;border-color:#ee9b68!important}
.status-square.repair{background:#ffc0c6!important;color:#a31f2a!important;border-color:#e97984!important}
.pill.available{background:#b9f0d1!important;color:#087548!important}.pill.near{background:#fff0a8!important;color:#806000!important}.pill.soon{background:#b9ddff!important;color:#1766a3!important}.pill.reserved{background:#ffd0b2!important;color:#a84a00!important}.pill.repair{background:#ffc0c6!important;color:#a31f2a!important}
/* image controls */
.photo-bulk-tools{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px}
.photo-bulk-tools .btn{padding:7px 10px;font-size:12px}
.photo-bulk-check{accent-color:#496b8a}
.photo.selected{outline:2px solid #496b8a;outline-offset:1px}
.upload-panel{margin-top:12px;padding:12px;border:1px solid #dbe3e9;border-radius:14px;background:#f7fafc}
.upload-panel .upload-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
.upload-panel input[type=file]{width:100%;padding:8px;border:1px dashed #aebdca;border-radius:10px;background:#fff}
@media(max-width:600px){
 .nav button{padding:8px 9px;font-size:12px}.nav{gap:3px}.top h2{font-size:15px}.content{padding:10px}.card{padding:11px}.card h4{font-size:16px}.meta{font-size:11px}.btn{padding:7px 10px;font-size:12px}.wa-card-actions .btn{padding:6px 8px;font-size:11px}.status-square{font-size:10px;padding:5px 8px}
}
</style>
'''
if 'id="v550-final-ui"' not in s: s=s.replace('</head>',css+'\n</head>')
old='function addA(){modal(`<div class="modalhead"><h3>إضافة شقة جديدة</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div>${aForm()}<button class="btn primary" style="margin-top:14px" onclick="saveA()">حفظ</button>`)}'
new='''function addA(){modal(`<div class="modalhead"><h3>إضافة شقة جديدة</h3><button class="btn ghost" onclick="closeM()">إغلاق</button></div>${aForm()}<div class="upload-panel"><b>صور الشقة</b><div class="muted" style="margin-top:4px">يمكنك اختيار عدة صور ثم تحديد أو إلغاء تحديد الصور قبل الحفظ.</div><input id="addPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple><div class="upload-actions"><button type="button" class="btn ghost" onclick="selectAddPhotos(true)">تحديد الكل</button><button type="button" class="btn ghost" onclick="selectAddPhotos(false)">إلغاء التحديد</button><button type="button" class="btn danger" onclick="clearAddPhotos()">حذف الاختيار</button><span id="addPhotoCount" class="muted" style="padding:7px">0 صورة محددة</span></div></div><button class="btn primary" style="margin-top:14px" onclick="saveA()">حفظ الشقة والصور</button>`);let f=$('addPhotos');if(f)f.addEventListener('change',()=>updateAddPhotoCount())}'''
s=s.replace(old,new)
old2='async function saveA(id){try{let b={number:an.value,area_id:+aa.value,status:ast.value,rent:+ar.value,size_m2:+az.value,rooms:+ro.value,baths:+ba.value,kitchen:1,floor:+fl.value,notes:no.value};await api(id?"/api/apartments/"+id:"/api/apartments",{method:id?"PUT":"POST",body:JSON.stringify(b)});closeM();await load()}catch(e){alert(e.message)}}'
new2='''async function saveA(id){try{let b={number:an.value,area_id:+aa.value,status:ast.value,rent:+ar.value,size_m2:+az.value,rooms:+ro.value,baths:+ba.value,kitchen:1,floor:+fl.value,notes:no.value};let saved=await api(id?"/api/apartments/"+id:"/api/apartments",{method:id?"PUT":"POST",body:JSON.stringify(b)});let apartmentId=id||saved.id||saved.apartment?.id;if(!apartmentId)throw Error("تم حفظ الشقة لكن تعذر تحديد رقمها لرفع الصور");let input=$(id?"apPhotos":"addPhotos");let files=input?.files?Array.from(input.files).filter(f=>f.type.startsWith("image/")):[];if(files.length){let fd=new FormData();files.forEach(f=>fd.append("photos",f));let r=await fetch("/api/apartments/"+apartmentId+"/photos",{method:"POST",headers:{Authorization:"Bearer "+token},body:fd});let j=await r.json();if(!r.ok)throw Error(j.error||"تعذر رفع الصور")}closeM();await load();notify(files.length?`تم حفظ الشقة ورفع ${files.length} صورة`:`تم حفظ الشقة بنجاح`)}catch(e){alert(e.message)}}'''
s=s.replace(old2,new2)
insert='''\nfunction updateAddPhotoCount(){let f=$("addPhotos"),n=f?.files?.length||0;let x=$("addPhotoCount");if(x)x.textContent=n+" صورة محددة"}\nfunction selectAddPhotos(all){let f=$("addPhotos");if(!f||!f.files.length){alert("اختر الصور أولًا");return}if(all){updateAddPhotoCount()}else{f.value="";updateAddPhotoCount()}}\nfunction clearAddPhotos(){let f=$("addPhotos");if(f){f.value="";updateAddPhotoCount()}}\n'''
pos=s.find('function editA(id)')
s=s[:pos]+insert+s[pos:]
# replace edit photo input section with control panel, preserving existing structure
needle='${me.role!=="user"?`<input id="apPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="uploadApartmentPhotos(${id})">`:""}'
rep='${me.role!=="user"?`<div class="upload-panel"><input id="apPhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple onchange="updateEditPhotoCount(${id})"><div class="upload-actions"><button type="button" class="btn ghost" onclick="selectEditPhotos(${id},true)">تحديد الكل</button><button type="button" class="btn ghost" onclick="selectEditPhotos(${id},false)">إلغاء التحديد</button><button type="button" class="btn primary" onclick="uploadApartmentPhotos(${id})">رفع الصور المحددة</button><button type="button" class="btn danger" onclick="clearEditPhotoSelection(${id})">إلغاء اختيار الملفات</button><span id="editPhotoCount_${id}" class="muted" style="padding:7px">0 صورة محددة</span></div></div>`:""}'
s=s.replace(needle,rep)
extra='''\nfunction updateEditPhotoCount(id){let f=$("apPhotos"),x=$("editPhotoCount_"+id);if(x)x.textContent=(f?.files?.length||0)+" صورة محددة"}\nfunction selectEditPhotos(id,all){let f=$("apPhotos");if(!f||!f.files.length){alert("اختر الصور أولًا");return}if(all)updateEditPhotoCount(id);else clearEditPhotoSelection(id)}\nfunction clearEditPhotoSelection(id){let f=$("apPhotos");if(f){f.value="";updateEditPhotoCount(id)}}\n'''
pos=s.find('async function uploadApartmentPhotos')
s=s[:pos]+extra+s[pos:]
p.write_text(s)
