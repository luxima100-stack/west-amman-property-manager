const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let adminClient = null;
let publicClient = null;
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = require("@supabase/supabase-js");
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} });
  }
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const { createClient } = require("@supabase/supabase-js");
    publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{autoRefreshToken:false,persistSession:false} });
  }
} catch (e) {
  console.error("Supabase server client unavailable:", e.message);
}

app.get("/api/config", (req,res) => {
  res.json({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, configured: !!(SUPABASE_URL && SUPABASE_ANON_KEY) });
});

async function requireOwner(req,res){
  if(!adminClient || !publicClient) return res.status(503).json({error:"Supabase server configuration is incomplete."});
  const auth = String(req.headers.authorization||"");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if(!token) return res.status(401).json({error:"Missing access token."});
  const { data:{user}, error:userError } = await publicClient.auth.getUser(token);
  if(userError || !user) return res.status(401).json({error:"Invalid session."});
  const { data:profile, error:profileError } = await adminClient.from("profiles").select("id,name,role,permissions").eq("id",user.id).maybeSingle();
  if(profileError || !profile || profile.role !== "owner") return res.status(403).json({error:"Owner permission required."});
  return { user, profile };
}

app.post("/api/admin/create", async (req,res)=>{
  try{
    const owner = await requireOwner(req,res); if(!owner || owner.status) return;
    const {name,email,password,permissions=[]}=req.body||{};
    if(!name || !email || !password) return res.status(400).json({error:"الاسم والبريد وكلمة المرور مطلوبة."});
    const {data,error}=await adminClient.auth.admin.createUser({email:String(email).trim(),password:String(password),email_confirm:true,user_metadata:{name:String(name).trim(),role:"admin"}});
    if(error) return res.status(400).json({error:error.message});
    const {data:profile,error:pe}=await adminClient.from("profiles").upsert({id:data.user.id,name:String(name).trim(),email:String(email).trim(),role:"admin",permissions:Array.isArray(permissions)?permissions:[]},{onConflict:"id"}).select().single();
    if(pe) return res.status(400).json({error:pe.message});
    res.json({user:profile});
  }catch(e){res.status(500).json({error:e.message||"Server error"});}
});

app.post("/api/admin/update", async (req,res)=>{
  try{
    const owner = await requireOwner(req,res); if(!owner || owner.status) return;
    const {id,name,email,password,permissions=[]}=req.body||{};
    if(!id || !name || !email) return res.status(400).json({error:"بيانات المدير غير مكتملة."});
    const patch={email:String(email).trim(),user_metadata:{name:String(name).trim(),role:"admin"}};
    if(password) patch.password=String(password);
    const {data,error}=await adminClient.auth.admin.updateUserById(id,patch);
    if(error) return res.status(400).json({error:error.message});
    const {data:profile,error:pe}=await adminClient.from("profiles").upsert({id,name:String(name).trim(),email:String(email).trim(),role:"admin",permissions:Array.isArray(permissions)?permissions:[]},{onConflict:"id"}).select().single();
    if(pe) return res.status(400).json({error:pe.message});
    res.json({user:profile});
  }catch(e){res.status(500).json({error:e.message||"Server error"});}
});

app.get("/health",(req,res)=>res.json({ok:true,service:"west-amman-property-manager",version:"16.0.0"}));

app.use(express.static(ROOT,{index:"index.html",extensions:["html"]}));
app.get("*splat",(req,res)=>res.sendFile(path.join(ROOT,"index.html")));

app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager running on port ${PORT}`));
