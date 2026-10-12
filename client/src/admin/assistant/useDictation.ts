import { useCallback, useEffect, useRef, useState } from 'react'

// Голосовий ввід через вбудоване розпізнавання браузера (Chrome, Android, Safari на iOS).
// Безкоштовно, без OpenAI: мамі простіше сказати, ніж надрукувати.

interface RecognitionResult {
  0: { transcript: string }
  isFinal: boolean
}

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type RecognitionCtor = new () => Recognition

const Ctor = (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
  .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition

export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const callback = useRef(onText)
  callback.current = onText

  useEffect(() => () => rec.current?.stop(), [])

  const toggle = useCallback(() => {
    if (!Ctor) return
    if (rec.current) {
      rec.current.stop()
      return
    }
    const r = new Ctor()
    r.lang = 'uk-UA'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      callback.current(text)
    }
    r.onend = r.onerror = () => {
      rec.current = null
      setListening(false)
    }
    rec.current = r
    setListening(true)
    r.start()
  }, [])

  return { supported: !!Ctor, listening, toggle }
}
