// Vite treats stdin EOF as shutdown outside CI. A background desktop launch
// must survive its launching terminal/input stream disappearing.
export function backgroundServerEnvironment(env) {
  return { ...env, CI: 'true' };
}
