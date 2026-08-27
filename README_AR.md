# عقارات غرب عمان — FINAL v20.1.0

هذه النسخة مبنية على النسخة المستقرة السابقة مع توحيد الواجهة والخادم وربط الحفظ بـ Supabase.

## الملفات في جذر ZIP
- index.html
- app.css
- app.js
- server.js
- package.json
- render.yaml
- manifest.json
- SUPABASE_SETUP_WEST_AMMAN.sql
- VERSION.txt
- README_AR.md
- FINAL_VERIFICATION.txt

لا يوجد مجلد داخل ZIP.

## قبل النشر على Render
ضع هذه المتغيرات في Environment:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BUCKET = property-images
- OWNER_EMAIL = بريد حساب المالك في Supabase

ثم نفّذ ملف SQL مرة واحدة في Supabase SQL Editor.

## ما تم إصلاحه
- تسجيل دخول المالك والمديرين عبر Supabase Auth.
- حفظ الشقق في Supabase بدل localStorage.
- رفع الصور JPG / PNG / WEBP إلى Supabase Storage وربط روابطها بالشقة.
- حتى 30 صورة للشقة.
- حذف الصور الجديدة قبل الحفظ وإدارة الصور القديمة.
- سجل البحث كشريط أفقي أعلى النتائج.
- زر × في النوافذ والصفحات الداخلية.
- إعدادات عربية محفوظة في Supabase.
- إضافة وحذف المناطق المخصصة من الإعدادات.
- إدارة المديرين والصلاحيات باللغة العربية.
- تعديل صلاحيات المدير من صفحة إدارة المديرين.
- تغيير كلمة سر المالك من صفحة إدارة المديرين للمالك فقط.
- تنبيه الشقق القريبة من التوفر مع عدد أيام مستقل لكل شقة.
- مشاركة تفاصيل الشقة عبر واتساب، ومحاولة إرفاق حتى 10 صور على الأجهزة التي تدعم Web Share.

## ملاحظة أمنية
لا تضع SUPABASE_SERVICE_ROLE_KEY داخل app.js أو أي ملف يراه المتصفح. يجب أن تبقى في Render Environment فقط.
