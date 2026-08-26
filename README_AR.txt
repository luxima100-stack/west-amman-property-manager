عقارات غرب عمان — النسخة النهائية v18

هذه الحزمة مسطحة بالكامل: كل ملفات المشروع في الجذر بدون مجلدات.

الملفات الرئيسية:
- index.html
- app.js
- app.css
- server.js
- package.json
- render.yaml
- manifest.json
- sw.js
- SUPABASE_SETUP_WEST_AMMAN.sql

ما تم تضمينه:
- تسجيل دخول آمن للمالك والمدير عبر Supabase Auth.
- إنشاء المدير من داخل التطبيق بواسطة المالك فقط.
- تغيير كلمة المرور.
- إضافة/تعديل/حذف الشقق.
- صور JPG/PNG/WEBP حتى 10 صور مع حذف الصور من المعاينة.
- رفع فيديو اختياري.
- بحث وفلاتر الغرف والحمامات والبلكونة والسعر والمنطقة والحالة.
- سجل البحث في صفحة الهبوط على شكل شريط أفقي.
- تفاصيل الشقة مع زر × في كل نافذة.
- نسخ التفاصيل وفتح واتساب.
- تنبيهات الشقق القريبة من التوفر مع عدد الأيام لكل شقة.
- إدارة المستأجرين والمحادثات والتقارير والإعدادات.
- تصميم متجاوب للهاتف والكمبيوتر.

مهم:
1) نفّذ SUPABASE_SETUP_WEST_AMMAN.sql في Supabase.
2) في Render ضع:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   OWNER_EMAIL
   ويمكنك اختيارياً تغيير:
   SUPABASE_IMAGE_BUCKET=property-images
   SUPABASE_VIDEO_BUCKET=property-videos
3) احفظ واختر Save, rebuild, and deploy.
4) ارفع محتويات هذا الملف المضغوط إلى GitHub، وليس ملف ZIP نفسه.

ملاحظة أمنية:
Service Role Key سرية ولا يجب وضعها في app.js أو إرسالها للمتصفح.
