import json, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
B='examples/src/bin/'
code={}
for n in ['a01','a02','a03','a04','a05','a06','b07','b08','b09','b10','b11','b12','c13','c14','c15','c16','c17','d18','d19']:
    code[n]=open(B+n+'.rs').read().rstrip()+"\n"
before=open(B+'z20_before.rs').read(); after=open(B+'z20_after.rs').read()
def between(s,a,b):
    i=s.index(a); j=s.index(b,i); return s[i:j].rstrip()+"\n"
code['before_list']=between(before,'#[derive(Clone)]\nstruct AppState','\nasync fn create_note')
code['after_list']=between(after,'#[derive(Clone)]\nstruct AppState','\n#[tokio::main]')
data='const CODE = '+json.dumps(code,ensure_ascii=False)+';\n'+'\n'.join(open('src/'+f).read() for f in ['lessons1.js','lessons2.js','refs.js'])
app=open('src/app.js').read()
assert '</script' not in data and '</script' not in app
head='''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Anneal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..500&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@300..600&display=swap">
<style>
'''
html=head+open('src/app.css').read()+'</style></head><body><div id="app"></div>\n<script>\n'+data+'\n</script>\n<script>\n'+app+'\n</script>\n</body></html>\n'
os.makedirs('site', exist_ok=True)
open('site/index.html','w').write(html); print('site/index.html', len(html), 'bytes')
