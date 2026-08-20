
window.addEventListener("DOMContentLoaded",function(){
  try{
    localStorage.removeItem("wa_token");
    localStorage.removeItem("wa_me");
    token=null; me=null;
    if(typeof login==="function") login();
  }catch(e){
    const root=document.getElementById("root");
    if(root) root.innerHTML='<div class="login"><div class="loginbox"><h1>إدارة عقارات غرب عمّان</h1><p>يرجى إعادة تحميل الصفحة.</p></div></div>';
  }
});