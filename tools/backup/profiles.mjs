// Explicit allowlists: no auth sessions, API keys, remembered access keys or directory handles.
const make=(id,kind,localKeys,databases=[],extra={})=>({id,kind,localKeys,databases,...extra});
export const diviso=make('diviso','diviso',['diviso-v2']);
export const rifornio=make('rifornio','rifornio',['rifornioVehicles','rifornioEntries','pienosmartTripDraftV1','pienosmartRecordedTrips','rifornio-before-import-v1']);
export const stickers=make('stickers','stickers',['ss-stickers','ss-packs'],[{name:'luki-stickers',stores:['stickers']}]);
export const cochiPrivate=make('cochi-private','cochi',['cochi-desktop-v1','cochi-before-restore-v1'],[],{stateKey:'cochi-desktop-v1'});
export const cochiPublic=make('cochi-public','cochi',['cochi-open-local-v1','cochi-before-restore-v1','cochi-full-private-v2','cochi-private-vault-v1'],[],{stateKey:'cochi-open-local-v1'});
export const tefinanza=make('tefinanza','tefinanza',['tefinanza-family-v1'],[
  {name:'TeFinanza-family',stores:['state'],keys:['current','restoreSafety']},
]);
// A database is read in one transaction across both stores. Handles and cloud markers are excluded.
tefinanza.databases=[{name:'TeFinanza-family',stores:['state','files'],keysByStore:{state:['current','restoreSafety']}}];
export function autocontrol(accountId='') {
  if(accountId&&!/^[a-f0-9-]{36}$/i.test(accountId))throw Error('INVALID_ACCOUNT_ID');
  const key=accountId?'autocontrol-account-'+accountId:'autocontrol-v1';
  return make('autocontrol'+(accountId?'-account':'-local'),'autocontrol',
    [key,...(accountId?['autocontrol-draft-'+accountId]:[])],
    [{name:'autocontrol-documents',stores:['scans']},{name:'autocontrol-safety',stores:['snapshots']}],{stateKey:key});
}
export function clinical(profileId='') {
  if(profileId&&!/^[a-f0-9-]{36}$/i.test(profileId))throw Error('INVALID_PROFILE_ID');
  const suffix=profileId?'::family:'+profileId:'',fallbackKey='terapia-demo-fallback-state'+suffix;
  return make('clinical'+(profileId?'-'+profileId:'-main'),'clinical',
    ['terapia-local-family-registry-v1','terapia-local-main-profile-label-v1',fallbackKey,'terapia-demo-fallback-beforeRestore'+suffix],
    [{name:'terapia-demo-github-v1'+suffix,stores:['cache'],keys:['state','beforeRestore']},
     {name:'terapia-demo-files-v1'+suffix,stores:['files']}],{fallbackKey});
}
export const credentialDemo=make('credential-demo','vault',['luca-sartori-ricorda-demo-protected-v2']);
export const all={diviso,rifornio,stickers,cochiPrivate,cochiPublic,tefinanza,autocontrol,clinical,credentialDemo};
