
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
     localStorage.setItem("wa_token",j.token);
     localStorage.setItem("wa_me",JSON.stringify(j.user||{}));
     e.className="notice";e.style.display="block";e.textContent="تم الدخول، جارٍ فتح النظام…";
     setTimeout(function(){location.reload()},100);
   }catch(x){
     e.className="notice danger-note";e.style.display="block";e.textContent=x.message||"تعذر تسجيل الدخول";
     b.disabled=false;b.textContent="تسجيل الدخول";
   }
 };
})();
