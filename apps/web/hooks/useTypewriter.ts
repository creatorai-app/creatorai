"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Reveal AI-generated text letter-by-letter into a controlled field, so a
 * "Surprise me" result lands as visible writing rather than a sudden paste.
 */
export function useTypewriter(setText: (v: string) => void, speedMs = 22) {
  const [isTyping, setIsTyping] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const typeOut = (text: string) => {
    if (timer.current) clearInterval(timer.current)
    setIsTyping(true)
    setText("")
    let i = 0
    timer.current = setInterval(() => {
      i += 1
      setText(text.slice(0, i))
      if (i >= text.length) {
        if (timer.current) clearInterval(timer.current)
        timer.current = null
        setIsTyping(false)
      }
    }, speedMs)
  }

  // Stop the animation if the component unmounts mid-type.
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  return { typeOut, isTyping }
}
