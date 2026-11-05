/**
 * Limpieza de un `whisper-server` huérfano. Si el núcleo se cae con el
 * servidor en marcha, el proceso hijo sigue vivo con el modelo en memoria
 * (cientos de MB). Se apunta su pid al arrancarlo y, al volver a empezar, se
 * cierra si ese pid sigue siendo un `whisper-server`: nunca otro proceso que
 * haya heredado el número.
 */
import { execFile } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { rmSync, writeFileSync } from 'node:fs'

export type ProcessNameLookup = (pid: number) => Promise<string | null>

/** Nombre del ejecutable de un pid, o null si no existe. */
export function systemProcessName(platform: NodeJS.Platform): ProcessNameLookup {
  return (pid) =>
    new Promise((resolve) => {
      const windows = platform === 'win32'
      const command = windows ? 'tasklist' : 'ps'
      const args = windows ? ['/FI', `PID eq ${String(pid)}`, '/FO', 'CSV', '/NH'] : ['-p', String(pid), '-o', 'comm=']
      execFile(command, args, { timeout: 5000, windowsHide: true }, (error, stdout) => {
        if (error !== null) {
          resolve(null)
          return
        }
        const text = String(stdout).trim()
        // tasklist: "whisper-server.exe","1234",...; ps: la ruta del ejecutable.
        const name = windows ? (/^"([^"]+)"/.exec(text)?.[1] ?? null) : text
        resolve(name === null || name === '' ? null : name)
      })
    })
}

export function isWhisperServerName(name: string): boolean {
  const base = name.replaceAll('\\', '/').split('/').at(-1) ?? ''
  return /^whisper-server(?:\.exe)?$/i.test(base)
}

/** Apunta (o borra, con null) el pid del servidor en marcha. Sin errores: es solo una ayuda. */
export function rememberServerPid(pidFile: string, pid: number | null): void {
  try {
    if (pid === null) rmSync(pidFile, { force: true })
    else writeFileSync(pidFile, String(pid))
  } catch {
    // Sin carpeta de datos o sin permiso: no pasa nada.
  }
}

export interface ReapDeps {
  readonly pidFile: string
  readonly processName: ProcessNameLookup
  readonly kill: (pid: number) => void
}

/** Cierra el servidor que dejó un núcleo anterior. Devuelve true si había uno. */
export async function reapOrphanServer(deps: ReapDeps): Promise<boolean> {
  let pid: number
  try {
    pid = Number.parseInt((await readFile(deps.pidFile, 'utf8')).trim(), 10)
  } catch {
    return false
  }
  await rm(deps.pidFile, { force: true })
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false
  const name = await deps.processName(pid)
  if (name === null || !isWhisperServerName(name)) return false
  try {
    deps.kill(pid)
    return true
  } catch {
    return false
  }
}
