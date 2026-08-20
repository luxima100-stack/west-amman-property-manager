from pathlib import Path
p=Path('/mnt/data/project_new/server.js')
s=p.read_text()
# version
s=s.replace('"version": "5.48.1"','"version": "5.49.0"') if False else s
# add tasks table after user_permissions table
needle="""CREATE TABLE IF NOT EXISTS areas(\n id INTEGER PRIMARY KEY AUTOINCREMENT,\n name TEXT UNIQUE NOT NULL\n);"""
repl="""CREATE TABLE IF NOT EXISTS tasks(\n id INTEGER PRIMARY KEY AUTOINCREMENT,\n title TEXT NOT NULL,\n description TEXT DEFAULT '',\n assigned_to INTEGER,\n due_date TEXT,\n status TEXT NOT NULL DEFAULT 'معلقة',\n created_by INTEGER,\n created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n completed_at TEXT,\n FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL,\n FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL\n);\nCREATE TABLE IF NOT EXISTS areas(\n id INTEGER PRIMARY KEY AUTOINCREMENT,\n name TEXT UNIQUE NOT NULL\n);"""
if needle not in s: raise SystemExit('schema needle missing')
s=s.replace(needle,repl,1)
# bootstrap add tasks before res.json
needle=''' const netProfit=Number(paidRent||0)+Number(acct.income||0)-Number(acct.expenses||0);\n res.json({areas,apartments,tenants,payments,documents,logs,stats,money,accounting,accountingSummary:{income:Number(acct.income||0)+Number(paidRent||0),expenses:Number(acct.expenses||0),deposits:Number(acct.deposits||0),netProfit:Number(netProfit)}});'''
repl=''' const netProfit=Number(paidRent||0)+Number(acct.income||0)-Number(acct.expenses||0);\n const tasks=db.prepare(`SELECT t.*,a.username assigned_username,c.username creator_username FROM tasks t LEFT JOIN users a ON a.id=t.assigned_to LEFT JOIN users c ON c.id=t.created_by ORDER BY CASE WHEN t.status='معلقة' THEN 0 ELSE 1 END,t.due_date IS NULL,t.due_date,t.id DESC LIMIT 200`).all();\n res.json({areas,apartments,tenants,payments,documents,logs,stats,money,accounting,accountingSummary:{income:Number(acct.income||0)+Number(paidRent||0),expenses:Number(acct.expenses||0),deposits:Number(acct.deposits||0),netProfit:Number(netProfit)},tasks});'''
if needle not in s: raise SystemExit('bootstrap needle missing')
s=s.replace(needle,repl,1)
# add admin password endpoint before /api/users
needle='''app.get("/api/users",auth,(req,res)=>{'''
repl='''app.put("/api/admins/:id/password",auth,(req,res)=>{\n if(req.user.role!=="owner") return res.status(403).json({error:"المالك فقط يستطيع تغيير كلمة مرور Admin"});\n const id=Number(req.params.id), newPassword=String(req.body?.newPassword||"");\n if(newPassword.length<6) return res.status(400).json({error:"كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل"});\n const u=db.prepare("SELECT id,username,role FROM users WHERE id=? AND role='admin'").get(id);\n if(!u) return res.status(404).json({error:"Admin غير موجود"});\n db.prepare("UPDATE users SET password_hash=?,active=1 WHERE id=?").run(bcrypt.hashSync(newPassword,12),id);\n log("تغيير كلمة مرور Admin",`تم تغيير كلمة مرور ${u.username}`,req.user.username);\n res.json({ok:true});\n});\n\napp.get("/api/tasks",auth,(req,res)=>{\n if(!["owner","admin"].includes(req.user.role)) return res.status(403).json({error:"المهام للمالك وAdmin فقط"});\n const rows=db.prepare(`SELECT t.*,a.username assigned_username,c.username creator_username FROM tasks t LEFT JOIN users a ON a.id=t.assigned_to LEFT JOIN users c ON c.id=t.created_by ORDER BY CASE WHEN t.status='معلقة' THEN 0 ELSE 1 END,t.due_date IS NULL,t.due_date,t.id DESC`).all();\n res.json(rows);\n});\napp.post("/api/tasks",auth,(req,res)=>{\n if(req.user.role!=="owner") return res.status(403).json({error:"إضافة المهام للمالك فقط"});\n const {title,description,assigned_to,due_date}=req.body||{};\n if(!String(title||"").trim()) return res.status(400).json({error:"عنوان المهمة مطلوب"});\n const ass=assigned_to?db.prepare("SELECT id,role FROM users WHERE id=? AND role='admin' AND active=1").get(Number(assigned_to)):null;\n if(assigned_to && !ass) return res.status(400).json({error:"اختر Admin فعالاً"});\n const r=db.prepare("INSERT INTO tasks(title,description,assigned_to,due_date,status,created_by) VALUES(?,?,?,?,?,?)").run(String(title).trim(),String(description||""),ass?.id||null,due_date||null,"معلقة",req.user.id);\n log("إضافة مهمة",`تمت إضافة المهمة ${title}`,req.user.username); res.json({ok:true,id:r.lastInsertRowid});\n});\napp.put("/api/tasks/:id",auth,(req,res)=>{\n if(!["owner","admin"].includes(req.user.role)) return res.status(403).json({error:"غير مصرح"});\n const id=Number(req.params.id), t=db.prepare("SELECT * FROM tasks WHERE id=?").get(id); if(!t) return res.status(404).json({error:"المهمة غير موجودة"});\n const status=req.body?.status;\n if(req.user.role==="admin" && t.assigned_to!==req.user.id) return res.status(403).json({error:"هذه المهمة ليست مسندة إليك"});\n if(!["معلقة","مكتملة"].includes(status)) return res.status(400).json({error:"حالة المهمة غير صحيحة"});\n db.prepare("UPDATE tasks SET status=?,completed_at=? WHERE id=?").run(status,status==="مكتملة"?new Date().toISOString():null,id);\n log(status==="مكتملة"?"إكمال مهمة":"إعادة فتح مهمة",`المهمة ${id}`,req.user.username); res.json({ok:true});\n});\napp.delete("/api/tasks/:id",auth,(req,res)=>{\n if(req.user.role!=="owner") return res.status(403).json({error:"حذف المهام للمالك فقط"});\n db.prepare("DELETE FROM tasks WHERE id=?").run(Number(req.params.id)); log("حذف مهمة",`المهمة ${req.params.id}`,req.user.username); res.json({ok:true});\n});\n\napp.get("/api/users",auth,(req,res)=>{'''
if needle not in s: raise SystemExit('users needle missing')
s=s.replace(needle,repl,1)
# auto enable admin permissions on creation
needle='''   const id=db.prepare("SELECT id FROM users WHERE username=?").get(username)?.id; log("إضافة مستخدم",`تمت إضافة ${username}`,req.user.username); res.json({ok:true,id});'''
repl='''   const id=db.prepare("SELECT id FROM users WHERE username=?").get(username)?.id;\n   if(role==="admin" && id){ const ins=db.prepare("INSERT OR IGNORE INTO user_permissions(user_id,permission,enabled) VALUES(?,?,1)"); for(const perm of ADMIN_PERMISSIONS) ins.run(id,perm); }\n   log("إضافة مستخدم",`تمت إضافة ${username}`,req.user.username); res.json({ok:true,id});'''
if needle not in s: raise SystemExit('add user needle missing')
s=s.replace(needle,repl,1)
# image upload filter and safer multer error handling by increasing limit 20MB and filter
needle='''  limits:{fileSize:10*1024*1024}\n});'''
repl='''  limits:{fileSize:20*1024*1024},\n  fileFilter: (_req,file,cb)=>{ const ok=[".jpg",".jpeg",".png",".webp"].includes(path.extname(file.originalname).toLowerCase()); cb(ok?null:new Error("يسمح فقط بصور JPG وPNG وWEBP"),ok); }\n});'''
if needle not in s: raise SystemExit('upload config missing')
s=s.replace(needle,repl,1)
# add express error middleware near end before listen
needle='''const PORT=process.env.PORT||10000;\napp.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager running on ${PORT}`));'''
repl='''app.use((err,req,res,next)=>{\n if(err){ console.error(err); if(req.path.includes("/photos")){ return res.status(400).json({error:err.message||"تعذر رفع الصور"}); } return res.status(400).json({error:err.message||"حدث خطأ في الطلب"}); }\n next();\n});\n\nconst PORT=process.env.PORT||10000;\napp.listen(PORT,"0.0.0.0",()=>console.log(`West Amman Property Manager running on ${PORT}`));'''
if needle not in s: raise SystemExit('listen needle missing')
s=s.replace(needle,repl,1)
p.write_text(s)

# package version
pp=Path('/mnt/data/project_new/package.json'); ps=pp.read_text().replace('"version": "5.48.1"','"version": "5.49.0"'); pp.write_text(ps)
