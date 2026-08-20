
document.addEventListener("DOMContentLoaded",()=>{
  const m=$("modal");
  if(m){m.addEventListener("click",e=>{if(e.target===m)closeM()});}
  document.addEventListener("keydown",e=>{if(e.key==="Escape" && $("modal")?.classList.contains("show"))closeM()});
});
