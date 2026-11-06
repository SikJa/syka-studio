import { useCallback, useEffect, useRef, useState } from 'react'

/** La voz del sistema en el idioma de la app, si hay; si no, la que elija el sistema. */
function spanishVoice(): SpeechSynthesisVoice | null {
  const voices = globalThis.speechSynthesis.getVoices()
  const language = (globalThis.navigator.language || 'es').slice(0, 2)
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(language) && voice.localService) ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(language)) ?? null
}

/** Lo que se lee de una respuesta en Markdown: el texto de los enlaces y sin marcas. */
export function spokenText(markdown: string): string {
  return markdown
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/[*_`#>~|]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

/** Lee un texto con la síntesis de voz del sistema; pulsar otra vez lo corta. */
export function useReadAloud(text: string): { readonly reading: boolean; readonly toggle: (() => void) | undefined } {
  const [reading, setReading] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const supported = typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined'

  // Al irse la fila (otro chat, otra respuesta), deja de leer lo suyo.
  useEffect(
    () => () => {
      if (utteranceRef.current !== null) globalThis.speechSynthesis.cancel()
    },
    []
  )

  const toggle = useCallback(() => {
    const synth = globalThis.speechSynthesis
    if (utteranceRef.current !== null) {
      utteranceRef.current = null
      synth.cancel()
      setReading(false)
      return
    }
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(spokenText(text))
    const voice = spanishVoice()
    if (voice !== null) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    const finish = (): void => {
      if (utteranceRef.current !== utterance) return
      utteranceRef.current = null
      setReading(false)
    }
    utterance.addEventListener('end', finish)
    utterance.addEventListener('error', finish)
    utteranceRef.current = utterance
    setReading(true)
    synth.speak(utterance)
  }, [text])

  return { reading, toggle: supported ? toggle : undefined }
}
