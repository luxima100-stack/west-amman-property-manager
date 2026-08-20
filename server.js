import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_BEFORE_INTERNET_DEPLOYMENT";
const DATA_ROOT = process.env.PERSISTENT_DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_ROOT, "data.db");
const UPLOAD_DIR = path.join(DATA_ROOT, "uploads");
fs.mkdirSync(UPLOAD_DIR, {recursive:true});
const BACKUP_DIR = path.join(__dirname, "backups");
fs.mkdirSync(BACKUP_DIR, {recursive:true});
const BACKUP_STATE = path.join(BACKUP_DIR, "backup-state.json");
const RESTORE_STATE = path.join(BACKUP_DIR, "restore-state.json");
const BACKUP_INTERVAL_MS = 24*60*60*1000;
let backupRunning = false;
function readBackupState(){
  try{return JSON.parse(fs.readFileSync(BACKUP_STATE,"utf8"));}catch{return {lastSuccessAt:null,lastSuccessFile:null,lastReason:null,lastError:null};}
}
function writeBackupState(patch){
  try{const current=readBackupState();fs.writeFileSync(BACKUP_STATE,JSON.stringify({...current,...patch},null,2));}catch{}
}
function pruneBackups(){
  const files=fs.readdirSync(BACKUP_DIR).filter(f=>f.endsWith(".zip")).sort();
  while(files.length>10){const old=files.shift();try{fs.unlinkSync(path.join(BACKUP_DIR,old));}catch{}}
  return files.slice(-10);
}
function runCommand(cmd,args,opts={}){
  return new Promise((resolve,reject)=>{
    execFile(cmd,args,{...opts,maxBuffer:10*1024*1024},(error,stdout,stderr)=>{
      if(error){error.message=`${error.message}${stderr?` — ${stderr.trim()}`:""}`;reject(error);return;}
      resolve(stdout);
    });
  });
}
function autoBackup(reason="auto"){
  if(backupRunning) return Promise.resolve({ok:false,skipped:true,reason:"running"});
  backupRunning=true;
  return (async()=>{
    try{
      try{ db?.pragma("wal_checkpoint(TRUNCATE)"); }catch{}
      const stamp=new Date().toISOString().replace(/[:.]/g,"-");
      const safe=String(reason).replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,30)||"auto";
      const out=path.join(BACKUP_DIR,`west-amman-${stamp}-${safe}.zip`);
      const items=["data.db","uploads","index.html","server.js","package.json","render.yaml","manifest.json","sw.js","README_AR.md","hero-realestate.svg","package-lock.json",".node-version"].filter(x=>fs.existsSync(path.join(__dirname,x)));
      await runCommand("zip",["-q","-r",out,...items],{cwd:__dirname});
      const kept=pruneBackups();
      const now=new Date().toISOString();
      writeBackupState({lastSuccessAt:now,lastSuccessFile:path.basename(out),lastReason:reason,lastError:null,lastAttemptAt:now,keptCount:kept.length});
      return {ok:true,file:path.basename(out),keptCount:kept.length};
    }catch(err){
      const msg=String(err?.message||err);
      writeBackupState({lastError:msg,lastAttemptAt:new Date().toISOString()});
      return {ok:false,error:msg};
    }finally{ backupRunning=false; }
  })();
}
async function listBackupArchive(file){
  const out=await runCommand("unzip",["-Z1",file]);
  return out.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}
async function extractBackupData(file,dest){
  await runCommand("unzip",["-q","-o",file,"data.db","uploads/*","-d",dest]);
}

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
const stateAtBoot=readBackupState();
if(!stateAtBoot.lastSuccessAt || (Date.now()-Date.parse(stateAtBoot.lastSuccessAt))>=BACKUP_INTERVAL_MS){
  setTimeout(()=>autoBackup("startup-due"),1500);
}
setInterval(()=>{
  const st=readBackupState();
  if(!st.lastSuccessAt || (Date.now()-Date.parse(st.lastSuccessAt))>=BACKUP_INTERVAL_MS) autoBackup("scheduled");
},60*60*1000);

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user',
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_permissions(
 user_id INTEGER NOT NULL,
 permission TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id, permission),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS areas(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS apartments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 number TEXT NOT NULL,
 area_id INTEGER NOT NULL,
 status TEXT NOT NULL,
 rent REAL DEFAULT 0,
 rooms INTEGER DEFAULT 1,
 baths INTEGER DEFAULT 1,
 kitchen INTEGER DEFAULT 1,
 floor INTEGER DEFAULT 1,
 size_m2 REAL DEFAULT 0,
 notes TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(area_id) REFERENCES areas(id)
);
CREATE TABLE IF NOT EXISTS tenants(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 apartment_id INTEGER,
 phone TEXT DEFAULT '',
 national_id TEXT DEFAULT '',
 status TEXT DEFAULT 'نشط',
 contract_start TEXT,
 contract_end TEXT,
 monthly_rent REAL DEFAULT 0,
 deposit REAL DEFAULT 0,
 notes TEXT DEFAULT '',
 renewal_enabled INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS payments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 tenant_id INTEGER,
 amount REAL NOT NULL,
 payment_date TEXT NOT NULL,
 method TEXT DEFAULT 'نقدي',
 reference TEXT DEFAULT '',
 notes TEXT DEFAULT '',
 FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS documents(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 apartment_id INTEGER,
 tenant_id INTEGER,
 filename TEXT NOT NULL,
 original_name TEXT NOT NULL,
 kind TEXT DEFAULT 'صورة/مستند',
 uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 action TEXT NOT NULL,
 detail TEXT NOT NULL,
 who TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 sender_id INTEGER NOT NULL,
 sender_username TEXT NOT NULL,
 recipient_role TEXT NOT NULL DEFAULT 'all_admin_owner',
 message TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TEXT,
 FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS accounting_entries(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 apartment_id INTEGER,
 tenant_id INTEGER,
 type TEXT NOT NULL CHECK(type IN ('income','expense','deposit')),
 category TEXT NOT NULL DEFAULT 'أخرى',
 amount REAL NOT NULL DEFAULT 0,
 entry_date TEXT NOT NULL,
 description TEXT DEFAULT '',
 created_by INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(apartment_id) REFERENCES apartments(id) ON DELETE SET NULL,
 FOREIGN KEY(tenant_id) REFERENCES tenants(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
);
`);

const AREAS = [
"عبدون","دابوق","دير غبار","الصويفية","أم أذينة","أم السماق","خلدا","تلاع العلي","الرابية",
"الشميساني","المدينة الرياضية","ضاحية الرشيد","حي الجامعة","الجبيهة","صويلح","شفا بدران","أبو نصير",
"جبل عمان","العبدلي","مرج الحمام","بيادر وادي السير","وادي السير","بدر الجديدة","الجندويل","الروابي",
"الرونق","السهل","الصنوبر","الصناعة","الظهير","الكرسي","المدينة الطبية","الوادي الأخضر","دير النسرين",
"الدوار الأول","الدوار الثاني","الدوار الثالث","الدوار الرابع","الدوار الخامس","الدوار السادس",
"الدوار السابع","الدوار الثامن","شارع مكة","الجاردنز","وادي صقرة","ضاحية الأمير راشد","ضاحية النخيل"
];
const insArea = db.prepare("INSERT OR IGNORE INTO areas(name) VALUES(?)");
for (const a of AREAS) insArea.run(a);

function seedUser(username,password,role){
  if(!db.prepare("SELECT id FROM users WHERE username=?").get(username)){
    db.prepare("INSERT INTO users(username,password_hash,role,active) VALUES(?,?,?,1)").run(username,bcrypt.hashSync(password,12),role);
  }
}
seedUser("owner","1234","owner");
seedUser("admin","1234","admin");
seedUser("user","1234","user");

/* v5.41.1 one-time authentication repair.
   Existing persistent databases from older builds could contain an inactive
   owner/admin or an old password. Repair the two built-in accounts once,
   then leave future password changes untouched. */
const AUTH_REPAIR_MARKER = path.join(DATA_ROOT, ".v5411-auth-repaired");
if(!fs.existsSync(AUTH_REPAIR_MARKER)){
  const repair = db.transaction(()=>{
    for(const [username,role] of [["owner","owner"],["admin","admin"]]){
      const u=db.prepare("SELECT id FROM users WHERE username=?").get(username);
      if(u){
        db.prepare("UPDATE users SET role=?,active=1,password_hash=? WHERE id=?")
          .run(role,bcrypt.hashSync("1234",12),u.id);
      }else{
        db.prepare("INSERT INTO users(username,password_hash,role,active) VALUES(?,?,?,1)")
          .run(username,bcrypt.hashSync("1234",12),role);
      }
    }
  });
  try{repair();fs.writeFileSync(AUTH_REPAIR_MARKER,new Date().toISOString());}catch{}
}

if(db.prepare("SELECT COUNT(*) c FROM apartments").get().c===0){
 const aid=n=>db.prepare("SELECT id FROM areas WHERE name=?").get(n).id;
 const add=db.prepare(`INSERT INTO apartments(number,area_id,status,rent,rooms,baths,kitchen,floor,size_m2,notes)
 VALUES(?,?,?,?,?,?,?,?,?,?)`);
 [
  ["101","عبدون","متاحة",750,2,1,1,1,75,"إطلالة هادئة"],
  ["102","خلدا","قريبة من التوفر",900,3,2,1,2,90,"تشطيب فاخر"],
  ["201","أم أذينة","الحجز ينتهي قريباً",700,2,1,1,1,70,"قرب الدوار الخامس"],
  ["202","دابوق","مؤجرة / محجوزة",1100,3,2,1,3,130,"فيلا مستقلة"],
  ["301","الصويفية","غير متاحة / صيانة",650,2,1,1,2,75,"صيانة مطبخ"]
 ].forEach(x=>add.run(x[0],aid(x[1]),x[2],x[3],x[4],x[5],x[6],x[7],x[8],x[9]));
}

try{
  if(fs.existsSync(RESTORE_STATE)){
    const rr=JSON.parse(fs.readFileSync(RESTORE_STATE,"utf8"));
    log("استرجاع نسخة احتياطية",`تم استرجاع النسخة ${rr.backup||"—"} بواسطة ${rr.user||"—"}`,rr.user||"system");
    fs.unlinkSync(RESTORE_STATE);
  }
}catch{}

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req,_file,cb)=>cb(null,UPLOAD_DIR),
    filename: (_req,file,cb)=>{
      const ext=path.extname(file.originalname).toLowerCase();
      cb(null,"video-"+Date.now()+"-"+Math.random().toString(36).slice(2)+ext);
    }
  }),
  limits:{fileSize:80*1024*1024},
  fileFilter: (_req,file,cb)=>{
    const ok=[".mp4",".webm",".mov",".m4v"].includes(path.extname(file.originalname).toLowerCase());
    cb(ok?null:new Error("يسمح فقط بفيديو MP4 أو WEBM أو MOV أو M4V"),ok);
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req,_file,cb)=>cb(null,UPLOAD_DIR),
    filename: (_req,file,cb)=>{
      const ext=path.extname(file.originalname).toLowerCase();
      cb(null,Date.now()+"-"+Math.random().toString(36).slice(2)+ext);
    }
  }),
  limits:{fileSize:10*1024*1024}
});


// v4 apartment fields migration
const apartmentFieldMigrations = [
  ["rooms", "INTEGER DEFAULT 0"],
  ["bathrooms", "INTEGER DEFAULT 0"],
  ["living_rooms", "INTEGER DEFAULT 0"],
  ["salons", "INTEGER DEFAULT 0"],
  ["balconies", "INTEGER DEFAULT 0"]
];
for (const [field, type] of apartmentFieldMigrations) {
  try { db.prepare(`ALTER TABLE apartments ADD COLUMN ${field} ${type}`).run(); } catch (e) {}
}


// v5 availability-alert fields: each apartment can have its own alert lead time.
for (const [field, type] of [
  ["availability_alert_days", "INTEGER DEFAULT 0"],
  ["availability_alert_enabled", "INTEGER DEFAULT 0"],
  ["code", "TEXT DEFAULT ''"],
  ["rental_type", "TEXT DEFAULT 'شهري'"],
  ["daily_rent", "REAL DEFAULT 0"],
  ["monthly_rent", "REAL DEFAULT 0"],
  ["annual_rent", "REAL DEFAULT 0"],
  ["available_date", "TEXT"],
  ["living_rooms", "INTEGER DEFAULT 0"],
  ["salons", "INTEGER DEFAULT 0"],
  ["balconies", "INTEGER DEFAULT 0"]
]) {
  try { db.prepare(`ALTER TABLE apartments ADD COLUMN ${field} ${type}`).run(); } catch (e) {}
}


// v5.11 tenant renewal toggle.
try { db.prepare(`ALTER TABLE tenants ADD COLUMN renewal_enabled INTEGER NOT NULL DEFAULT 1`).run(); } catch (e) {}

// v5.8: ensure every apartment has a visible internal code.
db.prepare("UPDATE apartments SET code=number WHERE COALESCE(code,'')='' OR code IS NULL").run();
// Final finance/location migrations. Safe on old databases.
for (const [field,type] of [
  ['latitude','REAL'],['longitude','REAL'],['location_url',"TEXT DEFAULT ''"],['location_label',"TEXT DEFAULT ''"]
]) { try { db.prepare(`ALTER TABLE apartments ADD COLUMN ${field} ${type}`).run(); } catch {} }
for (const [field,type] of [
  ['commission','REAL DEFAULT 0'],['commission_type',"TEXT DEFAULT 'ثابت'"]
]) { try { db.prepare(`ALTER TABLE tenants ADD COLUMN ${field} ${type}`).run(); } catch {} }

app.use(express.json({limit:"2mb"}));
app.use("/uploads",express.static(UPLOAD_DIR,{maxAge:"1d"}));
/* Always fetch the current app shell so an old mobile/browser cache cannot
   hide the final UI or an old login script. */
app.get("/health",(req,res)=>res.status(200).json({ok:true,service:"west-amman-property-manager",version:"5.43.1"}));

app.get("/",(req,res)=>{
  res.set("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma","no-cache");
  res.set("Expires","0");
  res.sendFile(path.join(__dirname,"index.html"));
});
app.use(express.static(__dirname,{setHeaders:(res,file)=>{
  if(file.endsWith("index.html")||file.endsWith("sw.js")){
    res.set("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma","no-cache");
    res.set("Expires","0");
  }
}}));

/* Application access policy:
   - The management application is never publicly accessible as an authenticated session.
   - /api/* requires auth except POST /api/login.
   - /property/:id is the ONLY public property-sharing page and intentionally does not require login.
   - Any other unknown browser URL is sent back to the login screen.
   This keeps shared property links public while preventing shared application/dashboard links
   from exposing the management interface. */
app.use((req,res,next)=>{
  if(req.path.startsWith('/api/')) return next();
  if(req.path.startsWith('/uploads/')) return next();
  if(req.path==='/property' || req.path.startsWith('/property/')) return next();
  if(req.path==='/' || req.path==='/manifest.json' || req.path==='/sw.js' || req.path==='/hero-realestate.svg' || req.path==='/luxury-home-hero.jpg') return next();
  if(req.method==='GET' && req.accepts('html')) return res.redirect(302,'/');
  return next();
});

function auth(req,res,next){
 const h=req.headers.authorization||"";
 try{req.user=jwt.verify(h.replace(/^Bearer\s+/,""),JWT_SECRET);next()}
 catch{return res.status(401).json({error:"انتهت الجلسة أو غير مصرح"})}
}
function writeOK(r){return r==="owner"||r==="admin"}
function deleteOK(r){return r==="owner"}
function log(action,detail,who){db.prepare("INSERT INTO logs(action,detail,who) VALUES(?,?,?)").run(action,detail,who)}

app.post("/api/login",(req,res)=>{
 const {username,password}=req.body||{};
 const u=db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(username);
 if(!u || !bcrypt.compareSync(password||"",u.password_hash)) return res.status(401).json({error:"اسم المستخدم أو كلمة المرور غير صحيحة"});
 const token=jwt.sign({id:u.id,username:u.username,role:u.role},JWT_SECRET,{expiresIn:"7d"});
 const permissions=db.prepare("SELECT permission FROM user_permissions WHERE user_id=? AND enabled=1").all(u.id).map(x=>x.permission); res.json({token,user:{id:u.id,username:u.username,role:u.role,permissions}});
});

app.post("/api/change-password",auth,(req,res)=>{
 const {currentPassword,newPassword}=req.body||{};
 if(!currentPassword||!newPassword||String(newPassword).length<6) return res.status(400).json({error:"كلمة المرور الجديدة يجب أن تكون 6 أحرف/أرقام على الأقل"});
 const u=db.prepare("SELECT * FROM users WHERE id=? AND active=1").get(req.user.id);
 if(!u || !bcrypt.compareSync(currentPassword,u.password_hash)) return res.status(401).json({error:"كلمة المرور الحالية غير صحيحة"});
 db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(newPassword,12),u.id);
 log("تغيير كلمة المرور",`تم تغيير كلمة مرور ${u.username}`,req.user.username);
 res.json({ok:true});
});

app.get("/api/bootstrap",auth,(req,res)=>{
 const areas=db.prepare("SELECT * FROM areas ORDER BY name").all();
 const apartments=db.prepare(`SELECT a.*,ar.name area FROM apartments a JOIN areas ar ON ar.id=a.area_id ORDER BY a.id DESC`).all();
 const tenants=db.prepare(`SELECT t.*,a.number apartment,a.area_id FROM tenants t LEFT JOIN apartments a ON a.id=t.apartment_id ORDER BY t.id DESC`).all();
 const payments=db.prepare(`SELECT p.*,t.name tenant FROM payments p LEFT JOIN tenants t ON t.id=p.tenant_id ORDER BY p.payment_date DESC,p.id DESC LIMIT 100`).all();
 const documents=db.prepare("SELECT * FROM documents ORDER BY id DESC LIMIT 100").all();
 const logs=db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 150").all();
 const stats=db.prepare(`SELECT COUNT(*) total,
 SUM(status='متاحة') available,
 SUM(status IN ('قريبة من التوفر','الحجز ينتهي قريباً')) soon,
 SUM(status='مؤجرة / محجوزة') rented,
 SUM(status='غير متاحة / صيانة') repair FROM apartments`).get();
 const money=db.prepare(`SELECT COALESCE(SUM(amount),0) total FROM payments WHERE substr(payment_date,1,7)=strftime('%Y-%m','now')`).get();
 const accounting=db.prepare(`SELECT e.*,a.number apartment,t.name tenant,u.username creator FROM accounting_entries e LEFT JOIN apartments a ON a.id=e.apartment_id LEFT JOIN tenants t ON t.id=e.tenant_id LEFT JOIN users u ON u.id=e.created_by ORDER BY e.entry_date DESC,e.id DESC LIMIT 300`).all();
 const acct=db.prepare(`SELECT
   COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) income,
   COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) expenses,
   COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE 0 END),0) deposits
   FROM accounting_entries`).get();
 const paidRent=db.prepare(`SELECT COALESCE(SUM(amount),0) total FROM payments`).get().total;
 const commissionIncome=db.prepare(`SELECT COALESCE(SUM(amount),0) total FROM accounting_entries WHERE type='income' AND category='عمولة'`).get().total;
 const netProfit=Number(paidRent||0)+Number(acct.income||0)-Number(acct.expenses||0);
 res.json({areas,apartments,tenants,payments,documents,logs,stats,money,accounting,accountingSummary:{income:Number(acct.income||0)+Number(paidRent||0),expenses:Number(acct.expenses||0),deposits:Number(acct.deposits||0),netProfit:Number(netProfit)}});
});


const ADMIN_PERMISSIONS=["home","apartments","tenants","finance","chat","logs"];
function hasPerm(user,perm){
  if(user?.role==="owner") return true;
  if(user?.role!=="admin") return false;
  return !!db.prepare("SELECT 1 FROM user_permissions WHERE user_id=? AND permission=? AND enabled=1").get(user.id,perm);
}
function permissionForPath(path){
  if(path==="/api/home") return "home";
  if(path.includes("/api/apartments") || path.includes("/api/documents")) return "apartments";
  if(path.includes("/api/tenants")) return "tenants";
  if(path.includes("/api/payments")) return "finance";
  if(path.includes("/api/messages")) return "chat";
  if(path.includes("/api/logs")) return "logs";
  return null;
}
function writeOKFor(req){
  if(req.user.role==="owner") return true;
  if(req.user.role!=="admin") return false;
  const p=permissionForPath(req.path);
  return p ? hasPerm(req.user,p) : false;
}
function deleteOKFor(req){
  return req.user.role==="owner";
}

app.get("/api/users",auth,(req,res)=>{
 if(!deleteOKFor(req)) return res.status(403).json({error:"للمالك فقط"});
 res.json(db.prepare("SELECT id,username,role,active,created_at FROM users ORDER BY id").all());
});
app.post("/api/users",auth,(req,res)=>{
 if(!deleteOKFor(req)) return res.status(403).json({error:"للمالك فقط"});
 const {username,password,role}=req.body;
 if(!username||!password||!["owner","admin","user"].includes(role)) return res.status(400).json({error:"بيانات المستخدم ناقصة"});
 try{
   db.prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)").run(username,bcrypt.hashSync(password,12),role);
   const id=db.prepare("SELECT id FROM users WHERE username=?").get(username)?.id; log("إضافة مستخدم",`تمت إضافة ${username}`,req.user.username); res.json({ok:true,id});
 }catch{res.status(409).json({error:"اسم المستخدم موجود مسبقاً"})}
});
app.put("/api/users/:id",auth,(req,res)=>{
 if(!deleteOKFor(req)) return res.status(403).json({error:"للمالك فقط"});
 const {role,active,password}=req.body;
 if(password) db.prepare("UPDATE users SET role=?,active=?,password_hash=? WHERE id=?").run(role,active?1:0,bcrypt.hashSync(password,12),req.params.id);
 else db.prepare("UPDATE users SET role=?,active=? WHERE id=?").run(role,active?1:0,req.params.id);
 log("تعديل مستخدم",`تم تعديل المستخدم ${req.params.id}`,req.user.username);res.json({ok:true});
});

app.get("/api/users/:id/permissions",auth,(req,res)=>{
 if(req.user.role!=="owner") return res.status(403).json({error:"المالك فقط"});
 const id=Number(req.params.id);
 const user=db.prepare("SELECT id,username,role,active FROM users WHERE id=?").get(id);
 if(!user) return res.status(404).json({error:"المستخدم غير موجود"});
 const rows=db.prepare("SELECT permission FROM user_permissions WHERE user_id=? AND enabled=1").all(id);
 res.json({user:{...user,permissions:rows.map(x=>x.permission)}});
});
app.put("/api/users/:id/permissions",auth,(req,res)=>{
 if(req.user.role!=="owner") return res.status(403).json({error:"المالك فقط"});
 const id=Number(req.params.id), {permission,enabled}=req.body||{};
 const allowed=["home","apartments","tenants","finance","chat","logs","view_apartments","view_tenants","view_finance","view_chat","view_logs"];
 if(!allowed.includes(permission)) return res.status(400).json({error:"صلاحية غير معروفة"});
 const user=db.prepare("SELECT id,role FROM users WHERE id=?").get(id);
 if(!user || user.role==="owner") return res.status(404).json({error:"لا يمكن تعديل صلاحيات هذا المستخدم"});
 db.prepare("INSERT INTO user_permissions(user_id,permission,enabled) VALUES(?,?,?) ON CONFLICT(user_id,permission) DO UPDATE SET enabled=excluded.enabled").run(id,permission,enabled?1:0);
 log("تعديل صلاحيات مستخدم",`تم ${enabled?'تفعيل':'إلغاء'} ${permission} للمستخدم ${id}`,req.user.username);
 res.json({ok:true});
});
app.get("/api/admin-permissions",auth,(req,res)=>{
  if(req.user.role!=="owner") return res.status(403).json({error:"المالك فقط"});
  const users=db.prepare("SELECT id,username,role,active FROM users WHERE role='admin' ORDER BY id").all();
  const rows=db.prepare("SELECT user_id,permission FROM user_permissions WHERE enabled=1").all();
  const map={}; rows.forEach(r=>(map[r.user_id]??=[]).push(r.permission));
  res.json({users:users.map(u=>({...u,permissions:map[u.id]||[]}))});
});
app.put("/api/admin-permissions/:id",auth,(req,res)=>{
  if(req.user.role!=="owner") return res.status(403).json({error:"المالك فقط"});
  const id=Number(req.params.id), {permission,enabled}=req.body||{};
  if(!ADMIN_PERMISSIONS.includes(permission)) return res.status(400).json({error:"صلاحية غير معروفة"});
  const u=db.prepare("SELECT id,role FROM users WHERE id=?").get(id);
  if(!u || u.role!=="admin") return res.status(404).json({error:"مستخدم Admin غير موجود"});
  db.prepare("INSERT INTO user_permissions(user_id,permission,enabled) VALUES(?,?,?) ON CONFLICT(user_id,permission) DO UPDATE SET enabled=excluded.enabled").run(id,permission,enabled?1:0);
  log("تعديل صلاحية Admin",`تم ${enabled?'تفعيل':'إلغاء'} صلاحية ${permission} للمستخدم ${id}`,req.user.username);
  res.json({ok:true});
});


app.post("/api/apartments",auth,(req,res)=>{
  if(!writeOKFor(req)) return res.status(403).json({error:"صلاحية العرض فقط"});
  const x=req.body||{};
  if(!x.number||!x.area_id) return res.status(400).json({error:"رقم الشقة والمنطقة مطلوبان"});
  const code=String(x.code||x.number).trim();
  const rentalType=["يومي","شهري","سنوي"].includes(x.rental_type)?x.rental_type:"شهري";
  const r=db.prepare(`INSERT INTO apartments(number,code,area_id,status,rent,rooms,baths,kitchen,floor,size_m2,notes,rental_type,daily_rent,monthly_rent,annual_rent,available_date,living_rooms,salons,balconies,availability_alert_days,availability_alert_enabled,latitude,longitude,location_url,location_label)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    x.number,code,x.area_id,x.status||"متاحة",x.rent||0,x.rooms||1,x.baths||1,x.kitchen||1,x.floor||1,x.size_m2||0,x.notes||"",rentalType,x.daily_rent||0,x.monthly_rent||0,x.annual_rent||0,x.available_date||null,x.living_rooms||0,x.salons||0,x.balconies||0,x.availability_alert_days||0,x.availability_alert_enabled?1:0,x.latitude||null,x.longitude||null,x.location_url||"",x.location_label||"");
  log("إضافة شقة",`تمت إضافة الشقة ${x.number}`,req.user.username);res.json({id:r.lastInsertRowid});
});

app.put("/api/apartments/:id",auth,(req,res)=>{
  if(!writeOKFor(req)) return res.status(403).json({error:"لا تملك صلاحية التعديل"});
  const x=req.body||{};
  const rentalType=["يومي","شهري","سنوي"].includes(x.rental_type)?x.rental_type:"شهري";
  db.prepare(`UPDATE apartments SET number=?,code=?,area_id=?,status=?,rent=?,rooms=?,baths=?,kitchen=?,floor=?,size_m2=?,notes=?,rental_type=?,daily_rent=?,monthly_rent=?,annual_rent=?,available_date=?,living_rooms=?,salons=?,balconies=?,availability_alert_days=?,availability_alert_enabled=?,latitude=?,longitude=?,location_url=?,location_label=? WHERE id=?`)
    .run(x.number,String(x.code||x.number),x.area_id,x.status||"متاحة",x.rent||0,x.rooms||1,x.baths||1,x.kitchen||1,x.floor||1,x.size_m2||0,x.notes||"",rentalType,x.daily_rent||0,x.monthly_rent||0,x.annual_rent||0,x.available_date||null,x.living_rooms||0,x.salons||0,x.balconies||0,x.availability_alert_days||0,x.availability_alert_enabled?1:0,x.latitude||null,x.longitude||null,x.location_url||"",x.location_label||"",req.params.id);
  log("تعديل شقة",`تم تعديل الشقة ${x.number}`,req.user.username);res.json({ok:true});
});

app.delete("/api/apartments/:id",auth,(req,res)=>{
 autoBackup("before-apartment-delete");
 if(!deleteOKFor(req)) return res.status(403).json({error:"الحذف متاح للمالك فقط"});
 const a=db.prepare("SELECT number FROM apartments WHERE id=?").get(req.params.id);
 db.prepare("DELETE FROM apartments WHERE id=?").run(req.params.id);
 log("حذف شقة",`تم حذف الشقة ${a?.number||req.params.id}`,req.user.username);res.json({ok:true});
});

app.post("/api/tenants",auth,(req,res)=>{
 if(!writeOKFor(req)) return res.status(403).json({error:"صلاحية العرض فقط"});
 const x=req.body||{};
 const r=db.prepare(`INSERT INTO tenants(name,apartment_id,phone,national_id,status,contract_start,contract_end,monthly_rent,deposit,commission,commission_type,notes,renewal_enabled)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(x.name,x.apartment_id||null,x.phone||"",x.national_id||"",x.status||"نشط",x.contract_start||null,x.contract_end||null,x.monthly_rent||0,x.deposit||0,x.commission||0,x.commission_type||"ثابت",x.notes||"",x.renewal_enabled===false?0:1);
 log("إضافة مستأجر",`تمت إضافة المستأجر ${x.name}`,req.user.username);res.json({ok:true,id:r.lastInsertRowid});
});
app.put("/api/tenants/:id",auth,(req,res)=>{
 if(!writeOKFor(req)) return res.status(403).json({error:"لا تملك صلاحية التعديل"});
 const x=req.body||{};
 db.prepare(`UPDATE tenants SET name=?,apartment_id=?,phone=?,national_id=?,status=?,contract_start=?,contract_end=?,monthly_rent=?,deposit=?,commission=?,commission_type=?,notes=?,renewal_enabled=? WHERE id=?`)
 .run(x.name,x.apartment_id||null,x.phone||"",x.national_id||"",x.status||"نشط",x.contract_start||null,x.contract_end||null,x.monthly_rent||0,x.deposit||0,x.commission||0,x.commission_type||"ثابت",x.notes||"",x.renewal_enabled===false?0:1,req.params.id);
 log("تعديل مستأجر",`تم تعديل المستأجر ${x.name}`,req.user.username);res.json({ok:true});
});

app.post("/api/payments",auth,(req,res)=>{
 if(!writeOKFor(req)) return res.status(403).json({error:"صلاحية العرض فقط"});
 const x=req.body;
 db.prepare("INSERT INTO payments(tenant_id,amount,payment_date,method,reference,notes) VALUES(?,?,?,?,?,?)").run(x.tenant_id||null,x.amount,x.payment_date,x.method||"نقدي",x.reference||"",x.notes||"");
 log("إضافة دفعة",`تم تسجيل دفعة بقيمة ${x.amount}`,req.user.username);res.json({ok:true});
});

app.post("/api/apartments/:id/photos",auth,upload.array("photos",30),(req,res)=>{
 if(!writeOKFor(req)) return res.status(403).json({error:"صلاحية العرض فقط"});
 const a=db.prepare("SELECT id,number FROM apartments WHERE id=?").get(req.params.id);
 if(!a) return res.status(404).json({error:"الشقة غير موجودة"});
 const files=req.files||[];
 if(!files.length) return res.status(400).json({error:"اختر صورة واحدة على الأقل"});
 const allowed=new Set([".jpg",".jpeg",".png",".webp"]);
 const bad=files.find(f=>!allowed.has(path.extname(f.originalname).toLowerCase()));
 if(bad){ for(const f of files) try{fs.unlinkSync(f.path)}catch{}; return res.status(400).json({error:"يسمح فقط بصور JPG وPNG وWEBP"}); }
 const ins=db.prepare("INSERT INTO documents(apartment_id,filename,original_name,kind) VALUES(?,?,?,?)");
 const out=[];
 const tx=db.transaction(()=>{ for(const f of files){ ins.run(a.id,f.filename,f.originalname,"صورة شقة"); out.push({url:"/uploads/"+f.filename,name:f.originalname}); } });
 tx();
 log("رفع صور شقة",`تم رفع ${files.length} صورة للشقة ${a.number}`,req.user.username);
 res.json({ok:true,photos:out});
});


app.post("/api/apartments/:id/video",auth,videoUpload.single("video"),(req,res)=>{
 if(!writeOKFor(req)) return res.status(403).json({error:"صلاحية العرض فقط"});
 const a=db.prepare("SELECT id,number FROM apartments WHERE id=?").get(req.params.id);
 if(!a) { if(req.file) try{fs.unlinkSync(req.file.path)}catch{}; return res.status(404).json({error:"الشقة غير موجودة"}); }
 if(!req.file) return res.status(400).json({error:"اختر فيديو"});
 const old=db.prepare("SELECT * FROM documents WHERE apartment_id=? AND kind='فيديو شقة'").all();
 const ins=db.prepare("INSERT INTO documents(apartment_id,filename,original_name,kind) VALUES(?,?,?,?)");
 const r=ins.run(a.id,req.file.filename,req.file.originalname,"فيديو شقة");
 log("رفع فيديو شقة",`تم رفع فيديو للشقة ${a.number}`,req.user.username);
 res.json({ok:true,id:r.lastInsertRowid,url:"/uploads/"+req.file.filename});
});

app.delete("/api/documents/:id",auth,(req,res)=>{
 autoBackup("before-document-delete");
 if(!writeOKFor(req)) return res.status(403).json({error:"لا تملك صلاحية الحذف"});
 const d=db.prepare("SELECT * FROM documents WHERE id=?").get(req.params.id);
 if(!d) return res.status(404).json({error:"الصورة غير موجودة"});
 db.prepare("DELETE FROM documents WHERE id=?").run(d.id);
 try{fs.unlinkSync(path.join(UPLOAD_DIR,d.filename))}catch{}
 log("حذف صورة",`تم حذف ${d.original_name}`,req.user.username);
 res.json({ok:true});
});

app.post("/api/documents",auth,upload.single("file"),(req,res)=>{
 if(!writeOKFor(req)) return res.status(403).json({error:"صلاحية العرض فقط"});
 if(!req.file) return res.status(400).json({error:"اختر ملفاً"});
 db.prepare("INSERT INTO documents(apartment_id,tenant_id,filename,original_name,kind) VALUES(?,?,?,?,?)")
 .run(req.body.apartment_id||null,req.body.tenant_id||null,req.file.filename,req.file.originalname,req.body.kind||"مستند");
 log("رفع مستند",`تم رفع ${req.file.originalname}`,req.user.username);
 res.json({ok:true,url:"/uploads/"+req.file.filename});
});


app.get("/api/messages",auth,(req,res)=>{
 if(!["owner","admin"].includes(req.user.role)) return res.status(403).json({error:"المحادثة بين المالك وAdmin فقط"});
 const rows=db.prepare(`SELECT * FROM messages
   WHERE sender_username IN (SELECT username FROM users WHERE role IN ('owner','admin'))
   ORDER BY id DESC LIMIT 200`).all().reverse();
 res.json(rows);
});
app.post("/api/messages",auth,(req,res)=>{
 if(!["owner","admin"].includes(req.user.role)) return res.status(403).json({error:"المحادثة بين المالك وAdmin فقط"});
 const message=String(req.body?.message||"").trim();
 if(!message || message.length>2000) return res.status(400).json({error:"اكتب رسالة صحيحة (حتى 2000 حرف)"});
 const r=db.prepare("INSERT INTO messages(sender_id,sender_username,recipient_role,message) VALUES(?,?,?,?)")
   .run(req.user.id,req.user.username,req.user.role==="owner"?"admin":"owner",message);
 log("رسالة داخلية",`أرسل ${req.user.username} رسالة إلى ${req.user.role==="owner"?"Admin":"المالك"}`,req.user.username);
 res.json({ok:true,id:r.lastInsertRowid});
});

app.delete("/api/logs",auth,(req,res)=>{
 autoBackup("before-log-delete");
  if(req.user.role!=="owner") return res.status(403).json({error:"مسح السجل متاح للمالك فقط"});
  db.prepare("DELETE FROM logs").run();
  log("مسح السجل","تم مسح سجل العمليات بالكامل",req.user.username);
  res.json({ok:true});
});

app.get("/api/backup/status",auth,(req,res)=>{
  if(req.user.role!=="owner") return res.status(403).json({error:"صلاحية المالك فقط"});
  const files=fs.readdirSync(BACKUP_DIR).filter(f=>f.endsWith(".zip")).sort().reverse().slice(0,10);
  const state=readBackupState();
  res.json({ok:true,state,backups:files.map(name=>{const st=fs.statSync(path.join(BACKUP_DIR,name));return {name,size:st.size,created_at:st.mtime.toISOString()};})});
});
app.post("/api/backup/now",auth,async(req,res)=>{
  if(req.user.role!=="owner") return res.status(403).json({error:"صلاحية المالك فقط"});
  const result=await autoBackup("manual");
  if(!result.ok) return res.status(500).json({error:result.error||"تعذر إنشاء النسخة الاحتياطية"});
  log("نسخة احتياطية","تم إنشاء نسخة احتياطية يدوية",req.user.username);
  res.json(result);
});
app.get("/api/backup/download/:name",auth,(req,res)=>{
  if(req.user.role!=="owner") return res.status(403).json({error:"صلاحية المالك فقط"});
  const name=path.basename(String(req.params.name||""));
  if(!/^west-amman-[A-Za-z0-9_-]+\.zip$/.test(name)) return res.status(400).json({error:"اسم نسخة غير صالح"});
  const file=path.join(BACKUP_DIR,name);
  if(!fs.existsSync(file)) return res.status(404).json({error:"النسخة غير موجودة"});
  res.download(file,name);
});

app.post("/api/backup/restore/:name",auth,async(req,res)=>{
  if(req.user.role!=="owner") return res.status(403).json({error:"الاسترجاع متاح للمالك فقط"});
  const name=path.basename(String(req.params.name||""));
  if(!/^west-amman-[A-Za-z0-9_-]+\.zip$/.test(name)) return res.status(400).json({error:"اسم نسخة غير صالح"});
  const archive=path.join(BACKUP_DIR,name);
  if(!fs.existsSync(archive)) return res.status(404).json({error:"النسخة غير موجودة"});
  const temp=path.join(BACKUP_DIR,`.restore-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const protectedArchive=path.join(__dirname,`.restore-protected-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
  let switched=false, oldDb=null, oldUploads=null;
  try{
    fs.copyFileSync(archive,protectedArchive);
    const pre=await autoBackup("before-restore");
    if(!pre.ok) return res.status(500).json({error:"تعذر إنشاء نسخة أمان قبل الاسترجاع"});
    fs.mkdirSync(temp,{recursive:true});
    const listing=await listBackupArchive(protectedArchive);
    const unsafe=listing.find(x=>x.startsWith("/") || x.includes("../") || x.includes("\\"));
    if(unsafe) throw Error("النسخة الاحتياطية غير صالحة للاسترجاع");
    if(!listing.includes("data.db") || !listing.some(x=>x==="uploads" || x.startsWith("uploads/"))) throw Error("النسخة لا تحتوي على قاعدة البيانات والصور");
    await extractBackupData(protectedArchive,temp);
    if(!fs.existsSync(path.join(temp,"data.db"))) throw Error("قاعدة البيانات غير موجودة داخل النسخة");
    if(!fs.existsSync(path.join(temp,"uploads"))) throw Error("مجلد الصور غير موجود داخل النسخة");
    fs.writeFileSync(RESTORE_STATE,JSON.stringify({backup:name,user:req.user.username,requestedAt:new Date().toISOString(),preRestoreBackup:pre.file},null,2));
    try{db.pragma("wal_checkpoint(TRUNCATE)");}catch{}
    db.close();
    const stamp=Date.now();
    oldDb=DB_FILE+`.pre-restore-${stamp}`;
    oldUploads=UPLOAD_DIR+`.pre-restore-${stamp}`;
    fs.renameSync(DB_FILE,oldDb);
    for(const suffix of ["-wal","-shm"]){if(fs.existsSync(DB_FILE+suffix)) fs.renameSync(DB_FILE+suffix,oldDb+suffix);}
    fs.renameSync(UPLOAD_DIR,oldUploads);
    fs.renameSync(path.join(temp,"data.db"),DB_FILE);
    fs.renameSync(path.join(temp,"uploads"),UPLOAD_DIR);
    switched=true;
    try{fs.rmSync(oldDb,{force:true});fs.rmSync(oldDb+"-wal",{force:true});fs.rmSync(oldDb+"-shm",{force:true});fs.rmSync(oldUploads,{recursive:true,force:true});}catch{}
    res.json({ok:true,message:"تم تجهيز الاسترجاع. سيعاد تشغيل الموقع تلقائيًا."});
    setTimeout(()=>process.exit(0),700);
  }catch(e){
    if(!switched){
      try{if(!fs.existsSync(DB_FILE) && oldDb && fs.existsSync(oldDb)) fs.renameSync(oldDb,DB_FILE);}catch{}
      try{if(!fs.existsSync(UPLOAD_DIR) && oldUploads && fs.existsSync(oldUploads)) fs.renameSync(oldUploads,UPLOAD_DIR);}catch{}
      try{if(fs.existsSync(RESTORE_STATE)) fs.unlinkSync(RESTORE_STATE);}catch{}
    }
    if(!res.headersSent) res.status(500).json({error:String(e.message||e)});
  }finally{try{fs.rmSync(temp,{recursive:true,force:true});}catch{} try{fs.rmSync(protectedArchive,{force:true});}catch{}}
});
app.get("/api/export/full-backup",auth,(req,res)=>res.status(410).json({error:"الحفظ اليدوي للنسخة الكاملة غير متاح؛ النسخ الاحتياطي التلقائي يحفظ البيانات والصور كل 24 ساعة ويحتفظ بآخر 10 نسخ"}));

app.get('/api/accounting',auth,(req,res)=>{
  if(!['owner','admin'].includes(req.user.role)) return res.status(403).json({error:'غير مصرح'});
  const rows=db.prepare(`SELECT e.*,a.number apartment,t.name tenant FROM accounting_entries e LEFT JOIN apartments a ON a.id=e.apartment_id LEFT JOIN tenants t ON t.id=e.tenant_id ORDER BY e.entry_date DESC,e.id DESC LIMIT 500`).all();
  const s=db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) income,COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) expenses,COALESCE(SUM(CASE WHEN type='deposit' THEN amount ELSE 0 END),0) deposits FROM accounting_entries`).get();
  const rent=db.prepare(`SELECT COALESCE(SUM(amount),0) total FROM payments`).get().total;
  res.json({entries:rows,summary:{income:Number(s.income)+Number(rent),rent:Number(rent),expenses:Number(s.expenses),deposits:Number(s.deposits),netProfit:Number(s.income)+Number(rent)-Number(s.expenses)}});
});
app.post('/api/accounting',auth,(req,res)=>{
  if(!['owner','admin'].includes(req.user.role)) return res.status(403).json({error:'غير مصرح'});
  const x=req.body||{}; const type=['income','expense','deposit'].includes(x.type)?x.type:'income'; const amount=Number(x.amount||0);
  if(!(amount>0)||!x.entry_date) return res.status(400).json({error:'أدخل المبلغ والتاريخ'});
  const r=db.prepare(`INSERT INTO accounting_entries(apartment_id,tenant_id,type,category,amount,entry_date,description,created_by) VALUES(?,?,?,?,?,?,?,?)`).run(x.apartment_id||null,x.tenant_id||null,type,String(x.category||'أخرى'),amount,x.entry_date,String(x.description||''),req.user.id);
  log('إضافة حركة محاسبية',`${type} ${amount} د.أ — ${x.category||'أخرى'}`,req.user.username); res.json({ok:true,id:r.lastInsertRowid});
});
app.delete('/api/accounting/:id',auth,(req,res)=>{
  if(req.user.role!=='owner') return res.status(403).json({error:'المالك فقط'});
  db.prepare('DELETE FROM accounting_entries WHERE id=?').run(req.params.id); log('حذف حركة محاسبية',`تم حذف الحركة ${req.params.id}`,req.user.username); res.json({ok:true});
});

app.get("/api/export/apartments.csv",auth,(req,res)=>{
 const rows=db.prepare(`SELECT a.number,ar.name area,a.status,a.rent,a.rooms,a.baths,a.floor,a.size_m2,a.notes FROM apartments a JOIN areas ar ON ar.id=a.area_id ORDER BY a.id`).all();
 const header="number,area,status,rent,rooms,baths,floor,size_m2,notes\n";
 const csv=header+rows.map(r=>[r.number,r.area,r.status,r.rent,r.rooms,r.baths,r.floor,r.size_m2,r.notes].map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
 res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition","attachment; filename=apartments.csv");res.send("\uFEFF"+csv);
});

app.get('/property/:id',(req,res)=>{
  const a=db.prepare(`SELECT a.*,ar.name area FROM apartments a JOIN areas ar ON ar.id=a.area_id WHERE a.id=?`).get(req.params.id);
  if(!a) return res.status(404).send('<h2 style="font-family:Arial;text-align:center">الشقة غير موجودة</h2>');
  const photos=db.prepare(`SELECT filename,original_name FROM documents WHERE apartment_id=? AND kind='صورة شقة' ORDER BY id DESC`).all(a.id);
  const map=a.location_url || (a.latitude&&a.longitude?`https://www.google.com/maps?q=${a.latitude},${a.longitude}`:'');
  const photo=photos[0]?.filename?`<img src="/uploads/${encodeURIComponent(photos[0].filename)}" style="width:100%;max-height:420px;object-fit:cover;border-radius:18px">`:'';
  const share= `${req.protocol}://${req.get('host')}/property/${a.id}`;
  res.type('html').send(`<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>شقة ${String(a.number).replace(/</g,'')}</title><style>body{margin:0;background:#07101a;color:#fff;font-family:Arial,sans-serif}.wrap{max-width:900px;margin:auto;padding:18px}.brand{color:#e5b957;font-size:24px;font-weight:900;margin:10px 0 18px}.card{background:#101b27;border:1px solid #8f6b2a;border-radius:22px;padding:16px;box-shadow:0 12px 40px #0006}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:15px}.item{background:#172433;border-radius:14px;padding:12px}.item b{display:block;color:#f0cc76;margin-bottom:5px}.price{font-size:25px;color:#f0cc76;font-weight:900;margin:18px 0}.btn{display:inline-block;background:#e1b451;color:#111;padding:12px 16px;border-radius:12px;text-decoration:none;font-weight:900;margin:5px}.muted{color:#b9c2cc}</style><div class="wrap"><div class="brand">عقارات عمان الغربية<br><small class="muted">WEST AMMAN REAL ESTATE</small></div><div class="card">${photo}<h1>شقة ${String(a.number).replace(/</g,'')}</h1><div class="muted">${String(a.area||'')}</div><div class="grid"><div class="item"><b>الغرف</b>${a.rooms||0}</div><div class="item"><b>الحمامات</b>${a.baths||0}</div><div class="item"><b>المساحة</b>${a.size_m2||0} م²</div><div class="item"><b>الطابق</b>${a.floor||0}</div><div class="item"><b>الحالة</b>${String(a.status||'')}</div></div><div class="price">${Number(a.monthly_rent||a.rent||0).toLocaleString()} د.أ / ${String(a.rental_type||'شهري')}</div>${map?`<a class="btn" href="${map}" target="_blank" rel="noopener">📍 فتح الموقع</a><a class="btn" href="https://wa.me/?text=${encodeURIComponent('موقع شقة '+a.number+' في '+(a.area||'')+'\n'+map)}">🟢 إرسال الموقع واتساب</a>`:''}<a class="btn" href="https://wa.me/?text=${encodeURIComponent('شقة '+a.number+' — '+(a.area||'')+'\n'+share)}">🟢 مشاركة الشقة</a><p class="muted">هذه صفحة عرض عامة ولا تتطلب تسجيل دخول.</p></div></div></html>`);
});

app.use((req,res,next)=>{
 if(req.method==="GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/uploads/"))
   return res.sendFile(path.join(__dirname,"index.html"));
 next();
});


// v4 share endpoint: owner-only metadata payload for native Web Share.
app.get('/api/apartments/:id/share', auth, (req,res)=>{
  if (req.user?.role !== 'owner') return res.status(403).json({error:'الخاصية متاحة للمالك فقط'});
  const a = db.prepare('SELECT * FROM apartments WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({error:'الشقة غير موجودة'});
  res.json({apartment:a});
});


// v5 availability-alert endpoint: returns only configured, upcoming apartments.
app.get('/api/availability-alerts', auth, (req,res)=>{
  if (!['owner','admin'].includes(req.user?.role))
    return res.status(403).json({error:'غير مصرح'});
  const rows = db.prepare(`
    SELECT * FROM apartments
    WHERE COALESCE(availability_alert_enabled,0)=1
      AND COALESCE(availability_alert_days,0)>0
  `).all();
  const now = new Date();
  const alerts = rows.map(a=>{
    // Use explicit available_from when present; otherwise infer from end_date.
    const raw = a.available_date;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Math.ceil((d-now)/86400000);
    return {...a, days_until_available:diff};
  }).filter(Boolean)
    .filter(a=>a.days_until_available>=0 && a.days_until_available<=a.availability_alert_days)
    .sort((a,b)=>a.days_until_available-b.days_until_available);
  res.json({alerts});
});


// final availability dashboard counter
app.get('/api/availability-dashboard', auth, (req,res)=>{
  if (!['owner','admin'].includes(req.user?.role))
    return res.status(403).json({error:'غير مصرح'});
  const rows = db.prepare(`
    SELECT id, number, code, available_date,
           availability_alert_days, availability_alert_enabled
    FROM apartments
    WHERE COALESCE(availability_alert_enabled,0)=1
      AND COALESCE(availability_alert_days,0)>0
  `).all();
  const now = new Date();
  const alerts = rows.map(a=>{
    const raw = a.available_date;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    const days = Math.ceil((d-now)/86400000);
    if (days < 0 || days > a.availability_alert_days) return null;
    return {id:a.id, code:a.code||a.number, name:a.number, available_date:raw,
            days_until_available:days, alert_days:a.availability_alert_days};
  }).filter(Boolean).sort((a,b)=>a.days_until_available-b.days_until_available);
  res.json({count:alerts.length, alerts});
});

app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager: http://localhost:${PORT}`));
