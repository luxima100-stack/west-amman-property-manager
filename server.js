const express=require("express");
const path=require("path");
const app=express();
const PORT=process.env.PORT||10000;
const ROOT=__dirname;
const SUPABASE_URL=(process.env.SUPABASE_URL||"").replace(/\/+$/,"");
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const OWNER_EMAIL=(process.env.OWNER_EMAIL||"").trim().toLowerCase();
const BUCKET=process.env.SUPABASE_BUCKET||"property-media";
app.disable("x-powered-by");
app.use(express.json({limit:"25mb"}));
app.use(express.urlencoded({extended:true,limit:"25mb"}));
function cfg(){if(!SUPABASE_URL||!SERVICE_KEY)throw new Error("Supabase environment variables are missing.");}
async function sb(pathname,opt={}){cfg();const r=await fetch(SUPABASE_URL+pathname,{...opt,headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",...(opt.headers||{})}});const text=await r.text();let d=null;try{d=text?JSON.parse(text):null}catch{d=text}if(!r.ok){const e=new Error(d?.message||d?.msg||d?.error_description||d?.error||text||("HTTP "+r.status));e.status=r.status;throw e}return d}
function bearer(req){const h=String(req.headers.authorization||"");return h.startsWith("Bearer ")?h.slice(7).trim():""}
async function currentUser(req){const token=bearer(req);if(!token)return null;try{const u=await sb("/auth/v1/user",{headers:{Authorization:`Bearer ${token}`}});if(!u?.id)return null;const rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=*`);const p=rows?.[0];return p&&["owner","admin"].includes(p.role)?{...p,authUser:u,token}:null}catch{return null}}
async function staff(req,res,next){const u=await currentUser(req);if(!u)return res.status(401).json({ok:false,error:"انتهت الجلسة أو الحساب غير مصرح به."});req.staff=u;next()}
async function owner(req,res,next){const u=await currentUser(req);if(!u||u.role!=="owner")return res.status(403).json({ok:false,error:"هذه العملية متاحة للمالك فقط."});req.staff=u;next()}

app.get("/api/health",(_req,res)=>res.json({ok:true,service:"west-amman-property-manager",supabaseConfigured:Boolean(SUPABASE_URL&&SERVICE_KEY)}));
app.post("/api/login",async(req,res)=>{
  try{
    const email=String(req.body?.email||"").trim().toLowerCase();
    const password=String(req.body?.password||"");
    if(!email||!password)return res.status(400).json({ok:false,message:"أدخل البريد الإلكتروني وكلمة المرور."});
    const auth=await sb("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
    const id=auth?.user?.id;
    if(!id)return res.status(401).json({ok:false,message:"بيانات الدخول غير صحيحة."});
    let rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=*`);
    let profile=rows?.[0];
    if(!profile){
      const all=await sb("/rest/v1/profiles?select=id&limit=1");
      if(!all?.length || (OWNER_EMAIL && email===OWNER_EMAIL)){
        const inserted=await sb("/rest/v1/profiles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,full_name:auth.user?.user_metadata?.name||"المالك",role:"owner",permissions:{all:true}})});
        profile=inserted?.[0];
      } else return res.status(403).json({ok:false,message:"هذا الحساب غير مصرح به."});
    }
    if(!profile||!["owner","admin"].includes(profile.role))return res.status(403).json({ok:false,message:"هذا الحساب غير مصرح به."});
    res.json({ok:true,token:auth.access_token,user:{id:profile.id,email,name:profile.full_name||email,full_name:profile.full_name||email,role:profile.role,permissions:profile.permissions||{}}});
  }catch(e){res.status(e.status===400||e.status===401?401:500).json({ok:false,message:e.message||"تعذر تسجيل الدخول."})}
});

app.post("/api/admin/create",owner,async(req,res)=>{try{const name=String(req.body?.name||"").trim(),email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");if(!name||!email||password.length<6)return res.status(400).json({ok:false,message:"أكمل الاسم والبريد وكلمة مرور لا تقل عن 6 أحرف."});const created=await sb("/auth/v1/admin/users",{method:"POST",body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});const id=created?.id||created?.user?.id;if(!id)throw new Error("تعذر إنشاء حساب المدير.");const permissions=Array.isArray(req.body?.permissions)?req.body.permissions.filter(x=>["dashboard","properties","tenants","reports","settings","admins","messages","backup"].includes(x)):["dashboard","properties"];const rows=await sb("/rest/v1/profiles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,full_name:name,role:"admin",permissions})});res.json({ok:true,user:rows?.[0]||{id,full_name:name,role:"admin",permissions}})}catch(e){res.status(e.status===422?409:(e.status||500)).json({ok:false,message:e.status===422?"البريد مستخدم بالفعل.":e.message})}});
app.get("/api/admins",staff,async(req,res)=>{try{res.json(await sb("/rest/v1/profiles?select=*&order=created_at.asc"))}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post("/api/owner/change-password",owner,async(req,res)=>{try{const password=String(req.body?.password||"");if(password.length<6)return res.status(400).json({ok:false,error:"كلمة المرور يجب أن تكون 6 أحرف على الأقل."});await sb(`/auth/v1/admin/users/${encodeURIComponent(req.staff.id)}`,{method:"PUT",body:JSON.stringify({password})});res.json({ok:true})}catch(e){res.status(e.status||500).json({ok:false,error:e.message})}});
/* ---------- Generic data API used by the browser client ---------- */
const DATA_TABLES=new Set(["profiles","properties","areas","tenants","contracts","messages","search_history"]);
app.all("/api/data/:table",staff,async(req,res)=>{
  const table=req.params.table;
  if(!DATA_TABLES.has(table)) return res.status(404).json({error:"جدول غير مسموح."});
  try{
    const q=[];
    for(const [k,v] of Object.entries(req.query||{})){ if(k!=="order") q.push(`${encodeURIComponent(k)}=eq.${encodeURIComponent(v)}`); }
    if(req.query.order){const [k,dir]=String(req.query.order).split('.');q.push(`order=${encodeURIComponent(k)}.${dir==='desc'?'desc':'asc'}`)}
    const base=`/rest/v1/${table}`;
    let method=req.method, body=req.body;
    if(method==='GET'){
      const rows=await sb(base+`?select=*${q.length?'&'+q.join('&'):''}`);
      return res.json(rows||[]);
    }
    if(method==='POST'){
      const prefer=req.headers.prefer||'return=representation';
      const rows=await sb(base+`?${q.join('&')}`,{method:'POST',headers:{Prefer:prefer},body:JSON.stringify(body||{})});
      return res.json(rows||[]);
    }
    if(method==='PATCH'){
      if(!q.length)return res.status(400).json({error:"يجب تحديد السجل."});
      const rows=await sb(base+`?${q.join('&')}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body||{})});
      return res.json(rows||[]);
    }
    if(method==='DELETE'){
      if(!q.length)return res.status(400).json({error:"يجب تحديد السجل."});
      await sb(base+`?${q.join('&')}`,{method:'DELETE'}); return res.json([]);
    }
    return res.status(405).json({error:"طريقة غير مدعومة."});
  }catch(e){res.status(e.status||500).json({error:e.message||"تعذر تنفيذ العملية."})}
});

/* ---------- Image upload to Supabase Storage ---------- */
app.post("/api/upload",staff,async(req,res)=>{
  try{
    const request=new Request(`http://localhost${req.originalUrl}`,{method:"POST",headers:req.headers,body:req,duplex:"half"});
    const form=await request.formData();
    const files=form.getAll("images").filter(x=>x&&typeof x.arrayBuffer==="function").slice(0,10);
    if(!files.length)return res.json({ok:true,urls:[]});
    const urls=[];
    for(const file of files){
      const type=String(file.type||"");
      if(!["image/jpeg","image/png","image/webp"].includes(type))continue;
      const ext=type==="image/png"?"png":type==="image/webp"?"webp":"jpg";
      const safe=String(file.name||"image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80);
      const objectPath=`properties/${Date.now()}-${Math.random().toString(36).slice(2,10)}-${safe.replace(/\.[^.]+$/,'')}.${ext}`;
      const bytes=Buffer.from(await file.arrayBuffer());
      const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeURIComponent(objectPath)}`,{method:"POST",headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,"Content-Type":type,"x-upsert":"true"},body:bytes});
      const txt=await r.text(); if(!r.ok)throw new Error(txt||`فشل رفع الصورة (${r.status})`);
      urls.push(`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${objectPath}`);
    }
    res.json({ok:true,urls});
  }catch(e){console.error("UPLOAD_ERROR",e);res.status(500).json({ok:false,error:e.message||"تعذر رفع الصور."})}
});
app.use(express.static(ROOT,{index:"index.html"}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager running on ${PORT}`));