عقارات غرب عمان — النسخة النهائية 19.0.0

المجلد مضغوط بشكل مسطح بدون مجلدات داخلية.

الملفات الأساسية:
index.html
app.css
app.js
server.js
package.json
render.yaml
SUPABASE_SETUP_WEST_AMMAN.sql
manifest.json
sw.js
VERSION.txt

مهم:
1) نفّذ SUPABASE_SETUP_WEST_AMMAN.sql مرة واحدة في Supabase SQL Editor.
2) في Render أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY و OWNER_EMAIL و SUPABASE_BUCKET=property-images.
3) Build Command: npm install
4) Start Command: npm start
5) بعد رفع الملفات استخدم Manual Deploy ثم Clear build cache & deploy إذا كان المتصفح يعرض نسخة قديمة.

هذه النسخة تحفظ الصور في Supabase Storage أولاً ثم تحفظ روابط الصور داخل سجل الشقة، بدلاً من تخزين الصور كـ base64 داخل قاعدة البيانات.
