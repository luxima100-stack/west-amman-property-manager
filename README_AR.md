# عقارات غرب عمان — النسخة النهائية v16

هذه النسخة مبنية على التصميم العربي الفخم للمشروع المرفوع، لكن تم تغيير التخزين من localStorage إلى Supabase حتى لا تختفي البيانات والصور عند تحديث الموقع.

## صلاحيات الضيف
- صفحة الهبوط.
- محرك البحث.
- مشاهدة الشقق.
- فتح تفاصيل الشقة والصور والفيديو إن وجد.
- لا توجد لوحة تحكم ولا إعدادات ولا إضافة/تعديل.

## صلاحيات المالك والمدير
- تسجيل دخول بالبريد وكلمة المرور.
- لوحة إدارة.
- إضافة وتعديل الشقق.
- رفع حتى 30 صورة JPG/PNG/WEBP إلى Supabase Storage.
- بيانات الشقق محفوظة في Supabase Database.
- المالك يستطيع إنشاء حسابات مديرين.

## الملفات
كل الملفات في جذر المشروع مباشرة ولا يوجد مجلد داخلي داخل ZIP.

## إعداد Supabase
1. افتح مشروع Supabase.
2. الصق محتوى SUPABASE_SETUP.sql في SQL Editor وشغله.
3. لا تضع Service Role Key داخل المتصفح.

## إعداد Render
Environment Variables:
SUPABASE_URL = رابط مشروع Supabase
SUPABASE_SERVICE_ROLE_KEY = Service Role Key
SUPABASE_BUCKET = property-images
BOOTSTRAP_OWNER_EMAIL = بريد المالك
BOOTSTRAP_OWNER_PASSWORD = كلمة مرور المالك (8 أحرف أو أكثر)
BOOTSTRAP_ADMIN_EMAIL = بريد المدير
BOOTSTRAP_ADMIN_PASSWORD = كلمة مرور المدير (8 أحرف أو أكثر)

Build Command: npm install
Start Command: npm start
Root Directory: فارغ

بعدها Deploy.
لا تحتاج إلى تعديل الكود.


## ربط Supabase
Project URL:
https://ssliofqtuaasshqcjile.supabase.co

استخدم Publishable Key في الواجهة فقط. لا تضع Secret Key داخل ملفات الموقع.
اسم Bucket للصور: property-images
الحد الأقصى للصور للشقة: 30 صورة.
