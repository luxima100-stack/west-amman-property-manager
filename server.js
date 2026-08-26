
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").trim().toLowerCase();

app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

function cfgOk() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function sb(pathname, options = {}) {
  if (!cfgOk()) throw new Error("Supabase environment variables are missing.");
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || text || `HTTP ${res.status}`;
    const e = new Error(msg); e.status = res.status; e.data = data; throw e;
  }
  return data;
}

// Authenticate with Supabase Auth. The password never reaches the browser-side profile table.
app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) return res.status(400).json({ ok:false, message:"أدخل البريد الإلكتروني وكلمة المرور." });

    const auth = await sb("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "X-Client-Info": "west-amman-property-manager" },
      body: JSON.stringify({ email, password })
    });

    const userId = auth?.user?.id;
    if (!userId) return res.status(401).json({ ok:false, message:"بيانات الدخول غير صحيحة." });

    let profiles = await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,name,email,role,permissions`);
    let profile = profiles?.[0];

    // First authenticated account becomes owner automatically if the profiles table is empty.
    // This removes the need to manually create the owner in Supabase.
    if (!profile) {
      const allProfiles = await sb(`/rest/v1/profiles?select=id&limit=1`);
      if (!allProfiles?.length || (OWNER_EMAIL && email === OWNER_EMAIL)) {
        const role = (OWNER_EMAIL && email === OWNER_EMAIL) || !allProfiles?.length ? "owner" : null;
        if (!role) return res.status(403).json({ ok:false, message:"هذا الحساب موجود في Supabase لكنه غير مصرح به. أضفه من حساب المالك داخل التطبيق." });

        const permissions = ["dashboard","properties","tenants","reports","settings","admins","messages"];
        const inserted = await sb("/rest/v1/profiles", {
          method:"POST",
          headers:{ Prefer:"return=representation" },
          body:JSON.stringify({ id:userId, name:auth.user.user_metadata?.name || "المالك", email, role, permissions })
        });
        profile = inserted?.[0];
      } else {
        return res.status(403).json({ ok:false, message:"هذا الحساب غير مصرح به." });
      }
    }

    if (!profile || !["owner","admin"].includes(profile.role)) {
      return res.status(403).json({ ok:false, message:"هذا الحساب غير مصرح به." });
    }

    return res.json({ ok:true, user:{
      id:profile.id, name:profile.name || auth.user.user_metadata?.name || email,
      email:profile.email || email, role:profile.role, permissions:profile.permissions || []
    }});
  } catch (e) {
    console.error("LOGIN_ERROR", e);
    const msg = e?.data?.msg || e?.data?.message || e.message || "تعذر تسجيل الدخول.";
    res.status(e.status === 401 ? 401 : 500).json({ ok:false, message:msg });
  }
});

// Owner-only admin creation. The owner is determined from the authenticated profile ID sent by the app.
app.post("/api/admin/create", async (req, res) => {
  try {
    const ownerId = String(req.body?.ownerId || "");
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : [];

    if (!ownerId || !name || !email || !password) return res.status(400).json({ok:false,message:"أكمل بيانات المدير."});
    if (password.length < 6) return res.status(400).json({ok:false,message:"كلمة المرور يجب أن تكون 6 أحرف أو أكثر."});

    const owners = await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(ownerId)}&role=eq.owner&select=id`);
    if (!owners?.length) return res.status(403).json({ok:false,message:"هذه العملية متاحة للمالك فقط."});

    let created;
    try {
      created = await sb("/auth/v1/admin/users", {
        method:"POST",
        body:JSON.stringify({
          email, password, email_confirm:true,
          user_metadata:{ name }
        })
      });
    } catch (e) {
      const duplicate = String(e.message || "").toLowerCase().includes("already") || e.status === 422;
      if (duplicate) return res.status(409).json({ok:false,message:"هذا البريد الإلكتروني مستخدم بالفعل."});
      throw e;
    }

    const userId = created?.id || created?.user?.id;
    if (!userId) throw new Error("لم يتم إنشاء حساب المدير.");

    const allowed = ["dashboard","properties","tenants","reports","settings","messages"];
    const safePermissions = permissions.filter(x => allowed.includes(x));
    const inserted = await sb("/rest/v1/profiles", {
      method:"POST",
      headers:{ Prefer:"return=representation" },
      body:JSON.stringify({id:userId,name,email,role:"admin",permissions:safePermissions})
    });

    res.json({ok:true,user:{
      id:userId,name,email,role:"admin",permissions:safePermissions
    }});
  } catch(e) {
    console.error("ADMIN_CREATE_ERROR",e);
    res.status(e.status || 500).json({ok:false,message:e.message || "تعذر إنشاء المدير."});
  }
});

app.get("/health", (req,res) => {
  res.json({ok:true,service:"west-amman-property-manager",version:"16.0-auth-fix",supabaseConfigured:cfgOk()});
});

// Serve the existing app.js with two targeted changes:
// 1) login uses /api/login instead of localStorage passwords.
// 2) adding an admin uses /api/admin/create instead of localStorage-only users.
app.get("/app.js", (req,res) => {
  try {
    let src = fs.readFileSync(path.join(ROOT,"app.js"),"utf8");

    const oldLogin = `$('#loginForm')?.addEventListener('submit',e=>{e.preventDefault();const u=state.users.find(x=>x.email===$('#loginEmail').value.trim()&&x.password===$('#loginPassword').value);if(!u)return toast('بيانات الدخول غير صحيحة',false);state.user=u;localStorage.setItem('wam_session',u.id);state.page='dashboard';render()});`;
    const newLogin = `$('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=$('#loginForm .btn');if(btn)btn.disabled=true;try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#loginEmail').value.trim(),password:$('#loginPassword').value})});const d=await r.json();if(!r.ok||!d.ok){toast(d.message||'بيانات الدخول غير صحيحة',false);return;}state.user=d.user;localStorage.setItem('wam_session',d.user.id);localStorage.setItem('wam_auth_user',JSON.stringify(d.user));state.page='dashboard';render();}catch(err){toast('تعذر الاتصال بالخادم',false);}finally{if(btn)btn.disabled=false;}});`;

    if (!src.includes(oldLogin)) console.warn("Login pattern not found; app.js may have changed.");
    src = src.replace(oldLogin,newLogin);

    const oldUserSubmit = `$('#userForm').onsubmit=e=>{e.preventDefault();const permissions=isOwner?u.permissions:$$('#userForm input[type=checkbox]:checked').map(x=>x.value);const obj={id:u?.id||Date.now().toString(),name:$('#uName').value.trim(),email:$('#uEmail').value.trim(),password:$('#uPassword').value,role:isOwner?'owner':'admin',permissions};if(u)state.users=state.users.map(x=>x.id===u.id?obj:x);else state.users.push(obj);save();if(state.user.id===obj.id)state.user=obj;closeModal();render();toast('تم حفظ المستخدم والصلاحيات')};`;
    const newUserSubmit = `$('#userForm').onsubmit=async e=>{e.preventDefault();const permissions=isOwner?u.permissions:$$('#userForm input[type=checkbox]:checked').map(x=>x.value);const obj={id:u?.id||Date.now().toString(),name:$('#uName').value.trim(),email:$('#uEmail').value.trim(),password:$('#uPassword').value,role:isOwner?'owner':'admin',permissions};if(u){if(u.role==='owner'){state.users=state.users.map(x=>x.id===u.id?obj:x);save();if(state.user.id===obj.id)state.user=obj;closeModal();render();toast('تم حفظ المستخدم والصلاحيات');return;}toast('تعديل مدير موجود يحتاج تحديثًا من الخادم في النسخة القادمة',false);return;}try{const r=await fetch('/api/admin/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerId:state.user.id,name:obj.name,email:obj.email,password:obj.password,permissions})});const d=await r.json();if(!r.ok||!d.ok){toast(d.message||'تعذر إنشاء المدير',false);return;}state.users=[...state.users,d.user];save();closeModal();render();toast('تم إنشاء المدير بنجاح ويمكنه تسجيل الدخول الآن');}catch(err){toast('تعذر الاتصال بالخادم',false)}};`;
    if (!src.includes(oldUserSubmit)) console.warn("User submit pattern not found; app.js may have changed.");
    src = src.replace(oldUserSubmit,newUserSubmit);

    // Make session restore use the server-authenticated user when available.
    const oldEnd = `load();const sid=localStorage.getItem('wam_session');state.user=state.users.find(u=>u.id===sid)||null;render();`;
    const newEnd = `load();const sid=localStorage.getItem('wam_session');const cachedAuth=JSON.parse(localStorage.getItem('wam_auth_user')||'null');state.user=cachedAuth||state.users.find(u=>u.id===sid)||null;render();`;
    src = src.replace(oldEnd,newEnd);

    res.setHeader("Content-Type","application/javascript; charset=utf-8");
    res.setHeader("Cache-Control","no-store");
    res.send(src);
  } catch(e) {
    console.error("APP_JS_ERROR",e);
    res.status(500).type("text/plain").send("تعذر تحميل التطبيق.");
  }
});

app.use(express.static(ROOT,{index:"index.html",extensions:["html"]}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager running on ${PORT}`));
