const express=require("express");
const path=require("path");
const app=express();
const PORT=process.env.PORT||10000;
const ROOT=__dirname;
const SUPABASE_URL=String(process.env.SUPABASE_URL||"").replace(/\/+$/,"");
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const BUCKET=process.env.SUPABASE_BUCKET||"property-images";
const OWNER_EMAIL=String(process.env.OWNER_EMAIL||"").trim().toLowerCase();

app.disable("x-powered-by");
app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true,limit:"2mb"}));

function configured(){return !!(SUPABASE_URL&&SERVICE_KEY)}
async function sb(pathname,options={}){
  if(!configured())throw new Error("Supabase environment variables are missing.");
  const r=await fetch(SUPABASE_URL+pathname,{...options,headers:{
    apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json",...(options.headers||{})
  }});
  const text=await r.text(); let data=null;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok){const e=new Error(data?.msg||data?.message||data?.error_description||data?.error||text||("HTTP "+r.status));e.status=r.status;e.data=data;throw e}
  return data
}
function bearer(req){const h=String(req.headers.authorization||"");return h.startsWith("Bearer ")?h.slice(7).trim():""}
async function currentUser(req){
  const token=bearer(req);if(!token)return null;
  try{
    const u=await sb("/auth/v1/user",{headers:{Authorization:"Bearer "+token}});
    const rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(u.id)}&select=id,name,email,role,permissions`);
    const p=rows?.[0];if(!p||!["owner","admin"].includes(p.role))return null;
    return {...p,token,authUser:u}
  }catch{return null}
}
async function requireStaff(req,res,next){const u=await currentUser(req);if(!u)return res.status(401).json({ok:false,message:"انتهت الجلسة. سجل الدخول من جديد."});req.staff=u;next()}
async function requireOwner(req,res,next){const u=await currentUser(req);if(!u||u.role!=="owner")return res.status(403).json({ok:false,message:"هذه العملية متاحة للمالك فقط."});req.staff=u;next()}

app.get("/health",(req,res)=>res.json({ok:true,version:"FINAL-19.0.0",supabaseConfigured:configured()}));

app.post("/api/login",async(req,res)=>{
  try{
    const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");
    if(!email||!password)return res.status(400).json({ok:false,message:"أدخل البريد الإلكتروني وكلمة المرور."});
    const a=await sb("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
    const id=a?.user?.id;if(!id)return res.status(401).json({ok:false,message:"بيانات الدخول غير صحيحة."});
    let rows=await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,name,email,role,permissions`);
    let p=rows?.[0];
    if(!p){
      const count=await sb("/rest/v1/profiles?select=id&limit=1");
      if(count?.length||(OWNER_EMAIL&&email!==OWNER_EMAIL))return res.status(403).json({ok:false,message:"هذا الحساب غير مصرح به."});
      rows=await sb("/rest/v1/profiles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({
        id,name:a.user?.user_metadata?.name||"المالك",email,role:"owner",
        permissions:["dashboard","properties","reports","settings","admins","messages"]
      })});p=rows?.[0];
    }
    if(!p||!["owner","admin"].includes(p.role))return res.status(403).json({ok:false,message:"هذا الحساب غير مصرح به."});
    res.json({ok:true,token:a.access_token,user:{id:p.id,name:p.name||email,email:p.email||email,role:p.role,permissions:p.permissions||[]}});
  }catch(e){res.status(e.status===400||e.status===401?401:500).json({ok:false,message:e.message||"تعذر تسجيل الدخول."})}
});

app.get("/api/public/properties",async(req,res)=>{
  try{res.json(await sb("/rest/v1/properties?select=*&order=created_at.desc"))}
  catch(e){res.status(500).json({ok:false,message:"تعذر تحميل الشقق.",error:e.message})}
});
app.get("/api/properties",requireStaff,async(req,res)=>{
  try{res.json(await sb("/rest/v1/properties?select=*&order=created_at.desc"))}
  catch(e){res.status(500).json({ok:false,message:e.message})}
});
function propertyRow(b,images){
  return {
    code:String(b.code||"").trim(),name:String(b.name||"").trim(),area:String(b.area||"").trim(),
    status:String(b.status||"متاحة"),floor:b.floor===""||b.floor==null?null:Number(b.floor),
    area_size:b.areaSize===""||b.areaSize==null?null:Number(b.areaSize),price:Number(b.price||0),
    rooms:Number(b.rooms||0),baths:Number(b.baths||0),balcony:Boolean(Number(b.balcony||0)),
    availability_date:b.availabilityDate||null,notes:String(b.notes||""),video_url:String(b.video||""),
    images:Array.isArray(images)?images.slice(0,30):[]
  }
}
app.post("/api/properties",requireStaff,async(req,res)=>{
  try{
    const b=req.body||{};if(!b.code||!b.name||!b.area)return res.status(400).json({ok:false,message:"الكود واسم الشقة والمنطقة مطلوبة."});
    const out=await sb("/rest/v1/properties",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(propertyRow(b,b.images))});
    res.json({ok:true,property:out?.[0]||out})
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر حفظ الشقة."})}
});
app.put("/api/properties/:id",requireStaff,async(req,res)=>{
  try{
    const b=req.body||{};if(!b.code||!b.name||!b.area)return res.status(400).json({ok:false,message:"الكود واسم الشقة والمنطقة مطلوبة."});
    const out=await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(propertyRow(b,b.images))});
    res.json({ok:true,property:out?.[0]||out})
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر تعديل الشقة."})}
});
app.delete("/api/properties/:id",requireStaff,async(req,res)=>{
  try{await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`,{method:"DELETE"});res.json({ok:true})}
  catch(e){res.status(e.status||500).json({ok:false,message:e.message})}
});

app.post("/api/upload",requireStaff,async(req,res)=>{
  try{
    const request=new Request(`http://localhost${req.originalUrl}`,{method:"POST",headers:req.headers,body:req,duplex:"half"});
    const form=await request.formData();
    const files=form.getAll("images").filter(f=>f&&typeof f.arrayBuffer==="function").slice(0,30);
    const urls=[];
    for(const file of files){
      const type=String(file.type||"");if(!["image/jpeg","image/png","image/webp"].includes(type))continue;
      const ext=type==="image/png"?"png":type==="image/webp"?"webp":"jpg";
      const safe=String(file.name||"image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80);
      const objectPath=`${Date.now()}-${Math.random().toString(36).slice(2,10)}-${safe.replace(/\.[^.]+$/,"")}.${ext}`;
      const bytes=Buffer.from(await file.arrayBuffer());
      const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeURIComponent(objectPath)}`,{
        method:"POST",headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,"Content-Type":type,"x-upsert":"true"},body:bytes
      });
      const txt=await r.text();if(!r.ok)throw new Error(txt||`فشل رفع الصورة (${r.status})`);
      urls.push(`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encodeURIComponent(objectPath)}`)
    }
    res.json({ok:true,urls})
  }catch(e){res.status(500).json({ok:false,message:e.message||"تعذر رفع الصور."})}
});

app.get("/api/users",requireStaff,async(req,res)=>{
  try{res.json(await sb("/rest/v1/profiles?select=id,name,email,role,permissions&order=created_at.asc"))}
  catch(e){res.status(500).json({ok:false,message:e.message})}
});
app.post("/api/users",requireOwner,async(req,res)=>{
  try{
    const name=String(req.body?.name||"").trim(),email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");
    if(!name||!email||password.length<6)return res.status(400).json({ok:false,message:"أكمل بيانات المدير وكلمة المرور 6 أحرف على الأقل."});
    const permissions=Array.isArray(req.body?.permissions)?req.body.permissions.filter(x=>["dashboard","properties","reports","settings","admins","messages"].includes(x)):["dashboard","properties"];
    const created=await sb("/auth/v1/admin/users",{method:"POST",body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})});
    const id=created?.id||created?.user?.id;if(!id)throw new Error("لم يتم إنشاء حساب المدير.");
    const row=await sb("/rest/v1/profiles",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({id,name,email,role:"admin",permissions})});
    res.json({ok:true,user:row?.[0]||row})
  }catch(e){const dup=String(e.message||"").toLowerCase().includes("already");res.status(dup?409:(e.status||500)).json({ok:false,message:dup?"البريد مستخدم بالفعل.":e.message||"تعذر إنشاء المدير."})}
});
app.post("/api/users/:id/password",requireOwner,async(req,res)=>{
  try{
    const password=String(req.body?.password||"");if(password.length<6)return res.status(400).json({ok:false,message:"كلمة المرور يجب أن تكون 6 أحرف على الأقل."});
    await sb(`/auth/v1/admin/users/${encodeURIComponent(req.params.id)}`,{method:"PUT",body:JSON.stringify({password})});res.json({ok:true})
  }catch(e){res.status(e.status||500).json({ok:false,message:e.message||"تعذر تغيير كلمة المرور."})}
});
app.post("/api/owner/password",requireOwner,async(req,res)=>{
  try{
    const current=String(req.body?.currentPassword||""),next=String(req.body?.newPassword||"");
    if(next.length<6)return res.status(400).json({ok:false,message:"كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل."});
    const auth=await sb("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email:req.staff.email,password:current})});
    if(!auth?.user?.id)return res.status(401).json({ok:false,message:"كلمة المرور الحالية غير صحيحة."});
    await sb(`/auth/v1/admin/users/${encodeURIComponent(req.staff.id)}`,{method:"PUT",body:JSON.stringify({password:next})});
    res.json({ok:true})
  }catch(e){res.status(e.status===400||e.status===401?401:500).json({ok:false,message:"كلمة المرور الحالية غير صحيحة أو تعذر تغييرها."})}
});

app.get("/api/state",requireStaff,async(req,res)=>{
  try{
    const rows=await sb("/rest/v1/app_state?select=key,value");const out={};for(const r of rows||[])out[r.key]=r.value;
    res.json({ok:true,state:out})
  }catch(e){res.status(500).json({ok:false,message:e.message})}
});
app.put("/api/state",requireStaff,async(req,res)=>{
  try{
    for(const [key,value] of Object.entries(req.body?.state||{})){
      await sb("/rest/v1/app_state",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({key,value})})
    }
    res.json({ok:true})
  }catch(e){res.status(500).json({ok:false,message:e.message})}
});

app.use(express.static(ROOT,{index:"index.html",extensions:["html"]}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager FINAL 19.0.0 on ${PORT}`));