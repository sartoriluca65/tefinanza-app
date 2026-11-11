/* Reintroduce known defects only in an isolated source copy; never touch the checkout. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'tefinanza-mutations-'));
for(const file of fs.readdirSync(root))if(file.endsWith('.js'))fs.copyFileSync(path.join(root,file),path.join(dir,file));fs.cpSync(path.join(root,'tests'),path.join(dir,'tests'),{recursive:true});
const mutations=[
 ['decimal-rounding','accounting.js',"function round(value){return number(quantize(decimal(value)))}","function round(value){return Math.round((Number(value)+Number.EPSILON)*100)/100}"],
 ['unbalanced-transfer','accounting.js',"||cents(rows[0].amount)+cents(rows[1].amount)!==0n",''],
 ['arbitrary-counterpart','core.js',"matches.length===1?matches[0]:null","matches[0]"],
 ['lost-card-credit','dashboard.js',"[cash,portfolio,creditAssets,-liabilities]","[cash,portfolio,-liabilities]"],
 ['partial-cost-residue','workflows.js',"Money.allocate(book,qty,position.qty)","Money.multiply(qty,position.cost)"],
 ['non-atomic-write','core.js',"const next=structuredClone(s);fn(next);","const next=s;fn(next);"]
];
const results=[];
for(const [name,file,from,to] of mutations){const p=path.join(dir,file),original=fs.readFileSync(p,'utf8');if(!original.includes(from))throw Error('Mutation target missing: '+name);fs.writeFileSync(p,original.replace(from,to));const r=spawnSync(process.execPath,['--test','tests/accounting-independent.test.cjs'],{cwd:dir,encoding:'utf8'});fs.writeFileSync(p,original);const output=r.stdout+r.stderr,failures=Number(output.match(/fail (\d+)/)?.[1]||0),detected=r.status!==0&&failures>0;if(!detected)throw Error('Undetected mutation: '+name+'\n'+output);results.push({name,detected,failedTests:failures});console.log('DETECTED',name,'failed tests:',failures)}
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));console.log('6/6 known defects detected. Results:',path.join(dir,'results.json'));
