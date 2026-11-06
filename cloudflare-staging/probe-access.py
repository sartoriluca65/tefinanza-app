import subprocess
from urllib.parse import urlparse
for app,asset in [('tefinanza','/core.js'),('cartella-clinica','/local-files.js'),('registro-credenziali','/index.html')]:
 for path in ['/',asset,'/_sync/head']:
  url='https://luki-'+app+'-staging.sartori-luca65.workers.dev'+path
  r=subprocess.run(['curl','--silent','--show-error','--max-time','15','--output','/dev/null','--dump-header','-','--header','Accept: text/html',url],capture_output=True,text=True,check=True)
  status=None;location=''
  for line in r.stdout.splitlines():
   if line.startswith('HTTP/'):status=int(line.split()[1])
   if line.lower().startswith('location:'):location=line.split(':',1)[1].strip()
  host=urlparse(location).hostname
  assert status==302 and host=='proud-rain-876d.cloudflareaccess.com',(app,path,status,host)
  print('PASS: unauthenticated '+app+' '+path+' redirects to Cloudflare Access')
