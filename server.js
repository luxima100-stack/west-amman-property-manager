const express=require('express');
const path=require('path');
const crypto=require('crypto');
const app=express();
const PORT=process.env.PORT||10000;
const ROOT=__dirname;
const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const OWNER_EMAIL=(process.env.OWNER_EMAIL||'').trim().toLowerCase();
const BUCKET=process.env.SUPABASE_BUCKET||'property-images';
app.disable('x-powered-by');
app.use(express.json({limit:'30mb'}));
app.use(express.urlencoded({extended:true,limit:'30mb'}));
const okCfg=()=>!!(SUPABASE_URL&&SERVICE_KEY);
async function sb(p,opt={}){
 if(!okCfg())throw new Error('متغيرات Supabase غير موجودة في Render.');
 const r=await fetch(SUPABASE_URL+p,{...opt,headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',...(opt.headers||{})}});
 const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}
 if(!r.ok){const e=new Error(d?.msg||d?.message||d?.error_description||d?.error||t||`HTTP ${r.status}`);e.status=r.status;e.data=d;throw e}return d;
}
function bearer(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7).trim():''}
async function currentUser(req){
 const token=bearer(req);if(!token)return null;
 try{
  const u=await sb('/auth/v1/user',{headers:{Authorization:`Bearer ${token}`}});
  const rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=id,name,email,role,permissions`);
  const p=rows?.[0];if(!p||!['owner','admin'].includes(p.role))return null;return {...p,token};
 }catch{return null}
}
async function staff(req,res,next){const u=await currentUser(req);if(!u)return res.status(401).json({error:'غير مصرح. سجل الدخول من جديد.'});req.user=u;next()}
async function owner(req,res,next){const u=await currentUser(req);if(!u||u.role!=='owner')return res.status(403).json({error:'هذه العملية متاحة للمالك فقط.'});req.user=u;next()}
function safePerms(a){return Array.isArray(a)?a.filter(x=>['dashboard','properties','tenants','contracts','reports','settings','messages'].includes(x)):['dashboard','properties']}
async function appState(){
 const rows=await sb('/rest/v1/app_state?key=eq.main&select=data');
 return rows?.[0]?.data||{areas:['عبدون','أم أذينة','الرابية','خلدا','دير غبار','دابوق','الصويفية','وادي السير','بيادر وادي السير','أم السماق','تلاع العلي','الشميساني','جبل عمان','العبدلي','مرج الحمام','شارع مكة','الدوار الأول','الدوار الثاني','الدوار الثالث','الدوار الرابع','الدوار الخامس','الدوار السادس'],alertDays:7};
}
async function saveState(data){
 await sb('/rest/v1/app_state?key=eq.main',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({data})});
 return data;
}
app.get('/health',(req,res)=>res.json({ok:true,service:'west-amman-property-manager',version:'FINAL-19.0.0',supabaseConfigured:okCfg()}));

app.post('/api/login',async(req,res)=>{
 try{
  const email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||'');
  if(!email||!password)return res.status(400).json({message:'أدخل البريد الإلكتروني وكلمة المرور.'});
  const a=await sb('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
  const id=a?.user?.id;if(!id)return res.status(401).json({message:'بيانات الدخول غير صحيحة.'});
  let rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,name,email,role,permissions`),p=rows?.[0];
  if(!p){
   const all=await sb('/rest/v1/profiles?select=id&limit=1');
   if(all?.length)return res.status(403).json({message:'هذا الحساب غير مصرح به.'});
   if(OWNER_EMAIL&&email!==OWNER_EMAIL)return res.status(403).json({message:'حساب المالك غير مطابق للإعدادات.'});
   rows=await sb('/rest/v1/profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,name:a.user?.user_metadata?.name||'المالك',email,role:'owner',permissions:['dashboard','properties','tenants','contracts','reports','settings','messages']})});
   p=rows?.[0];
  }
  if(!p||!['owner','admin'].includes(p.role))return res.status(403).json({message:'هذا الحساب غير مصرح به.'});
  res.json({ok:true,token:a.access_token,user:{id:p.id,name:p.name||email,email:p.email||email,role:p.role,permissions:p.permissions||[]}});
 }catch(e){res.status(e.status===400||e.status===401?401:500).json({message:e.message||'تعذر تسجيل الدخول.'})}
});
app.get('/api/public/properties',async(req,res)=>{try{res.json(await sb('/rest/v1/properties?select=*&order=created_at.desc'))}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/properties',staff,async(req,res)=>{try{res.json(await sb('/rest/v1/properties?select=*&order=created_at.desc'))}catch(e){res.status(500).json({error:e.message})}});

function propertyRow(b,images){
 return {code:String(b.code||'').trim(),name:String(b.name||'').trim(),area:String(b.area||'').trim(),status:String(b.status||'متاحة'),floor:b.floor===''||b.floor==null?null:Number(b.floor),area_size:b.areaSize===''||b.areaSize==null?null:Number(b.areaSize),price:Number(b.price||0),rooms:Number(b.rooms||0),baths:Number(b.baths||0),balcony:Boolean(Number(b.balcony||0)),availability_date:b.availabilityDate||null,notes:String(b.notes||''),video_url:String(b.video||''),images:Array.isArray(images)?images.slice(0,10):[]};
}
app.post('/api/properties',staff,async(req,res)=>{try{const b=req.body||{};if(!b.code||!b.name||!b.area)return res.status(400).json({error:'الكود واسم الشقة والمنطقة مطلوبة.'});res.json((await sb('/rest/v1/properties',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(propertyRow(b,b.images))}))?.[0])}catch(e){res.status(e.status||500).json({error:e.message})}});
app.put('/api/properties/:id',staff,async(req,res)=>{try{res.json((await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(propertyRow(req.body||{},req.body?.images))}))?.[0])}catch(e){res.status(e.status||500).json({error:e.message})}});
app.delete('/api/properties/:id',staff,async(req,res)=>{try{await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{method:'DELETE'});res.json({ok:true})}catch(e){res.status(e.status||500).json({error:e.message})}});

app.post('/api/upload',staff,async(req,res)=>{
 try{
  const request=new Request(`http://localhost${req.originalUrl}`,{method:'POST',headers:req.headers,body:req,duplex:'half'});
  const form=await request.formData();const files=form.getAll('images').filter(x=>x&&typeof x.arrayBuffer==='function').slice(0,10);
  const urls=[];
  for(const f of files){
   const type=String(f.type||'');if(!['image/jpeg','image/png','image/webp'].includes(type))continue;
   const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
   const base=String(f.name||'image').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.[^.]+$/,'').slice(0,60);
   const objectPath=`properties/${Date.now()}-${crypto.randomUUID()}.${ext}`;
   const bytes=Buffer.from(await f.arrayBuffer());
   const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${objectPath}`,{method:'POST',headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':type,'x-upsert':'false'},body:bytes});
   const txt=await r.text();if(!r.ok)throw new Error(txt||`فشل رفع الصورة (${r.status})`);
   urls.push(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`);
  }
  res.json({ok:true,urls});
 }catch(e){console.error(e);res.status(500).json({ok:false,error:e.message||'تعذر رفع الصور.'})}
});

app.get('/api/users',staff,async(req,res)=>{try{res.json(await sb('/rest/v1/profiles?select=id,name,email,role,permissions&order=created_at.asc'))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/users',owner,async(req,res)=>{
 try{
  const name=String(req.body?.name||'').trim(),email=String(req.body?.email||'').trim().toLowerCase(),password=String(req.body?.password||'');
  if(!name||!email||password.length<6)return res.status(400).json({error:'أكمل البيانات وكلمة المرور 6 أحرف على الأقل.'});
  const c=await sb('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});
  const id=c?.id||c?.user?.id;if(!id)throw new Error('لم يتم إنشاء حساب المدير.');
  const row=(await sb('/rest/v1/profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,name,email,role:'admin',permissions:safePerms(req.body?.permissions)})}))?.[0];
  res.json(row);
 }catch(e){res.status(e.status||500).json({error:e.message||'تعذر إنشاء المدير.'})}
});
app.post('/api/admin/create',owner,async(req,res)=>{req.body={...req.body,permissions:safePerms(req.body?.permissions)};try{
 const c=await sb('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email:String(req.body.email).trim().toLowerCase(),password:String(req.body.password),email_confirm:true,user_metadata:{name:String(req.body.name||'')}})});
 const id=c?.id||c?.user?.id;if(!id)throw new Error('لم يتم إنشاء الحساب.');
 const row=(await sb('/rest/v1/profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,name:String(req.body.name||''),email:String(req.body.email).trim().toLowerCase(),role:'admin',permissions:req.body.permissions})}))?.[0];res.json({ok:true,user:row});
}catch(e){res.status(e.status||500).json({ok:false,message:e.message})}});
app.patch('/api/users/:id/password',owner,async(req,res)=>{
 try{const password=String(req.body?.password||'');if(password.length<6)return res.status(400).json({error:'كلمة المرور يجب أن تكون 6 أحرف أو أكثر.'});
 await sb(`/auth/v1/admin/users/${encodeURIComponent(req.params.id)}`,{method:'PUT',body:JSON.stringify({password})});res.json({ok:true})}
 catch(e){res.status(e.status||500).json({error:e.message||'تعذر تغيير كلمة السر.'})}
});

app.get('/api/settings',staff,async(req,res)=>{try{res.json(await appState())}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/settings',staff,async(req,res)=>{try{const s=await appState();const n={...s,alertDays:Math.max(0,Number(req.body?.alertDays??s.alertDays))};res.json(await saveState(n))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/areas',staff,async(req,res)=>{try{const name=String(req.body?.name||'').trim();if(!name)return res.status(400).json({error:'أدخل اسم المنطقة.'});const s=await appState();if(!s.areas.includes(name))s.areas.push(name);res.json(await saveState(s))}catch(e){res.status(500).json({error:e.message})}});
app.delete('/api/areas',staff,async(req,res)=>{try{const name=String(req.query.name||'');const s=await appState();s.areas=s.areas.filter(x=>x!==name);res.json(await saveState(s))}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/alerts',staff,async(req,res)=>{try{
 const s=await appState(),rows=await sb('/rest/v1/properties?select=id,code,name,availability_date,status&availability_date=not.is.null&order=availability_date.asc');
 const now=Date.now();const alerts=(rows||[]).map(x=>{const d=new Date(x.availability_date);const days=Math.ceil((d-now)/86400000);return {...x,days_until_available:days}}).filter(x=>x.days_until_available>=0&&x.days_until_available<=Number(s.alertDays||7));
 res.json(alerts);
}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/backup',owner,async(req,res)=>{try{
 const [properties,profiles,settings]=await Promise.all([sb('/rest/v1/properties?select=*'),sb('/rest/v1/profiles?select=id,name,email,role,permissions'),appState()]);
 res.json({version:'FINAL-19.0.0',created_at:new Date().toISOString(),properties,profiles,settings});
}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/reports',staff,async(req,res)=>{try{const p=await sb('/rest/v1/properties?select=status,price,rooms,baths');res.json({total:p.length,available:p.filter(x=>x.status==='متاحة').length,rented:p.filter(x=>x.status==='مؤجرة').length,reserved:p.filter(x=>x.status==='محجوزة').length,averagePrice:p.length?Math.round(p.reduce((a,x)=>a+Number(x.price||0),0)/p.length):0})}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/messages',staff,async(req,res)=>{try{const row=(await sb('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({sender_id:req.user.id,message:String(req.body?.message||'').trim()})}))?.[0];res.json(row)}catch(e){res.status(e.status||500).json({error:e.message})}});


app.get('/api/tenants',staff,async(req,res)=>{try{res.json(await sb('/rest/v1/tenants?select=*&order=created_at.desc'))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/tenants',staff,async(req,res)=>{try{const b=req.body||{};if(!String(b.name||'').trim())return res.status(400).json({error:'اسم المستأجر مطلوب.'});const r=(await sb('/rest/v1/tenants',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({name:String(b.name).trim(),phone:String(b.phone||''),property_code:String(b.property_code||''),notes:String(b.notes||'')})}))?.[0];res.json(r)}catch(e){res.status(e.status||500).json({error:e.message})}});
app.delete('/api/tenants/:id',staff,async(req,res)=>{try{await sb(`/rest/v1/tenants?id=eq.${encodeURIComponent(req.params.id)}`,{method:'DELETE'});res.json({ok:true})}catch(e){res.status(e.status||500).json({error:e.message})}});
app.get('/api/contracts',staff,async(req,res)=>{try{res.json(await sb('/rest/v1/contracts?select=*&order=created_at.desc'))}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/contracts',staff,async(req,res)=>{try{const b=req.body||{};const r=(await sb('/rest/v1/contracts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({property_code:String(b.property_code||''),tenant_name:String(b.tenant_name||''),start_date:b.start_date||null,end_date:b.end_date||null,amount:Number(b.amount||0)})}))?.[0];res.json(r)}catch(e){res.status(e.status||500).json({error:e.message})}});
app.delete('/api/contracts/:id',staff,async(req,res)=>{try{await sb(`/rest/v1/contracts?id=eq.${encodeURIComponent(req.params.id)}`,{method:'DELETE'});res.json({ok:true})}catch(e){res.status(e.status||500).json({error:e.message})}});

app.use(express.static(ROOT,{index:'index.html',extensions:['html']}));
app.get('*splat',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`West Amman Property Manager FINAL-19.0.0 running on ${PORT}`));
