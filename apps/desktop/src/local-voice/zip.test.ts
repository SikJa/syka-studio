import { describe, expect, it } from 'vitest'
import { buildZip } from './test-zip'
import { ZipError, extractZip } from './zip'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('extractZip', () => {
  it('saca solo lo que se pide, guardado o comprimido, por nombre de archivo', () => {
    const zip = buildZip([
      { path: 'Release/whisper-server.exe', data: bytes('servidor'.repeat(50)), deflate: true },
      { path: 'Release/ggml.dll', data: bytes('ggml'), deflate: false },
      { path: 'Release/', data: new Uint8Array(0), deflate: false },
      { path: 'Release/bench.exe', data: bytes('no'), deflate: false }
    ])
    const entries = extractZip(zip, (name) => name !== 'bench.exe')
    expect(entries.map((entry) => [entry.path, entry.name])).toEqual([
      ['Release/whisper-server.exe', 'whisper-server.exe'],
      ['Release/ggml.dll', 'ggml.dll']
    ])
    expect(new TextDecoder().decode(entries[0]?.data)).toBe('servidor'.repeat(50))
    expect(new TextDecoder().decode(entries[1]?.data)).toBe('ggml')
  })

  it('una ruta con ".." se queda en su nombre de archivo', () => {
    const entries = extractZip(buildZip([{ path: '../../fuera.dll', data: bytes('x'), deflate: false }]), () => true)
    expect(entries[0]?.name).toBe('fuera.dll')
  })

  it('falla con claridad si no es un zip o está dañado', () => {
    expect(() => extractZip(bytes('esto no es un zip de verdad, solo texto'), () => true)).toThrow(ZipError)
    const zip = buildZip([{ path: 'a.dll', data: bytes('abc'), deflate: false }])
    // Cabecera local rota.
    new DataView(zip.buffer).setUint32(0, 0, true)
    expect(() => extractZip(zip, () => true)).toThrow(/cabecera local/)
  })
})
