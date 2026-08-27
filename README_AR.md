# عقارات غرب عمان — FINAL SUPABASE + WhatsApp Images

هذه الحزمة Flat: كل الملفات في جذر ZIP بدون مجلدات.

## الملفات
- index.html — الواجهة والتصميم.
- app.js — البحث، سجل البحث الأفقي، الشقق، التنبيهات، تسجيل الدخول، المديرون، واتساب.
- server.js — API + Supabase Auth + Database + Storage.
- SUPABASE_SETUP_WEST_AMMAN.sql — الجداول وBucket.
- render.yaml — إعداد Render.
- package.json — تشغيل Node/Express.
- manifest.json — PWA.
- VERSION.txt — رقم النسخة.

## Supabase / Render
أضف في Render Environment Variables:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_BUCKET=property-images
ثم نفّذ SQL بالكامل في Supabase SQL Editor.

## الصور
عند إضافة/تعديل الشقة يتم ضغط الصور على الهاتف، ثم يرفعها الخادم إلى Supabase Storage ويخزن روابط الصور فقط في قاعدة البيانات. الحد الأقصى 10 صور.

## واتساب
زر واتساب يجمع التفاصيل المنسقة بإيموجي ويجهز أول 10 صور كصور JPEG حقيقية عبر Web Share API، ثم يفتح قائمة المشاركة في الهاتف لاختيار WhatsApp. لا يتم وضع روابط الصور داخل الرسالة عند نجاح مشاركة الملفات.
إذا كان المتصفح/نظام الهاتف لا يدعم مشاركة الملفات المتعددة، لا يمكن لصفحة ويب إجبار WhatsApp على إرفاق الصور تلقائياً؛ في هذه الحالة يتم نسخ النص وفتح WhatsApp كحل بديل.

## مهم
لا تضع Service Role Key داخل app.js أو index.html.
لا ترفع ZIP نفسه إلى Render؛ ارفع محتوياته إلى جذر GitHub.
