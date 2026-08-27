# عقارات غرب عمان — FINAL SUPABASE

هذه النسخة Flat: جميع الملفات في جذر المشروع بدون مجلدات.

## الملفات
- index.html — الواجهة والتصميم المتجاوب.
- app.js — كل وظائف الواجهة، البحث، السجل، الصور، واتساب، الصلاحيات.
- server.js — API آمن يتعامل مع Supabase Service Role.
- SUPABASE_SETUP_WEST_AMMAN.sql — الجداول وStorage.
- package.json — التشغيل.
- render.yaml — النشر على Render.

## Supabase
في Render أضف:
SUPABASE_URL = رابط مشروع Supabase
SUPABASE_SERVICE_ROLE_KEY = Service Role Key
SUPABASE_BUCKET = property-images

نفّذ ملف SQL في Supabase SQL Editor.

## تسجيل الدخول
تسجيل الدخول بالبريد وكلمة المرور عبر Supabase Auth.
المالك فقط يستطيع إنشاء مديرين.
لا توجد كلمات مرور ثابتة داخل التطبيق.

## واتساب
زر واتساب للمالك يجهز نص التفاصيل مرة واحدة ويحاول مشاركة حتى 10 صور كملفات أصلية عبر Web Share API في الهاتف. إذا كان المتصفح لا يدعم مشاركة الملفات، يتم فتح WhatsApp بالنص المنسق فقط؛ هذا قيد من المتصفح وليس من قاعدة البيانات.

## النشر من الهاتف
ارفع محتويات ZIP إلى جذر مستودع GitHub، ثم Deploy latest commit في Render.
لا ترفع ZIP نفسه إلى Render.

## ملاحظة
لا يمكن ضمان "100%" قبل تشغيل المشروع على حساب Supabase/Render الفعلي، لأن نجاح الدخول والتخزين يعتمد على قيم البيئة وتهيئة Auth/Storage في الحساب.


## إصلاح الشاشة السوداء
تمت إضافة معالجة فشل اتصال Supabase بحيث تظهر الواجهة بدل بقاء الصفحة فارغة، مع رسالة إعداد واضحة، وحماية من أخطاء localStorage وأخطاء JavaScript غير المعالجة.
