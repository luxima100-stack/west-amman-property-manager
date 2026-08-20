
/* Reliable confirmation helper: v5.18 backup UI must not depend on a missing function. */
async function v58Confirm(title,message){
  return window.confirm((title||"تأكيد")+"\n\n"+(message||"هل تريد المتابعة؟"));
}
