# عقارات غرب عمان — النسخة الكاملة 17.1

هذه الحزمة تعيد **واجهة المشروع الكاملة** قبل تعديل تسجيل الدخول، مع ربط تسجيل الدخول والعقارات والمديرين وحفظ حالة التطبيق ورفع الصور بـ Supabase.

### Render Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET` = `property-images`
- `OWNER_EMAIL` = بريد المالك في Supabase (يُستخدم عند إنشاء profile تلقائياً لأول حساب).

شغّل `SUPABASE_SETUP_WEST_AMMAN.sql` في Supabase SQL Editor مرة واحدة. ثم ارفع ملفات الحزمة إلى جذر GitHub، وبعدها Manual Deploy في Render.
