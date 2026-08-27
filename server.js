const express=require("express");
const path=require("path");
const app=express();
const PORT=process.env.PORT||10000;
const ROOT=__dirname;
const SUPABASE_URL=(process.env.SUPABASE_URL||"").replace(/\/+$/,"");
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const BUCKET=process.env.SUPABASE_BUCKET||"property-images";
app.disable("x-powered-by");
app.use(express.json({limit:"25mb"}));
app.use(express.urlencoded({extended:true,limit:"25mb"}));

function cfg(){if(!SUPABASE_URL||!SERVICE_KEY)throw new Error("Supabase غير مهيأ: أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Render.");}
async function sb(p,opt={}){cfg();const r=await fetch(SUPABASE_URL+p,{...opt,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",...(opt.headers||{})}});const t=await r.text();let d={};try{d=t?JSON.parse(t):{}}catch{d={message:t}}if(!r.ok){const e=new Error(d.msg||d.message||d.error_description||d.error||t||`HTTP ${r.status}`);e.status=r.status;throw e}return d}
function bearer(req){const h=String(req.headers.authorization||"");return h.startsWith("Bearer ")?h.slice(7).trim():"";}
async function currentUser(req){const token=bearer(req);if(!token)return null;try{const u=await sb("/auth/v1/user",{headers:{Authorization:"Bearer "+token}});const rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=id,name,email,role,permissions`);const p=rows?.[0];return p&&["owner","admin"].includes(p.role)?{...p,token,authUser:u}:null}catch{return null}}
async function auth(req,res,next){const u=await currentUser(req);if(!u)return res.status(401).json({error:"انتهت الجلسة أو بيانات الدخول غير مصرح بها."});req.user=u;next()}
async function owner(req,res,next){const u=await currentUser(req);if(!u||u.role!=="owner")return res.status(403).json({error:"هذه العملية متاحة للمالك فقط."});req.user=u;next()}

app.post("/api/login",async(req,res)=>{try{const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");if(!email||!password)return res.status(400).json({message:"أدخل البريد الإلكتروني وكلمة المرور."});const a=await sb("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});const id=a?.user?.id;if(!id)return res.status(401).json({message:"بيانات الدخول غير صحيحة."});let rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,name,email,role,permissions`);let p=rows?.[0];if(!p){const exists=await sb("/rest/v1/profiles?select=id&limit=1");if(exists?.length)return res.status(403).json({message:"الحساب موجود لكنه غير مصرح به. أضفه من حساب المالك."});rows=await sb("/rest/v1/profiles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,name:a.user.user_metadata?.name||"المالك",email,role:"owner",permissions:["dashboard","properties","tenants","contracts","reports","settings","admins","messages","backup","profile"]})});p=rows?.[0]}if(!p||!["owner","admin"].includes(p.role))return res.status(403).json({message:"هذا الحساب غير مصرح به."});res.json({ok:true,token:a.access_token,user:{id:p.id,name:p.name||email,email:p.email||email,role:p.role,permissions:p.permissions||[]}})}catch(e){console.error(e);res.status(e.status===400||e.status===401?401:500).json({message:e.message||"تعذر تسجيل الدخول."})}});

app.get("/api/public/properties",async(req,res)=>{try{res.json(await sb("/rest/v1/properties?select=*&order=created_at.desc"))}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/properties",auth,async(req,res)=>{try{res.json(await sb("/rest/v1/properties?select=*&order=created_at.desc"))}catch(e){res.status(500).json({error:e.message})}});

function dataUrlToBuffer(s){const m=String(s||'').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);if(!m) return null;return {type:m[1],buffer:Buffer.from(m[2],'base64')};}
async function saveImages(images,userId){
 const out=[];
 for(let i=0;i<Math.min(10,Array.isArray(images)?images.length:0);i++){
  const item=String(images[i]||'');
  if(!item) continue;
  if(!item.startsWith('data:')){out.push(item);continue;}
  const parsed=dataUrlToBuffer(item); if(!parsed) continue;
  const ext=parsed.type==='image/png'?'png':parsed.type==='image/webp'?'webp':'jpg';
  const pathName=`properties/${encodeURIComponent(String(userId||'user'))}/${Date.now()}-${Math.random().toString(36).slice(2,9)}-${i}.${ext}`;
  const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${pathName}`,{method:'POST',headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':parsed.type,'x-upsert':'true'},body:parsed.buffer});
  const txt=await r.text(); if(!r.ok) throw new Error(txt||`فشل رفع الصورة (${r.status})`);
  out.push(`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${pathName}`);
 }
 return out.slice(0,10);
}
async function cleanProperty(x,userId){return{code:String(x.code||"").trim(),name:String(x.name||"").trim(),area:String(x.area||"").trim(),status:String(x.status||"متاحة"),floor:x.floor===""||x.floor==null?null:Number(x.floor),area_size:x.area_size===""||x.area_size==null?null:Number(x.area_size),price:Number(x.price||0),rooms:Number(x.rooms||0),baths:Number(x.baths||0),balcony:!!x.balcony,availability_date:x.availability_date||null,alert_days:Number(x.alert_days||7),notes:String(x.notes||""),video_url:String(x.video_url||""),images:await saveImages(x.images,userId)}}
app.post("/api/properties",auth,async(req,res)=>{try{const x=await cleanProperty(req.body,req.user.id);if(!x.code||!x.name||!x.area)return res.status(400).json({error:"أكمل الكود والاسم والمنطقة."});const rows=await sb("/rest/v1/properties",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(x)});res.json(rows?.[0]||rows)}catch(e){res.status(e.status||500).json({error:e.message})}});
app.put("/api/properties/:id",auth,async(req,res)=>{try{const rows=await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(await cleanProperty(req.body,req.user.id))});res.json(rows?.[0]||rows)}catch(e){res.status(e.status||500).json({error:e.message})}});
app.delete("/api/properties/:id",owner,async(req,res)=>{try{await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{method:"DELETE"});res.json({ok:true})}catch(e){res.status(e.status||500).json({error:e.message})}});

app.get("/api/users",auth,async(req,res)=>{try{res.json(await sb("/rest/v1/profiles?select=id,name,email,role,permissions&order=created_at.asc"))}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/users",owner,async(req,res)=>{try{const name=String(req.body?.name||"").trim(),email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");if(!name||!email||password.length<6)return res.status(400).json({error:"أكمل البيانات وكلمة المرور 6 أحرف على الأقل."});const created=await sb("/auth/v1/admin/users",{method:"POST",body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});const id=created?.id||created?.user?.id;if(!id)throw new Error("تعذر إنشاء حساب المدير.");const permissions=Array.isArray(req.body?.permissions)?req.body.permissions:["dashboard","properties","tenants","contracts","reports","settings","messages"];const rows=await sb("/rest/v1/profiles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,name,email,role:"admin",permissions})});res.json({ok:true,user:rows?.[0]})}catch(e){res.status(e.status||500).json({error:String(e.message||"تعذر إنشاء المدير.")})}});

app.get("/health",(req,res)=>res.json({ok:true,service:"west-amman-property-manager",supabaseConfigured:!!(SUPABASE_URL&&SERVICE_KEY)}));
app.use(express.static(ROOT,{index:"index.html"}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager on ${PORT}`));