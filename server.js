const express = require("express");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = process.env.SUPABASE_BUCKET || "property-images";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").trim().toLowerCase();

app.disable("x-powered-by");
app.use(express.json({limit:"30mb"}));
app.use(express.urlencoded({extended:true,limit:"30mb"}));
const upload = multer({storage:multer.memoryStorage(), limits:{files:30, fileSize:10*1024*1024}});

function configured(){ return Boolean(SUPABASE_URL && SERVICE_KEY); }

async function sb(pathname, options={}){
  if(!configured()) throw new Error("إعدادات Supabase غير مكتملة في Render.");
  const headers={
    apikey:SERVICE_KEY,
    Authorization:`Bearer ${SERVICE_KEY}`,
    "Content-Type":"application/json",
    ...(options.headers||{})
  };
  const r=await fetch(`${SUPABASE_URL}${pathname}`,{...options,headers});
  const text=await r.text();
  let data=null;
  try{ data=text?JSON.parse(text):null }catch{ data=text }
  if(!r.ok){
    const msg=data?.msg||data?.message||data?.error_description||data?.error||text||`HTTP ${r.status}`;
    const e=new Error(msg); e.status=r.status; e.data=data; throw e;
  }
  return data;
}
function bearer(req){
  const h=String(req.headers.authorization||"");
  return h.startsWith("Bearer ")?h.slice(7).trim():"";
}
async function currentUser(req){
  const token=bearer(req);
  if(!token) return null;
  try{
    const u=await sb("/auth/v1/user",{headers:{Authorization:`Bearer ${token}`}});
    if(!u?.id) return null;
    const rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=id,name,email,role,permissions`);
    const p=rows?.[0];
    if(!p || !["owner","admin"].includes(p.role)) return null;
    return {...p,authUser:u,token};
  }catch{return null}
}
async function staff(req,res,next){
  const u=await currentUser(req);
  if(!u) return res.status(401).json({ok:false,message:"انتهت الجلسة. سجل الدخول من جديد."});
  req.staff=u; next();
}
async function owner(req,res,next){
  const u=await currentUser(req);
  if(!u || u.role!=="owner") return res.status(403).json({ok:false,message:"هذه العملية للمالك فقط."});
  req.staff=u; next();
}

app.get("/health",(req,res)=>res.json({
  ok:true,service:"west-amman-property-manager",version:"19.0.0",supabaseConfigured:configured()
}));

app.post("/api/login",async(req,res)=>{
  try{
    const email=String(req.body?.email||"").trim().toLowerCase();
    const password=String(req.body?.password||"");
    if(!email||!password) return res.status(400).json({ok:false,message:"أدخل البريد الإلكتروني وكلمة المرور."});
    const a=await sb("/auth/v1/token?grant_type=password",{
      method:"POST",headers:{"X-Client-Info":"west-amman-property-manager"},
      body:JSON.stringify({email,password})
    });
    const id=a?.user?.id;
    if(!id) return res.status(401).json({ok:false,message:"بيانات الدخول غير صحيحة."});
    let rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,name,email,role,permissions`);
    let p=rows?.[0];
    if(!p){
      const all=await sb("/rest/v1/profiles?select=id&limit=1");
      if(!all?.length || (OWNER_EMAIL && email===OWNER_EMAIL)){
        rows=await sb("/rest/v1/profiles",{
          method:"POST",headers:{Prefer:"return=representation"},
          body:JSON.stringify({
            id,name:a.user?.user_metadata?.name||"المالك",email,role:"owner",
            permissions:["dashboard","properties","tenants","reports","settings","admins","messages"]
          })
        });
        p=rows?.[0];
      }else{
        return res.status(403).json({ok:false,message:"هذا الحساب غير مصرح به."});
      }
    }
    if(!p || !["owner","admin"].includes(p.role))
      return res.status(403).json({ok:false,message:"هذا الحساب غير مصرح به."});
    res.json({ok:true,token:a.access_token,user:{
      id:p.id,name:p.name||email,email:p.email||email,role:p.role,permissions:p.permissions||[]
    }});
  }catch(e){
    res.status(e.status===400||e.status===401?401:500).json({ok:false,message:e.message||"تعذر تسجيل الدخول."});
  }
});

app.get("/api/public/properties",async(req,res)=>{
  try{res.json(await sb("/rest/v1/properties?select=*&order=created_at.desc")||[])}
  catch(e){res.status(500).json({ok:false,message:e.message})}
});
app.get("/api/properties",staff,async(req,res)=>{
  try{res.json(await sb("/rest/v1/properties?select=*&order=created_at.desc")||[])}
  catch(e){res.status(500).json({ok:false,message:e.message})}
});

function propertyRow(b){
  return {
    code:String(b.code||"").trim(),
    name:String(b.name||"").trim(),
    area:String(b.area||"").trim(),
    status:String(b.status||"متاحة"),
    floor:b.floor===""||b.floor==null?null:Number(b.floor),
    area_size:b.areaSize===""||b.areaSize==null?null:Number(b.areaSize),
    price:Number(b.price||0),
    rooms:Number(b.rooms||0),
    baths:Number(b.baths||0),
    balcony:Boolean(Number(b.balcony||0)),
    availability_date:b.availabilityDate||null,
    alert_days:Math.max(0,Number(b.alertDays??7)),
    notes:String(b.notes||""),
    video_url:String(b.video||""),
    images:Array.isArray(b.images)?b.images.filter(Boolean).slice(0,30):[]
  };
}
app.post("/api/properties",staff,async(req,res)=>{
  try{
    const row=propertyRow(req.body||{});
    if(!row.code||!row.name||!row.area)
      return res.status(400).json({ok:false,message:"الكود واسم الشقة والمنطقة مطلوبة."});
    const out=await sb("/rest/v1/properties",{
      method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(row)
    });
    res.json(out?.[0]||out);
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر حفظ الشقة."})}
});
app.put("/api/properties/:id",staff,async(req,res)=>{
  try{
    const row=propertyRow(req.body||{});
    const out=await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{
      method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(row)
    });
    res.json(out?.[0]||out);
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر تعديل الشقة."})}
});
app.delete("/api/properties/:id",staff,async(req,res)=>{
  try{await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{method:"DELETE"});res.json({ok:true})}
  catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر حذف الشقة."})}
});

/* Multipart image upload. Files are kept in memory briefly, then stored in Supabase Storage. */
app.post("/api/upload",staff,upload.array("images",30),async(req,res)=>{
  try{
    const files=Array.isArray(req.files)?req.files:[];
    const urls=[];
    for(const file of files){
      const type=String(file.mimetype||"");
      if(!["image/jpeg","image/png","image/webp"].includes(type)) continue;
      const ext=type==="image/png"?"png":type==="image/webp"?"webp":"jpg";
      const base=String(file.originalname||"image").replace(/[^a-zA-Z0-9._-]/g,"_").replace(/\.[^.]+$/," ").trim().slice(0,70)||"image";
      const objectPath=`properties/${Date.now()}-${Math.random().toString(36).slice(2,10)}-${base}.${ext}`;
      const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`,{
        method:"POST",headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,"Content-Type":type,"x-upsert":"false"},body:file.buffer
      });
      const text=await r.text();
      if(!r.ok) throw new Error(text||`فشل رفع الصورة (${r.status})`);
      urls.push(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`);
    }
    res.json({ok:true,urls});
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر رفع الصور."})}
});

/* Settings and search history are stored in Supabase, not only in phone localStorage. */
app.get("/api/app-state",staff,async(req,res)=>{
  try{
    const rows=await sb("/rest/v1/app_state?id=eq.1&select=settings,search_history");
    res.json(rows?.[0]||{settings:{},search_history:[]});
  }catch(e){res.status(500).json({ok:false,message:e.message})}
});
app.put("/api/app-state",staff,async(req,res)=>{
  try{
    const settings=req.body?.settings||{};
    const search_history=Array.isArray(req.body?.search_history)?req.body.search_history.slice(0,30):[];
    const out=await sb("/rest/v1/app_state?id=eq.1",{
      method:"PATCH",headers:{Prefer:"return=representation"},
      body:JSON.stringify({settings,search_history,updated_at:new Date().toISOString()})
    });
    res.json({ok:true,state:out?.[0]||null});
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message})}
});

/* Admins */
app.get("/api/users",staff,async(req,res)=>{
  try{res.json(await sb("/rest/v1/profiles?select=id,name,email,role,permissions&order=created_at.asc")||[])}
  catch(e){res.status(500).json({ok:false,message:e.message})}
});
app.post("/api/users",owner,async(req,res)=>{
  try{
    const name=String(req.body?.name||"").trim();
    const email=String(req.body?.email||"").trim().toLowerCase();
    const password=String(req.body?.password||"");
    if(!name||!email||password.length<6)
      return res.status(400).json({ok:false,message:"أكمل بيانات المدير وكلمة المرور 6 أحرف على الأقل."});
    const permissions=Array.isArray(req.body?.permissions)
      ? req.body.permissions.filter(x=>["dashboard","properties","tenants","reports","settings","messages"].includes(x))
      : ["dashboard","properties"];
    const created=await sb("/auth/v1/admin/users",{
      method:"POST",body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})
    });
    const id=created?.id||created?.user?.id;
    if(!id) throw new Error("لم يتم إنشاء حساب المدير.");
    const inserted=await sb("/rest/v1/profiles",{
      method:"POST",headers:{Prefer:"return=representation"},
      body:JSON.stringify({id,name,email,role:"admin",permissions})
    });
    res.json({ok:true,user:inserted?.[0]||inserted});
  }catch(e){
    const duplicate=String(e.message||"").toLowerCase().includes("already")||e.status===422;
    res.status(duplicate?409:(e.status||500)).json({ok:false,message:duplicate?"هذا البريد الإلكتروني مستخدم بالفعل.":e.message||"تعذر إنشاء المدير."});
  }
});
app.patch("/api/users/:id/permissions",owner,async(req,res)=>{
  try{
    const permissions=Array.isArray(req.body?.permissions)
      ? req.body.permissions.filter(x=>["dashboard","properties","tenants","reports","settings","messages"].includes(x))
      : [];
    const out=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(req.params.id)}`,{
      method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({permissions})
    });
    res.json({ok:true,user:out?.[0]});
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message})}
});
app.delete("/api/users/:id",owner,async(req,res)=>{
  try{
    if(String(req.params.id)===String(req.staff.id)) return res.status(400).json({ok:false,message:"لا يمكن حذف حساب المالك الحالي."});
    await sb(`/auth/v1/admin/users/${encodeURIComponent(req.params.id)}`,{method:"DELETE"});
    await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(req.params.id)}`,{method:"DELETE"});
    res.json({ok:true});
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر حذف المدير."})}
});

/* Password changes. Service Role is used only on the server, never in browser. */
app.post("/api/password",staff,async(req,res)=>{
  try{
    const newPassword=String(req.body?.newPassword||"");
    if(newPassword.length<6) return res.status(400).json({ok:false,message:"كلمة المرور يجب أن تكون 6 أحرف أو أكثر."});
    await sb(`/auth/v1/admin/users/${encodeURIComponent(req.staff.id)}`,{
      method:"PUT",body:JSON.stringify({password:newPassword})
    });
    res.json({ok:true,message:"تم تغيير كلمة المرور بنجاح. استخدمها في تسجيل الدخول القادم."});
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر تغيير كلمة المرور."})}
});
app.post("/api/admin/change-owner-password",owner,async(req,res)=>{
  try{
    const newPassword=String(req.body?.newPassword||"");
    if(newPassword.length<6) return res.status(400).json({ok:false,message:"كلمة المرور يجب أن تكون 6 أحرف أو أكثر."});
    const owners=await sb(`/rest/v1/profiles?role=eq.owner&select=id&limit=1`);
    const id=owners?.[0]?.id;
    if(!id) return res.status(404).json({ok:false,message:"لم يتم العثور على حساب المالك."});
    await sb(`/auth/v1/admin/users/${encodeURIComponent(id)}`,{
      method:"PUT",body:JSON.stringify({password:newPassword})
    });
    res.json({ok:true,message:"تم تغيير كلمة سر المالك."});
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر تغيير كلمة سر المالك."})}
});

app.use((err,req,res,next)=>{if(err instanceof multer.MulterError){return res.status(400).json({ok:false,message:`خطأ في رفع الصور: ${err.message}`})}next(err)});

/* Serve the flat project root. */
app.use(express.static(ROOT,{index:"index.html",extensions:["html"]}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager 19.0.0 on ${PORT}`));
