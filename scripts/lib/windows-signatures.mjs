import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export function validateWindowsSignatures(report, publisher) {
  if (typeof publisher !== 'string' || !publisher.trim()) throw Error('Set WINDOWS_SIGN_PUBLISHER to the verified certificate Subject.');
  if (!Array.isArray(report) || report.length < 2) throw Error('Missing Windows signature report.');
  for (const file of report) {
    if (file.status !== 'Valid' || !file.codeSigning || !file.timestamped || file.selfSigned) {
      throw Error(`Invalid, untrusted or untimestamped Authenticode signature: ${file.path}`);
    }
    if (file.owned && file.subject !== publisher) throw Error(`Unexpected signing publisher: ${file.path}`);
  }
  if (!report.some(file => file.role === 'app') || !report.some(file => file.role === 'setup')) throw Error('App and installer signatures are required.');
  return {verifiedFiles: report.length, publisher};
}

export function verifyWindowsSignatures(root, packaged, setup, packagePath, publisher) {
  const literal = value => "'" + value.replaceAll("'", "''") + "'";
  const script = readFileSync(join(root, 'scripts/verify-windows-signatures.ps1'), 'utf8').replace(/^\uFEFF/, '');
  // Execute this reviewed verifier as a command, without changing the machine's
  // execution policy. Quote filesystem arguments as PowerShell literals.
  const command = '[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); & {\n' + script + '\n} -AppDirectory ' + literal(packaged) + ' -SetupPath ' + literal(setup) + ' -PackagePath ' + literal(packagePath);
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command],
    {encoding:'utf8', windowsHide:true, maxBuffer:4*1024*1024, timeout:180000,
      // A caller running PowerShell 7 may export its module path. Windows
      // PowerShell 5 needs the Windows modules, not the .NET 7/8 assemblies.
      env:{...process.env, PSModulePath:join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/Modules')}});
  return validateWindowsSignatures(JSON.parse(output.replace(/^\uFEFF/, '').trim()), publisher);
}
