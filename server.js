const express=require('express');
const path=require('path');
const multer=require('multer');
const {createClient}=require('@supabase/supabase-js');

const app=express();
const PORT=process.env.PORT||10000;
const ROOT=__dirname;
const SUPABASE_URL=process.env.SUPABASE_URL||'';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const BUCKET=process.env.SUPABASE_BUCKET||'property-images';

if(!SUPABASE_URL||!SERVICE_KEY) console.warn('Supabase variables are missing. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render.');
const sb=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024}});
app.disable('x-powered-by');
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(express.static(ROOT,{index:'index.html'}));

const ROLE_OK=['owner','admin'];
const perms=['dashboard','properties','tenants','reports','settings','admins','messages'];

function fail(res,e){console.error(e);return res.status(400).json({error:e?.message||'حدث خطأ'});}
async function getProfile(id){
 if(!id)return null;
 const {data,error}=await sb.from('profiles').select('*').eq('id',id).maybeSingle();
 if(error) throw error;
 return data;
}
async function auth(req,res,next){
 try{
  const header=String(req.headers.authorization||'');
  const token=header.startsWith('Bearer ')?header.slice(7):String(req.headers['x-access-token']||'');
  if(!token)return res.status(401).json({error:'يجب تسجيل الدخول'});
  const {data,error}=await sb.auth.getUser(token);
  if(error||!data?.user)return res.status(401).json({error:'انتهت جلسة الدخول، سجّل الدخول مرة أخرى'});
  const u=await getProfile(data.user.id);
  if(!u||!ROLE_OK.includes(u.role))return res.status(403).json({error:'هذا الحساب غير مصرح له بالدخول'});
  req.user=u; req.authUser=data.user; next();
 }catch(e){fail(res,e);}
}
function owner(req,res,next){if(req.user?.role!=='owner')return res.status(403).json({error:'هذه الصلاحية للمالك فقط'});next();}

app.get('/health',(req,res)=>res.json({ok:true,service:'west-amman-property-manager',version:'16.0.0'}));

app.get('/api/public/properties',async(req,res)=>{
 try{
  const q=req.query;
  let query=sb.from('properties').select('id,code,name,area,status,floor,area_size,price,rooms,baths,balcony,availability_date,notes,video_url,images').order('created_at',{ascending:false});
  if(q.area&&q.area!=='الكل')query=query.eq('area',q.area);
  if(q.status&&q.status!=='الكل')query=query.eq('status',q.status);
  if(q.rooms&&q.rooms!=='الكل')query=query.eq('rooms',Number(q.rooms));
  if(q.baths&&q.baths!=='الكل')query=query.eq('baths',Number(q.baths));
  if(q.balcony&&q.balcony!=='الكل')query=query.eq('balcony',q.balcony==='1');
  if(q.minPrice)query=query.gte('price',Number(q.minPrice));
  if(q.maxPrice)query=query.lte('price',Number(q.maxPrice));
  const {data,error}=await query;if(error)throw error;
  let rows=data||[];
  if(q.q){const s=String(q.q).toLowerCase();rows=rows.filter(p=>`${p.name} ${p.code} ${p.area} ${p.notes||''}`.toLowerCase().includes(s));}
  if(q.sort==='priceAsc')rows.sort((a,b)=>Number(a.price)-Number(b.price));
  if(q.sort==='priceDesc')rows.sort((a,b)=>Number(b.price)-Number(a.price));
  res.json(rows);
 }catch(e){fail(res,e);}
});

app.post('/api/login',async(req,res)=>{
 try{
  const {email,password}=req.body||{};
  if(!email||!password)return res.status(400).json({error:'أدخل البريد وكلمة المرور'});
  const {data,error}=await sb.auth.signInWithPassword({email,password});
  if(error) return res.status(401).json({error:'بيانات الدخول غير صحيحة'});
  const profile=await getProfile(data.user.id);
  if(!profile||!ROLE_OK.includes(profile.role)){await sb.auth.signOut();return res.status(403).json({error:'هذا الحساب غير مصرح له بالدخول'});}
  res.json({user:profile,token:data.session.access_token});
 }catch(e){fail(res,e);}
});

app.get('/api/me',auth,(req,res)=>res.json({user:req.user}));
app.post('/api/logout',(req,res)=>res.json({ok:true}));

app.get('/api/properties',auth,async(req,res)=>{
 try{
  const {data,error}=await sb.from('properties').select('*').order('created_at',{ascending:false});
  if(error)throw error;res.json(data||[]);
 }catch(e){fail(res,e);}
});

app.post('/api/properties',auth,async(req,res)=>{
 try{
  const x=req.body||{};
  if(!x.code||!x.name||!x.area)return res.status(400).json({error:'الكود والاسم والمنطقة مطلوبة'});
  const row={code:x.code,name:x.name,area:x.area,status:x.status||'متاحة',floor:x.floor===''?null:Number(x.floor||0),area_size:x.areaSize===''?null:Number(x.areaSize||0),price:Number(x.price||0),rooms:Number(x.rooms||0),baths:Number(x.baths||0),balcony:!!Number(x.balcony||0),availability_date:x.availabilityDate||null,notes:x.notes||'',video_url:x.video||'',images:Array.isArray(x.images)?x.images:[]};
  const {data,error}=await sb.from('properties').insert(row).select().single();if(error)throw error;res.json(data);
 }catch(e){fail(res,e);}
});
app.put('/api/properties/:id',auth,async(req,res)=>{
 try{
  const x=req.body||{};
  const row={code:x.code,name:x.name,area:x.area,status:x.status,floor:x.floor===''?null:Number(x.floor||0),area_size:x.areaSize===''?null:Number(x.areaSize||0),price:Number(x.price||0),rooms:Number(x.rooms||0),baths:Number(x.baths||0),balcony:!!Number(x.balcony||0),availability_date:x.availabilityDate||null,notes:x.notes||'',video_url:x.video||'',images:Array.isArray(x.images)?x.images:[]};
  const {data,error}=await sb.from('properties').update(row).eq('id',req.params.id).select().single();if(error)throw error;res.json(data);
 }catch(e){fail(res,e);}
});
app.delete('/api/properties/:id',auth,async(req,res)=>{
 try{const {error}=await sb.from('properties').delete().eq('id',req.params.id);if(error)throw error;res.json({ok:true});}catch(e){fail(res,e);}
});

app.post('/api/upload',auth,upload.array('images',30),async(req,res)=>{
 try{
  const urls=[];
  for(const f of (req.files||[])){
   if(!['image/jpeg','image/png','image/webp'].includes(f.mimetype))continue;
   const safe=f.originalname.replace(/[^a-zA-Z0-9._-]/g,'-');
   const name=`${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`;
   const {error}=await sb.storage.from(BUCKET).upload(name,f.buffer,{contentType:f.mimetype,upsert:false});
   if(error)throw error;
   const {data}=sb.storage.from(BUCKET).getPublicUrl(name);
   urls.push(data.publicUrl);
  }
  res.json({urls});
 }catch(e){fail(res,e);}
});

app.get('/api/dashboard',auth,async(req,res)=>{
 try{
  const {data,error}=await sb.from('properties').select('status,availability_date');
  if(error)throw error;
  const rows=data||[],soon=rows.filter(p=>p.status!=='متاحة'&&p.availability_date&&new Date(p.availability_date)>=new Date()&&((new Date(p.availability_date)-Date.now())/86400000)<=7).length;
  res.json({total:rows.length,available:rows.filter(x=>x.status==='متاحة').length,rented:rows.filter(x=>x.status==='مؤجرة').length,reserved:rows.filter(x=>x.status==='محجوزة').length,soon});
 }catch(e){fail(res,e);}
});

app.get('/api/users',auth,owner,async(req,res)=>{
 try{const {data,error}=await sb.from('profiles').select('id,name,email,role,permissions,created_at').order('created_at');if(error)throw error;res.json(data||[]);}catch(e){fail(res,e);}
});
app.post('/api/users',auth,owner,async(req,res)=>{
 try{
  const {name,email,password,role,permissions}=req.body||{};
  if(!email||!password||!['owner','admin'].includes(role))return res.status(400).json({error:'بيانات المستخدم غير مكتملة'});
  const {data,error}=await sb.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}});
  if(error)throw error;
  const {data:p,error:pe}=await sb.from('profiles').upsert({id:data.user.id,name:name||email,email,role,permissions:permissions||perms}).select().single();
  if(pe)throw pe;res.json(p);
 }catch(e){fail(res,e);}
});
app.put('/api/users/:id',auth,owner,async(req,res)=>{
 try{
  const x=req.body||{};
  if(x.password){const {error}=await sb.auth.admin.updateUserById(req.params.id,{password:x.password});if(error)throw error;}
  const {data,error}=await sb.from('profiles').update({name:x.name,email:x.email,role:x.role,permissions:x.permissions||perms}).eq('id',req.params.id).select().single();
  if(error)throw error;res.json(data);
 }catch(e){fail(res,e);}
});

app.get('*splat',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));
async function bootstrapUsers(){
 try{
  const users=[
   {email:process.env.BOOTSTRAP_OWNER_EMAIL,password:process.env.BOOTSTRAP_OWNER_PASSWORD,name:'المالك',role:'owner'},
   {email:process.env.BOOTSTRAP_ADMIN_EMAIL,password:process.env.BOOTSTRAP_ADMIN_PASSWORD,name:'مدير النظام',role:'admin'}
  ].filter(x=>x.email&&x.password);
  for(const x of users){
   const {data:list}=await sb.auth.admin.listUsers({page:1,perPage:1000});
   const found=(list?.users||[]).find(u=>u.email?.toLowerCase()===x.email.toLowerCase());
   let id=found?.id;
   if(!id){
    const {data,error}=await sb.auth.admin.createUser({email:x.email,password:x.password,email_confirm:true,user_metadata:{name:x.name}});
    if(error && !String(error.message).toLowerCase().includes('already')) throw error;
    id=data?.user?.id;
   }
   if(id) await sb.from('profiles').upsert({id,name:x.name,email:x.email,role:x.role,permissions:perms});
  }
 }catch(e){console.error('Bootstrap users:',e.message)}
}
bootstrapUsers().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`West Amman v16 running on ${PORT}`)));
