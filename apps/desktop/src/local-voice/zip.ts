/**
 * Lector mínimo de zip: lo justo para sacar `whisper-server` y sus DLL del zip
 * de whisper.cpp sin añadir una dependencia. Lee el directorio central (la
 * fuente fiable de tamaños y desplazamientos) y admite entradas guardadas tal
 * cual o comprimidas con deflate, que es lo que usan esos zips. No hay zip64:
 * el archivo es de pocos MB.
 */
import { inflateRawSync } from 'node:zlib'

export interface ZipEntry {
  /** Ruta dentro del zip, siempre con `/`. */
  readonly path: string
  /** Solo el nombre del archivo. */
  readonly name: string
  readonly data: Uint8Array
}

const EOCD_SIGNATURE = 0x06_05_4b_50
const CENTRAL_SIGNATURE = 0x02_01_4b_50
const LOCAL_SIGNATURE = 0x04_03_4b_50
const STORED = 0
const DEFLATE = 8

export class ZipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZipError'
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  // El registro final mide 22 bytes más un comentario de hasta 64 KB.
  const lowest = Math.max(0, view.byteLength - 22 - 0xff_ff)
  for (let offset = view.byteLength - 22; offset >= lowest; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset
  }
  throw new ZipError('no es un zip: falta el directorio central')
}

/**
 * Extrae las entradas cuyo nombre de archivo cumple `keep`. Las carpetas se
 * ignoran; quien guarda usa solo `name`, así una ruta con `..` no sale nunca
 * de la carpeta de destino.
 */
export function extractZip(bytes: Uint8Array, keep: (name: string) => boolean): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEndOfCentralDirectory(view)
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  const decoder = new TextDecoder()
  const entries: ZipEntry[] = []

  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new ZipError('directorio central dañado')
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const size = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)).replaceAll('\\', '/')
    offset += 46 + nameLength + extraLength + commentLength

    const name = path.split('/').at(-1) ?? ''
    if (name === '' || path.endsWith('/') || !keep(name)) continue

    if (localOffset + 30 > bytes.byteLength || view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new ZipError(`cabecera local dañada: ${path}`)
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const raw = bytes.subarray(start, start + compressedSize)
    if (raw.byteLength !== compressedSize) throw new ZipError(`entrada truncada: ${path}`)

    let data: Uint8Array
    if (method === STORED) data = raw.slice()
    else if (method === DEFLATE) data = new Uint8Array(inflateRawSync(raw))
    else throw new ZipError(`método de compresión no admitido (${String(method)}): ${path}`)
    if (data.byteLength !== size) throw new ZipError(`tamaño inesperado al descomprimir: ${path}`)
    entries.push({ path, name, data })
  }
  return entries
}
