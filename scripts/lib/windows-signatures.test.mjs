import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateWindowsSignatures} from './windows-signatures.mjs';
const publisher='CN=Verified Publisher, C=AR';
const report=()=>['app','setup'].map(role=>({path:role+'.exe',role,owned:true,status:'Valid',timestamped:true,codeSigning:true,subject:publisher}));
test('requires both trusted timestamped app and installer signatures from the expected publisher',()=>{
 assert.deepEqual(validateWindowsSignatures(report(),publisher),{verifiedFiles:2,publisher});
 assert.throws(()=>validateWindowsSignatures(report(),''),/WINDOWS_SIGN_PUBLISHER/);
 assert.throws(()=>validateWindowsSignatures([report()[0],{...report()[1],role:'dependency'}],publisher),/installer signatures/);
});
test('rejects unsigned, self-signed, tampered, expired and untimestamped artifacts',()=>{
 for(const invalid of [{status:'NotSigned'},{status:'NotTrusted'},{status:'HashMismatch'},{status:'UnknownError'},{timestamped:false},{codeSigning:false},{selfSigned:true}]) {
  const files=report();Object.assign(files[1],invalid);
  assert.throws(()=>validateWindowsSignatures(files,publisher),/Authenticode/);
 }
});
test('rejects an unexpected app publisher but permits trusted vendor dependencies',()=>{
 const files=report();files[0].subject='CN=Other Publisher';
 assert.throws(()=>validateWindowsSignatures(files,publisher),/Unexpected/);
 const vendor={...report()[0],path:'vendor.dll',role:'dependency',owned:false,subject:'CN=Vendor'};
 assert.equal(validateWindowsSignatures([...report(),vendor],publisher).verifiedFiles,3);
});
