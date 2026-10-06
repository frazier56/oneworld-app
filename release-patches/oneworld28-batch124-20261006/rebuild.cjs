// Rebuild from saved source/configuration/locks into a fresh directory.
// Usage: node rebuild.cjs <new-output-directory>
const fs=require('fs'),path=require('path'),cp=require('child_process');
const dest=path.resolve(process.argv[2]||'rebuild-output');
if(fs.existsSync(dest))throw Error('Choose a fresh output directory; nothing is removed.');
fs.mkdirSync(dest,{recursive:true});
for(const name of ['oneworld-app','oneworld-shell'])fs.cpSync(path.join(__dirname,name),path.join(dest,'source-corrections',name),{recursive:true});
for(const name of ['build-deps','security-deps'])fs.cpSync(path.join(__dirname,'build-inputs',name),path.join(dest,name),{recursive:true});
const npm=process.platform==='win32'?'npm.cmd':'npm';
for(const name of ['build-deps','security-deps','source-corrections/oneworld-app']){
 const cwd=path.join(dest,name);const r=cp.spawnSync(npm,['ci','--ignore-scripts'],{cwd,stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(r.status||1);
}
fs.symlinkSync(path.join(dest,'source-corrections/oneworld-app/node_modules'),path.join(dest,'source-corrections/oneworld-shell/node_modules'),process.platform==='win32'?'junction':'dir');
const r=cp.spawnSync(npm,['run','build'],{cwd:path.join(dest,'source-corrections/oneworld-app'),stdio:'inherit',shell:process.platform==='win32'});process.exit(r.status||0);
