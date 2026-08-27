# عقارات غرب عمان — النسخة النهائية

هذه النسخة مبنية على ملفات التصميم الأصلية، مع إضافة Supabase Auth وقاعدة البيانات وStorage دون استبدال الواجهة.

## الملفات
index.html / app.js / app.css / server.js / package.json / render.yaml / manifest.json / SUPABASE_SETUP_WEST_AMMAN.sql

## Supabase
نفّذ ملف SQL مرة واحدة. في Render يجب أن تكون متغيرات SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY موجودة أصلًا. ويمكن استخدام SUPABASE_BUCKET=property-images وOWNER_EMAIL.

## تسجيل الدخول
المالك يدخل بحساب Supabase. بعد وجود أول profile، لا يسمح التطبيق إلا بحسابات role=owner أو role=admin. المالك يستطيع إنشاء مدير بإيميل وكلمة مرور وتعديل كلمة المرور والصلاحيات.

## الصور وواتساب
الصور تحفظ في Supabase Storage. زر واتساب يجهز النص ويحدد أول 10 صور تلقائيًا ويستخدم مشاركة ملفات الهاتف عندما يدعمها Chrome/Android.
