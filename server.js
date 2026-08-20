import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_BEFORE_INTERNET_DEPLOYMENT";
const DB_FILE = path.join(__dirname, "data.db");
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, {recursive:true});

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user',
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    db.prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)").run(username,bcrypt.hashSync(password,12),role);
  }
}
seedUser("owner","1234","owner");
seedUser("admin","1234","admin");
seedUser("user","1234","user");

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

app.use(express.json({limit:"2mb"}));
app.use("/uploads",express.static(UPLOAD_DIR));
app.use(express.static(__dirname));

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
 res.json({token,user:{username:u.username,role:u.role}});
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
 res.json({areas,apartments,tenants,payments,documents,logs,stats,money});
});

app.get("/api/users",auth,(req,res)=>{
 if(!deleteOK(req.user.role)) return res.status(403).json({error:"للمالك فقط"});
 res.json(db.prepare("SELECT id,username,role,active,created_at FROM users ORDER BY id").all());
});
app.post("/api/users",auth,(req,res)=>{
 if(!deleteOK(req.user.role)) return res.status(403).json({error:"للمالك فقط"});
 const {username,password,role}=req.body;
 if(!username||!password||!["owner","admin","user"].includes(role)) return res.status(400).json({error:"بيانات المستخدم ناقصة"});
 try{
   db.prepare("INSERT INTO users(username,password_hash,role) VALUES(?,?,?)").run(username,bcrypt.hashSync(password,12),role);
   log("إضافة مستخدم",`تمت إضافة ${username}`,req.user.username); res.json({ok:true});
 }catch{res.status(409).json({error:"اسم المستخدم موجود مسبقاً"})}
});
app.put("/api/users/:id",auth,(req,res)=>{
 if(!deleteOK(req.user.role)) return res.status(403).json({error:"للمالك فقط"});
 const {role,active,password}=req.body;
 if(password) db.prepare("UPDATE users SET role=?,active=?,password_hash=? WHERE id=?").run(role,active?1:0,bcrypt.hashSync(password,12),req.params.id);
 else db.prepare("UPDATE users SET role=?,active=? WHERE id=?").run(role,active?1:0,req.params.id);
 log("تعديل مستخدم",`تم تعديل المستخدم ${req.params.id}`,req.user.username);res.json({ok:true});
});

app.post("/api/apartments",auth,(req,res)=>{
  if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
  const x=req.body||{};
  if(!x.number||!x.area_id) return res.status(400).json({error:"رقم الشقة والمنطقة مطلوبان"});
  const code=String(x.code||x.number).trim();
  const rentalType=["يومي","شهري","سنوي"].includes(x.rental_type)?x.rental_type:"شهري";
  const r=db.prepare(`INSERT INTO apartments(number,code,area_id,status,rent,rooms,baths,kitchen,floor,size_m2,notes,rental_type,daily_rent,monthly_rent,annual_rent,available_date,living_rooms,salons,balconies,availability_alert_days,availability_alert_enabled)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    x.number,code,x.area_id,x.status||"متاحة",x.rent||0,x.rooms||1,x.baths||1,x.kitchen||1,x.floor||1,x.size_m2||0,x.notes||"",rentalType,x.daily_rent||0,x.monthly_rent||0,x.annual_rent||0,x.available_date||null,x.living_rooms||0,x.salons||0,x.balconies||0,x.availability_alert_days||0,x.availability_alert_enabled?1:0);
  log("إضافة شقة",`تمت إضافة الشقة ${x.number}`,req.user.username);res.json({id:r.lastInsertRowid});
});

app.put("/api/apartments/:id",auth,(req,res)=>{
  if(!writeOK(req.user.role)) return res.status(403).json({error:"لا تملك صلاحية التعديل"});
  const x=req.body||{};
  const rentalType=["يومي","شهري","سنوي"].includes(x.rental_type)?x.rental_type:"شهري";
  db.prepare(`UPDATE apartments SET number=?,code=?,area_id=?,status=?,rent=?,rooms=?,baths=?,kitchen=?,floor=?,size_m2=?,notes=?,rental_type=?,daily_rent=?,monthly_rent=?,annual_rent=?,available_date=?,living_rooms=?,salons=?,balconies=?,availability_alert_days=?,availability_alert_enabled=? WHERE id=?`)
    .run(x.number,String(x.code||x.number),x.area_id,x.status||"متاحة",x.rent||0,x.rooms||1,x.baths||1,x.kitchen||1,x.floor||1,x.size_m2||0,x.notes||"",rentalType,x.daily_rent||0,x.monthly_rent||0,x.annual_rent||0,x.available_date||null,x.living_rooms||0,x.salons||0,x.balconies||0,x.availability_alert_days||0,x.availability_alert_enabled?1:0,req.params.id);
  log("تعديل شقة",`تم تعديل الشقة ${x.number}`,req.user.username);res.json({ok:true});
});

app.delete("/api/apartments/:id",auth,(req,res)=>{
 if(!deleteOK(req.user.role)) return res.status(403).json({error:"الحذف متاح للمالك فقط"});
 const a=db.prepare("SELECT number FROM apartments WHERE id=?").get(req.params.id);
 db.prepare("DELETE FROM apartments WHERE id=?").run(req.params.id);
 log("حذف شقة",`تم حذف الشقة ${a?.number||req.params.id}`,req.user.username);res.json({ok:true});
});

app.post("/api/tenants",auth,(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
 const x=req.body||{};
 const r=db.prepare(`INSERT INTO tenants(name,apartment_id,phone,national_id,status,contract_start,contract_end,monthly_rent,deposit,notes,renewal_enabled)
 VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(x.name,x.apartment_id||null,x.phone||"",x.national_id||"",x.status||"نشط",x.contract_start||null,x.contract_end||null,x.monthly_rent||0,x.deposit||0,x.notes||"",x.renewal_enabled===false?0:1);
 log("إضافة مستأجر",`تمت إضافة المستأجر ${x.name}`,req.user.username);res.json({ok:true,id:r.lastInsertRowid});
});
app.put("/api/tenants/:id",auth,(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"لا تملك صلاحية التعديل"});
 const x=req.body||{};
 db.prepare(`UPDATE tenants SET name=?,apartment_id=?,phone=?,national_id=?,status=?,contract_start=?,contract_end=?,monthly_rent=?,deposit=?,notes=?,renewal_enabled=? WHERE id=?`)
 .run(x.name,x.apartment_id||null,x.phone||"",x.national_id||"",x.status||"نشط",x.contract_start||null,x.contract_end||null,x.monthly_rent||0,x.deposit||0,x.notes||"",x.renewal_enabled===false?0:1,req.params.id);
 log("تعديل مستأجر",`تم تعديل المستأجر ${x.name}`,req.user.username);res.json({ok:true});
});

app.post("/api/payments",auth,(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
 const x=req.body;
 db.prepare("INSERT INTO payments(tenant_id,amount,payment_date,method,reference,notes) VALUES(?,?,?,?,?,?)").run(x.tenant_id||null,x.amount,x.payment_date,x.method||"نقدي",x.reference||"",x.notes||"");
 log("إضافة دفعة",`تم تسجيل دفعة بقيمة ${x.amount}`,req.user.username);res.json({ok:true});
});

app.post("/api/apartments/:id/photos",auth,upload.array("photos",30),(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
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
 if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
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
 if(!writeOK(req.user.role)) return res.status(403).json({error:"لا تملك صلاحية الحذف"});
 const d=db.prepare("SELECT * FROM documents WHERE id=?").get(req.params.id);
 if(!d) return res.status(404).json({error:"الصورة غير موجودة"});
 db.prepare("DELETE FROM documents WHERE id=?").run(d.id);
 try{fs.unlinkSync(path.join(UPLOAD_DIR,d.filename))}catch{}
 log("حذف صورة",`تم حذف ${d.original_name}`,req.user.username);
 res.json({ok:true});
});

app.post("/api/documents",auth,upload.single("file"),(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
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
  if(req.user.role!=="owner") return res.status(403).json({error:"مسح السجل متاح للمالك فقط"});
  db.prepare("DELETE FROM logs").run();
  log("مسح السجل","تم مسح سجل العمليات بالكامل",req.user.username);
  res.json({ok:true});
});

app.get("/api/export/full-backup",auth,(req,res)=>{
 if(req.user.role!=="owner") return res.status(403).json({error:"حفظ النسخة الكاملة متاح للمالك فقط"});
 try{ db.pragma("wal_checkpoint(TRUNCATE)"); }catch(e){}
 const stamp=new Date().toISOString().replace(/[:.]/g,"-");
 const out=path.join("/tmp",`west-amman-backup-${stamp}.tar.gz`);
 const items=["data.db","uploads","index.html","server.js","package.json","render.yaml","manifest.json","sw.js","README_AR.md","hero-realestate.svg"];
 execFile("tar",["-czf",out,...items],{cwd:__dirname},(err)=>{
   if(err) return res.status(500).json({error:"تعذر إنشاء النسخة الاحتياطية"});
   res.download(out,"west-amman-backup.tar.gz",()=>{try{fs.unlinkSync(out)}catch(e){}});
 });
});

app.get("/api/export/apartments.csv",auth,(req,res)=>{
 const rows=db.prepare(`SELECT a.number,ar.name area,a.status,a.rent,a.rooms,a.baths,a.floor,a.size_m2,a.notes FROM apartments a JOIN areas ar ON ar.id=a.area_id ORDER BY a.id`).all();
 const header="number,area,status,rent,rooms,baths,floor,size_m2,notes\n";
 const csv=header+rows.map(r=>[r.number,r.area,r.status,r.rent,r.rooms,r.baths,r.floor,r.size_m2,r.notes].map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
 res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition","attachment; filename=apartments.csv");res.send("\uFEFF"+csv);
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
