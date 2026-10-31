import type { CompileResult } from '@desktop/main-channels';

/** An external editor may save an imported module a moment after its caller. */
export async function compileSettledSource(compile: () => Promise<CompileResult>): Promise<CompileResult> {
  const delays = [180, 420];
  let result = await compile();
  for (const delay of delays) {
    if (result.ok) return result;
    await new Promise<void>(resolve => setTimeout(resolve, delay));
    result = await compile();
  }
  // Keep a real persistent failure visible. Never substitute a cached bundle.
  return result;
}
