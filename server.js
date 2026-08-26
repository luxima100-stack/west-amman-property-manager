const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
const BUCKET = process.env.SUPABASE_BUCKET || "property-images";

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
    const msg = data?.msg || data?.message || data?.error_description ||
      data?.error || text || `HTTP ${res.status}`;
    const e = new Error(msg); e.status = res.status; e.data = data; throw e;
  }
  return data;
}

function bearer(req) {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function currentUser(req) {
  const token = bearer(req);
  if (!token) return null;
  try {
    const u = await sb("/auth/v1/user", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const id = u?.id;
    if (!id) return null;
    const profiles = await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,name,email,role,permissions`);
    const p = profiles?.[0];
    if (!p || !["owner", "admin"].includes(p.role)) return null;
    return { ...p, authUser: u, token };
  } catch {
    return null;
  }
}

async function requireStaff(req, res, next) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ ok:false, error:"غير مصرح. سجل الدخول من جديد." });
  req.staff = u;
  next();
}

async function requireOwner(req, res, next) {
  const u = await currentUser(req);
  if (!u || u.role !== "owner") return res.status(403).json({ ok:false, error:"هذه العملية متاحة للمالك فقط." });
  req.staff = u;
  next();
}

/* ---------- Auth ---------- */
app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ ok:false, message:"أدخل البريد الإلكتروني وكلمة المرور." });
    }

    const auth = await sb("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "X-Client-Info": "west-amman-property-manager" },
      body: JSON.stringify({ email, password })
    });

    const userId = auth?.user?.id;
    if (!userId) return res.status(401).json({ ok:false, message:"بيانات الدخول غير صحيحة." });

    let profiles = await sb(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,name,email,role,permissions`);
    let profile = profiles?.[0];

    if (!profile) {
      const allProfiles = await sb("/rest/v1/profiles?select=id&limit=1");
      if (!allProfiles?.length || (OWNER_EMAIL && email === OWNER_EMAIL)) {
        const permissions = ["dashboard","properties","tenants","reports","settings","admins","messages"];
        const inserted = await sb("/rest/v1/profiles", {
          method:"POST",
          headers:{ Prefer:"return=representation" },
          body:JSON.stringify({
            id:userId,
            name:auth.user?.user_metadata?.name || "المالك",
            email,
            role:"owner",
            permissions
          })
        });
        profile = inserted?.[0];
      } else {
        return res.status(403).json({ ok:false, message:"هذا الحساب غير مصرح به." });
      }
    }

    if (!profile || !["owner","admin"].includes(profile.role)) {
      return res.status(403).json({ ok:false, message:"هذا الحساب غير مصرح به." });
    }

    return res.json({
      ok:true,
      token:auth.access_token || "",
      user:{
        id:profile.id,
        name:profile.name || auth.user?.user_metadata?.name || email,
        email:profile.email || email,
        role:profile.role,
        permissions:profile.permissions || []
      }
    });
  } catch (e) {
    console.error("LOGIN_ERROR", e);
    const msg = e?.data?.msg || e?.data?.message || e.message || "تعذر تسجيل الدخول.";
    res.status(e.status === 400 || e.status === 401 ? e.status : 500).json({ ok:false, message:msg });
  }
});

/* ---------- Properties ---------- */
app.get("/api/public/properties", async (req, res) => {
  try {
    const rows = await sb("/rest/v1/properties?select=*&order=created_at.desc");
    res.json(rows || []);
  } catch (e) {
    console.error("PUBLIC_PROPERTIES_ERROR", e);
    res.status(500).json({ ok:false, error:e.message || "تعذر تحميل العقارات." });
  }
});

app.get("/api/properties", requireStaff, async (req, res) => {
  try {
    const rows = await sb("/rest/v1/properties?select=*&order=created_at.desc");
    res.json(rows || []);
  } catch (e) {
    console.error("PROPERTIES_GET_ERROR", e);
    res.status(500).json({ ok:false, error:e.message || "تعذر تحميل العقارات." });
  }
});

app.post("/api/properties", requireStaff, async (req, res) => {
  try {
    const b = req.body || {};
    if (!String(b.code || "").trim() || !String(b.name || "").trim() || !String(b.area || "").trim()) {
      return res.status(400).json({ ok:false, error:"الكود واسم الشقة والمنطقة مطلوبة." });
    }
    const row = {
      code:String(b.code).trim(),
      name:String(b.name).trim(),
      area:String(b.area).trim(),
      status:String(b.status || "متاحة"),
      floor:b.floor === "" || b.floor == null ? null : Number(b.floor),
      area_size:b.areaSize === "" || b.areaSize == null ? null : Number(b.areaSize),
      price:Number(b.price || 0),
      rooms:Number(b.rooms || 0),
      baths:Number(b.baths || 0),
      balcony:Boolean(Number(b.balcony || 0)),
      availability_date:b.availabilityDate || null,
      notes:String(b.notes || ""),
      video_url:String(b.video || ""),
      images:Array.isArray(b.images) ? b.images.slice(0,30) : []
    };
    const out = await sb("/rest/v1/properties", {
      method:"POST",
      headers:{ Prefer:"return=representation" },
      body:JSON.stringify(row)
    });
    res.json(out?.[0] || out);
  } catch (e) {
    console.error("PROPERTY_CREATE_ERROR", e);
    res.status(e.status || 500).json({ ok:false, error:e.message || "تعذر إضافة الشقة." });
  }
});

app.put("/api/properties/:id", requireStaff, async (req, res) => {
  try {
    const b = req.body || {};
    const row = {
      code:String(b.code || "").trim(),
      name:String(b.name || "").trim(),
      area:String(b.area || "").trim(),
      status:String(b.status || "متاحة"),
      floor:b.floor === "" || b.floor == null ? null : Number(b.floor),
      area_size:b.areaSize === "" || b.areaSize == null ? null : Number(b.areaSize),
      price:Number(b.price || 0),
      rooms:Number(b.rooms || 0),
      baths:Number(b.baths || 0),
      balcony:Boolean(Number(b.balcony || 0)),
      availability_date:b.availabilityDate || null,
      notes:String(b.notes || ""),
      video_url:String(b.video || ""),
      images:Array.isArray(b.images) ? b.images.slice(0,30) : []
    };
    const out = await sb(`/rest/v1/properties?id=eq.${encodeURIComponent(req.params.id)}`, {
      method:"PATCH",
      headers:{ Prefer:"return=representation" },
      body:JSON.stringify(row)
    });
    res.json(out?.[0] || out);
  } catch (e) {
    console.error("PROPERTY_UPDATE_ERROR", e);
    res.status(e.status || 500).json({ ok:false, error:e.message || "تعذر تعديل الشقة." });
  }
});

/* ---------- Users / Admins ---------- */
app.get("/api/users", requireStaff, async (req, res) => {
  try {
    const rows = await sb("/rest/v1/profiles?select=id,name,email,role,permissions&order=created_at.asc");
    res.json(rows || []);
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message || "تعذر تحميل المستخدمين." });
  }
});

app.post("/api/users", requireOwner, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = req.body?.role === "owner" ? "owner" : "admin";
    if (!name || !email || !password) return res.status(400).json({ok:false,error:"أكمل بيانات المدير."});
    if (password.length < 6) return res.status(400).json({ok:false,error:"كلمة المرور يجب أن تكون 6 أحرف أو أكثر."});
    if (role !== "admin") return res.status(400).json({ok:false,error:"لا يمكن إنشاء مالك إضافي من التطبيق."});

    const created = await sb("/auth/v1/admin/users", {
      method:"POST",
      body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})
    });
    const userId = created?.id || created?.user?.id;
    if (!userId) throw new Error("لم يتم إنشاء حساب المدير.");

    const permissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.filter(x => ["dashboard","properties","tenants","reports","settings","messages"].includes(x))
      : ["dashboard","properties"];

    const inserted = await sb("/rest/v1/profiles", {
      method:"POST",
      headers:{Prefer:"return=representation"},
      body:JSON.stringify({id:userId,name,email,role:"admin",permissions})
    });
    res.json(inserted?.[0] || inserted);
  } catch (e) {
    console.error("USER_CREATE_ERROR", e);
    const duplicate = String(e.message || "").toLowerCase().includes("already") || e.status === 422;
    res.status(duplicate ? 409 : (e.status || 500)).json({ok:false,error:duplicate ? "هذا البريد الإلكتروني مستخدم بالفعل." : (e.message || "تعذر إنشاء المدير.")});
  }
});

/* Compatibility endpoint used by the earlier admin form. */
app.post("/api/admin/create", requireOwner, async (req, res) => {
  req.body = {...req.body, role:"admin"};
  req.url = "/api/users";
  // Do the same work directly rather than re-entering Express routing.
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : ["dashboard","properties"];
    if (!name || !email || !password) return res.status(400).json({ok:false,message:"أكمل بيانات المدير."});
    const created = await sb("/auth/v1/admin/users", {
      method:"POST",
      body:JSON.stringify({email,password,email_confirm:true,user_metadata:{name}})
    });
    const userId = created?.id || created?.user?.id;
    if (!userId) throw new Error("لم يتم إنشاء حساب المدير.");
    const safePermissions = permissions.filter(x => ["dashboard","properties","tenants","reports","settings","messages"].includes(x));
    const inserted = await sb("/rest/v1/profiles", {
      method:"POST",
      headers:{Prefer:"return=representation"},
      body:JSON.stringify({id:userId,name,email,role:"admin",permissions:safePermissions})
    });
    res.json({ok:true,user:inserted?.[0] || {id:userId,name,email,role:"admin",permissions:safePermissions}});
  } catch(e) {
    console.error("ADMIN_CREATE_ERROR",e);
    res.status(e.status || 500).json({ok:false,message:e.message || "تعذر إنشاء المدير."});
  }
});

/* ---------- Image upload to Supabase Storage ---------- */
/* Node 18+ provides Request/FormData/File. This avoids adding multer. */
app.post("/api/upload", requireStaff, async (req, res) => {
  try {
    const request = new Request(`http://localhost${req.originalUrl}`, {
      method:"POST",
      headers:req.headers,
      body:req,
      duplex:"half"
    });
    const form = await request.formData();
    const files = form.getAll("images").filter(x => x && typeof x.arrayBuffer === "function").slice(0,30);
    if (!files.length) return res.json({ok:true,urls:[]});

    const urls = [];
    for (const file of files) {
      const type = String(file.type || "application/octet-stream");
      if (!["image/jpeg","image/png","image/webp"].includes(type)) continue;
      const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
      const safe = String(file.name || "image").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,80);
      const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2,10)}-${safe.replace(/\.[^.]+$/,"")}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encodeURIComponent(objectPath)}`, {
        method:"POST",
        headers:{
          apikey:SUPABASE_SERVICE_ROLE_KEY,
          Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type":type,
          "x-upsert":"true"
        },
        body:bytes
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(txt || `فشل رفع الصورة (${r.status})`);
      urls.push(`${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encodeURIComponent(objectPath)}`);
    }
    res.json({ok:true,urls});
  } catch (e) {
    console.error("UPLOAD_ERROR",e);
    res.status(500).json({ok:false,error:e.message || "تعذر رفع الصور."});
  }
});

app.get("/health", (req,res) => {
  res.json({ok:true,service:"west-amman-property-manager",version:"17.0-data-api-fix",supabaseConfigured:cfgOk()});
});

app.use(express.static(ROOT,{index:"index.html",extensions:["html"]}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));

app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager running on ${PORT}`));
