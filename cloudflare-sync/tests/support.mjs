import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function makeEnv(app='cartella-clinica'){
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const DB={prepare(query){return {bind(...params){const statement=sql.prepare(query);return {async first(){return statement.get(...params)||null;},async all(){return {results:statement.all(...params)};},async run(){return {meta:{changes:statement.run(...params).changes}};}};}};}};
 const objects=new Map();const FILES={async put(key,value){const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);objects.set(key,bytes);},async get(key){const bytes=objects.get(key);return bytes?{body:bytes,size:bytes.length}:null;},async head(key){const bytes=objects.get(key);return bytes?{size:bytes.length}:null;}};
 return {APP:app,DB,FILES,RELEASE_MODE:'staging',ORIGIN:'http://127.0.0.1',sql,objects};
}
export const USER={id:'a'.repeat(64),email:'synthetic@example.invalid'};
export function request(env,path,body,extra={},method=body===undefined?'GET':'POST'){
 return new Request(env.ORIGIN+'/_sync/'+path,{method,headers:{Origin:env.ORIGIN,'X-Luki-User':USER.id,'X-Luki-Request':'1','Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
}
