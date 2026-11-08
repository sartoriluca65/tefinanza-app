// Entry point condiviso da sorgenti statici e protezione di compatibilità del Worker.
export const STARTUP_MARKER='TEFINANZA_STARTUP_AFTER_UI_V1';
export const READY_STARTUP=`/* ${STARTUP_MARKER} */
if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',()=>void initialize(),{once:true});
}else{
 void initialize();
}`;
export function withReadyUI(source){
 if(source.includes(STARTUP_MARKER))return source;
 const patched=source.replace(/^initialize\(\);[ \t]*$/m,READY_STARTUP);
 if(patched===source)throw Error('Entrypoint TEFinanza non riconosciuto: nessuna trasformazione applicata.');
 return patched;
}
