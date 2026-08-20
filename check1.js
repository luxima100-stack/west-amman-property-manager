
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
   var t=await r.text(),j={};try{j=JSON.parse(t)}catch(_){throw Error("الخادم لم يُرجع استجابة صحيحة")};
   if(!r.ok||!j.token)throw Error(j.error||"اسم المستخدم أو كلمة المرور غير صحيحة");
   localStorage.setItem("wa_token",j.token);localStorage.setItem("wa_me",JSON.stringify(j.user||{}));
   if(typeof token!=="undefined")token=j.token;if(typeof me!=="undefined")me=j.user;
   // Show the application immediately, then load the data with retries.
   if(typeof D!=="undefined")D={areas:[],apartments:[],tenants:[],payments:[],documents:[],logs:[],stats:{total:0,available:0,soon:0,rented:0,repair:0},money:{total:0}};
   e.className="notice";e.style.display="block";e.textContent="تم تسجيل الدخول، جارٍ تحميل البيانات…";
   if(typeof render==="function")render();
   async function getData(){
     for(let attempt=1;attempt<=3;attempt++){
       try{
         const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
         const rr=await fetch("/api/bootstrap",{headers:{Authorization:"Bearer "+j.token},credentials:"same-origin",signal:ctl.signal});
         clearTimeout(timer);
         const txt=await rr.text();let data={};try{data=JSON.parse(txt)}catch{}
         if(rr.ok){if(typeof D!=="undefined")D=data;if(typeof render==="function")render();return true}
         if(attempt===3)throw Error(data.error||"تعذر تحميل بيانات النظام");
       }catch(x){if(attempt===3)throw x;await new Promise(r=>setTimeout(r,1200))}
     }
   }
   try{await getData();}catch(x){
     e.className="notice danger-note";e.style.display="block";
     e.textContent="تم الدخول بنجاح، لكن تعذر تحميل البيانات. اضغط تحديث الصفحة للمحاولة مرة أخرى.";
     b.disabled=false;b.textContent="إعادة تحميل البيانات";
     b.onclick=function(){location.reload()};
     return;
   }
 }catch(x){
   e.className="notice danger-note";e.style.display="block";e.textContent=x.message||"تعذر تسجيل الدخول";
   b.disabled=false;b.textContent="تسجيل الدخول";
 }
};
})();
