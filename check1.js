
(function(){
 window.earlyToggle=function(){
   var x=document.getElementById("earlyPass"),b=document.querySelector("#fallbackLogin .v541-eye");
   if(!x)return;
   x.type=x.type==="password"?"text":"password";
   if(b)b.textContent=x.type==="password"?"👁️":"🙈";
 };
 window.earlyLogin=async function(){
 var u=document.getElementById("earlyUser"),p=document.getElementById("earlyPass"),
     b=document.getElementById("earlyBtn"),e=document.getElementById("earlyError");
 try{
   var username=(u.value||"").trim(),password=p.value||"";
   if(!username||!password)throw Error("يرجى إدخال اسم المستخدم وكلمة المرور");
   b.disabled=true;b.textContent="جاري تسجيل الدخول…";e.style.display="none";
   var r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
     body:JSON.stringify({username:username,password:password})});
   var t=await r.text(),j={};
   try{j=JSON.parse(t)}catch(_){throw Error("الخادم لم يُرجع استجابة صحيحة")};
   if(!r.ok||!j.token)throw Error(j.error||"اسم المستخدم أو كلمة المرور غير صحيحة");

   var br=await fetch("/api/bootstrap",{headers:{Authorization:"Bearer "+j.token},credentials:"same-origin"});
   var bt=await br.text(),bd={};
   try{bd=JSON.parse(bt)}catch(_){throw Error("تم تسجيل الدخول لكن تعذر تحميل بيانات النظام")};
   if(!br.ok)throw Error(bd.error||"تم تسجيل الدخول لكن رفض الخادم تحميل بيانات النظام");

   localStorage.setItem("wa_token",j.token);
   localStorage.setItem("wa_me",JSON.stringify(j.user||{}));
   if(typeof token!=="undefined")token=j.token;
   if(typeof me!=="undefined")me=j.user;
   if(typeof D!=="undefined")D=bd;
   e.className="notice";e.style.display="block";e.textContent="تم الدخول بنجاح";
   if(typeof render==="function"){setTimeout(function(){try{render()}catch(x){e.className="notice danger-note";e.textContent="تم الدخول لكن واجهة التطبيق فيها خطأ: "+(x.message||x);b.disabled=false;b.textContent="تسجيل الدخول"}},50)}
   else location.reload();
 }catch(x){
   e.className="notice danger-note";e.style.display="block";e.textContent=x.message||"تعذر تسجيل الدخول";
   b.disabled=false;b.textContent="تسجيل الدخول";
 }
};
})();
