/* MPL-2.0. Project trash is authoritative; external bookkeeping is best effort. */
export async function deleteProjectWithCleanup(dir: string, operations: {
  trash(dir: string): Promise<string>;
  cleanupChats(projectId: string): void | Promise<void>;
}): Promise<void> {
  const projectId = await operations.trash(dir);
  if (!projectId) return;
  try { await operations.cleanupChats(projectId); }
  catch {
    // The folder is already in the Recycle Bin. Rejecting now would leave a
    // stale project record in the renderer and falsely report a failed trash.
    console.warn('[projects] Project moved to trash; chat cleanup could not be confirmed.');
  }
}
