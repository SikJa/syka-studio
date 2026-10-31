import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {ensurePythonTool,pythonToolPath} from './python-tool.mjs';
test('healthy managed Python is reused without downloads',async()=>{
  const root=join(process.cwd(),'.runtime','python-test');
  const path=await ensurePythonTool(root,{execute:async()=>({stdout:''}),installTool:()=>{throw Error('Unexpected download');}});
  assert.equal(path,pythonToolPath(root));
});
test('missing Python uses the verified uv installer without global links or registry registration',async()=>{
  const root=join(process.cwd(),'.runtime','python-test');
  let installed=false,uv=false;
  const execute=async(path,args,options)=>{
    assert.equal(options.windowsHide,true);
    if(path.endsWith('uv.exe')){assert.ok(args.includes('--no-bin'));assert.ok(args.includes('--no-registry'));assert.equal(options.env.UV_PYTHON_INSTALL_DIR,join(root,'python'));installed=true;}
    else if(!installed)throw Error('Missing');
    return {stdout:''};
  };
  await ensurePythonTool(root,{execute,installTool:async(dir,manifest)=>{assert.equal(dir,root);assert.match(manifest.sha256,/^[a-f0-9]{64}$/);uv=true;}});
  assert.equal(uv,true);assert.equal(installed,true);
});
test('a failed post-install check is reported instead of advertising ready',async()=>{
  await assert.rejects(ensurePythonTool('fixture',{execute:async path=>{if(!path.endsWith('uv.exe'))throw Error('Bad Python');return {stdout:''};},installTool:async()=>{}}),/no pasó la comprobación/);
});
