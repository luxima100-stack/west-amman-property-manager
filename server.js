import express from "express";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

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
 const x=req.body;
 if(!x.number||!x.area_id) return res.status(400).json({error:"رقم الشقة والمنطقة مطلوبان"});
 const r=db.prepare(`INSERT INTO apartments(number,area_id,status,rent,rooms,baths,kitchen,floor,size_m2,notes)
 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(x.number,x.area_id,x.status,x.rent||0,x.rooms||1,x.baths||1,x.kitchen||1,x.floor||1,x.size_m2||0,x.notes||"");
 log("إضافة شقة",`تمت إضافة الشقة ${x.number}`,req.user.username);res.json({id:r.lastInsertRowid});
});
app.put("/api/apartments/:id",auth,(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"لا تملك صلاحية التعديل"});
 const x=req.body;
 db.prepare(`UPDATE apartments SET number=?,area_id=?,status=?,rent=?,rooms=?,baths=?,kitchen=?,floor=?,size_m2=?,notes=? WHERE id=?`)
 .run(x.number,x.area_id,x.status,x.rent||0,x.rooms||1,x.baths||1,x.kitchen||1,x.floor||1,x.size_m2||0,x.notes||"",req.params.id);
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
 const x=req.body;
 db.prepare(`INSERT INTO tenants(name,apartment_id,phone,national_id,status,contract_start,contract_end,monthly_rent,deposit,notes)
 VALUES(?,?,?,?,?,?,?,?,?,?)`).run(x.name,x.apartment_id||null,x.phone||"",x.national_id||"",x.status||"نشط",x.contract_start||null,x.contract_end||null,x.monthly_rent||0,x.deposit||0,x.notes||"");
 log("إضافة مستأجر",`تمت إضافة المستأجر ${x.name}`,req.user.username);res.json({ok:true});
});
app.put("/api/tenants/:id",auth,(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"لا تملك صلاحية التعديل"});
 const x=req.body;
 db.prepare(`UPDATE tenants SET name=?,apartment_id=?,phone=?,national_id=?,status=?,contract_start=?,contract_end=?,monthly_rent=?,deposit=?,notes=? WHERE id=?`)
 .run(x.name,x.apartment_id||null,x.phone||"",x.national_id||"",x.status||"نشط",x.contract_start||null,x.contract_end||null,x.monthly_rent||0,x.deposit||0,x.notes||"",req.params.id);
 log("تعديل مستأجر",`تم تعديل المستأجر ${x.name}`,req.user.username);res.json({ok:true});
});

app.post("/api/payments",auth,(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
 const x=req.body;
 db.prepare("INSERT INTO payments(tenant_id,amount,payment_date,method,reference,notes) VALUES(?,?,?,?,?,?)").run(x.tenant_id||null,x.amount,x.payment_date,x.method||"نقدي",x.reference||"",x.notes||"");
 log("إضافة دفعة",`تم تسجيل دفعة بقيمة ${x.amount}`,req.user.username);res.json({ok:true});
});

app.post("/api/documents",auth,upload.single("file"),(req,res)=>{
 if(!writeOK(req.user.role)) return res.status(403).json({error:"صلاحية العرض فقط"});
 if(!req.file) return res.status(400).json({error:"اختر ملفاً"});
 db.prepare("INSERT INTO documents(apartment_id,tenant_id,filename,original_name,kind) VALUES(?,?,?,?,?)")
 .run(req.body.apartment_id||null,req.body.tenant_id||null,req.file.filename,req.file.originalname,req.body.kind||"مستند");
 log("رفع مستند",`تم رفع ${req.file.originalname}`,req.user.username);
 res.json({ok:true,url:"/uploads/"+req.file.filename});
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

app.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager: http://localhost:${PORT}`));
