/* Runs before application scripts. Separate local archives for each verified account. */
(()=>{'use strict';
 const cfg=window.LUKI_CONFIG;if(!cfg||!/^\w[\w-]*$/.test(cfg.app)||!/^[a-f0-9]{64}$/.test(cfg.user))throw Error('Identità di prova non valida');
 const nativeLocal=window.localStorage,nativeSession=window.sessionStorage;
 const native={get:Storage.prototype.getItem,set:Storage.prototype.setItem,remove:Storage.prototype.removeItem,key:Storage.prototype.key,open:indexedDB.open.bind(indexedDB),del:indexedDB.deleteDatabase.bind(indexedDB),transaction:IDBDatabase.prototype.transaction};
 const controlKey=`luki-control:${cfg.app}:${cfg.user}`;
 const readControl=()=>JSON.parse(native.get.call(nativeLocal,controlKey)||'null');
 let ctl=readControl();if(!ctl){ctl={generation:crypto.randomUUID(),databases:[],baseRevision:0,baseHash:null,stamp:crypto.randomUUID(),enabled:false};native.set.call(nativeLocal,controlKey,JSON.stringify(ctl));}
 const generation=ctl.generation,prefix=`luki:${cfg.app}:${cfg.user}:${generation}:`;
 function update(patch){const current=readControl();if(current.generation!==generation)throw Error('Archivio cambiato: riapri la pagina');native.set.call(nativeLocal,controlKey,JSON.stringify({...current,...patch}));}
 function assertWritable(){const c=readControl();if(c.generation!==generation||c.frozen)throw Error('Archivio in ripristino: attendi e riapri la pagina');}
 function changed(){const c=readControl();if(c.generation===generation)update({stamp:crypto.randomUUID()});}
 function scoped(storage){return new Proxy(Object.create(null),{
  get(_target,key){
   if(key==='getItem')return name=>native.get.call(storage,prefix+String(name));
   if(key==='setItem')return (name,value)=>{assertWritable();native.set.call(storage,prefix+String(name),String(value));changed();};
   if(key==='removeItem')return name=>{assertWritable();native.remove.call(storage,prefix+String(name));changed();};
   if(key==='clear')return ()=>{assertWritable();for(const name of keys(storage))native.remove.call(storage,prefix+name);changed();};
   if(key==='key')return i=>keys(storage)[i]??null;
   if(key==='length')return keys(storage).length;
   if(typeof key==='symbol')return undefined;
   return native.get.call(storage,prefix+key);
  },
  set(_target,key,value){assertWritable();native.set.call(storage,prefix+String(key),String(value));changed();return true;},
  deleteProperty(_target,key){assertWritable();native.remove.call(storage,prefix+String(key));changed();return true;},
  ownKeys(){return keys(storage);},getOwnPropertyDescriptor(){return {enumerable:true,configurable:true};}
 });}
 function keys(storage){const out=[];for(let i=0;i<storage.length;i++){const k=native.key.call(storage,i);if(k?.startsWith(prefix))out.push(k.slice(prefix.length));}return out.sort();}
 Object.defineProperty(window,'localStorage',{value:scoped(nativeLocal),configurable:false});
 Object.defineProperty(window,'sessionStorage',{value:scoped(nativeSession),configurable:false});
 indexedDB.open=function(name,version){const c=readControl();const names=new Set(c.databases);names.add(String(name));update({databases:[...names].sort()});const r=version===undefined?native.open(prefix+name):native.open(prefix+name,version);r.addEventListener('upgradeneeded',()=>{assertWritable();r.transaction.addEventListener('complete',changed);});return r;};
 indexedDB.deleteDatabase=function(name){assertWritable();const r=native.del(prefix+name);r.addEventListener('success',()=>{update({databases:readControl().databases.filter(n=>n!==String(name))});changed();});return r;};
 IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(this.name.startsWith(prefix)&&mode==='readwrite')assertWritable();const tx=native.transaction.call(this,stores,mode,...rest);if(this.name.startsWith(prefix)&&mode==='readwrite')tx.addEventListener('complete',changed);return tx;};
 // Internal transport uses the original APIs, outside the application namespace.
 Object.defineProperty(window,'LukiStorage',{value:{cfg,prefix,generation,controlKey,native,nativeLocal,nativeSession,readControl,update,keys:()=>keys(nativeLocal),changed},writable:false});
 window.addEventListener('storage',event=>{if(event.key===controlKey){const c=readControl();if(c.generation!==generation){document.documentElement.inert=true;location.reload();}}});
 // Service-worker offline caches must never serve another authenticated user's copy.
 if(navigator.serviceWorker)navigator.serviceWorker.register=async()=>{throw Error('Cache offline della prova disattivata per isolamento account');};
})();
