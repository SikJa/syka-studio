import { deflateRawSync } from 'node:zlib'

export interface ZipTestEntry { readonly path: string; readonly data: Uint8Array; readonly deflate: boolean }

export function buildZip(entries: readonly ZipTestEntry[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.path)
    const body = entry.deflate ? new Uint8Array(deflateRawSync(entry.data)) : entry.data
    const local = new Uint8Array(30 + name.length + body.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04_03_4b_50, true)
    lv.setUint16(8, entry.deflate ? 8 : 0, true)
    lv.setUint32(18, body.length, true)
    lv.setUint32(22, entry.data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(body, 30 + name.length)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02_01_4b_50, true)
    cv.setUint16(10, entry.deflate ? 8 : 0, true)
    cv.setUint32(20, body.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06_05_4b_50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const all = [...locals, ...centrals, end]
  const zip = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of all) {
    zip.set(part, at)
    at += part.length
  }
  return zip
}
