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
app.post("/api/admin/create",owner,async(req,res)=>{try{const name=String(req.body?.name||"").trim(),email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");if(!name||!email||password.length<6)return res.status(400).json({ok:false,message:"أكمل الاسم والبريد وكلمة مرور لا تقل عن 6 أحرف."});const created=await sb("/auth/v1/admin/users",{method:"POST",body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});const id=created?.id||created?.user?.id;if(!id)throw new Error("تعذر إنشاء حساب المدير.");const permissions=Array.isArray(req.body?.permissions)?req.body.permissions.filter(x=>["dashboard","properties","tenants","reports","settings","admins","messages","backup"].includes(x)):["dashboard","properties"];const rows=await sb("/rest/v1/profiles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,full_name:name,name,email,role:"admin",permissions})});res.json({ok:true,user:rows?.[0]||{id,name,email,role:"admin",permissions}})}catch(e){res.status(e.status===422?409:(e.status||500)).json({ok:false,message:e.status===422?"البريد مستخدم بالفعل.":e.message})}});
app.get("/api/admins",staff,async(req,res)=>{try{res.json(await sb("/rest/v1/profiles?select=*&order=created_at.asc"))}catch(e){res.status(500).json({ok:false,error:e.message})}});
app.post("/api/owner/change-password",owner,async(req,res)=>{try{const password=String(req.body?.password||"");if(password.length<6)return res.status(400).json({ok:false,error:"كلمة المرور يجب أن تكون 6 أحرف على الأقل."});await sb(`/auth/v1/admin/users/${encodeURIComponent(req.staff.id)}`,{method:"PUT",body:JSON.stringify({password})});res.json({ok:true})}catch(e){res.status(e.status||500).json({ok:false,error:e.message})}});
app.post("/api/upload",staff,async(req,res)=>{res.status(501).json({ok:false,error:"استخدم رفع Supabase Storage من الواجهة؛ هذا الخادم يحمي إدارة الحسابات فقط."})});
app.use(express.static(ROOT,{index:"index.html"}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager running on ${PORT}`));