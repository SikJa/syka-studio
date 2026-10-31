import { join, resolve } from 'node:path';

export const GRAPHIFY_PYTHON_VERSION = '3.12.13';
export const GRAPHIFY_PYTHON_DIRECTORY = `cpython-${GRAPHIFY_PYTHON_VERSION}-windows-x86_64-none`;

/** CPython's Windows home is absolute; derive it anew from the moved runtime.
 * Only our managed interpreter is rebased. Never rewrite a user's external Python. */
export function rebaseGraphifyConfig(config, runtime) {
  const home = /^home\s*=\s*(.+)$/m.exec(config)?.[1]?.trim();
  if (!home || !home.replaceAll('\\', '/').endsWith(`/python/${GRAPHIFY_PYTHON_DIRECTORY}`)) return config;
  const current = resolve(runtime, 'python', GRAPHIFY_PYTHON_DIRECTORY);
  if (home === current) return config;
  return config.replace(/^home\s*=.*$/m, `home = ${current}`);
}

export const managedGraphifyPython = runtime => join(runtime, 'python', GRAPHIFY_PYTHON_DIRECTORY, 'python.exe');
