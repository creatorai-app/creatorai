"use client"

import { useEffect, useState } from "react"

/**
 * Controlled value for the "How does it work?" accordions. Open on desktop,
 * collapsed below lg so phones and tablets see the form first.
 */
export function useGuideOpenOnDesktop(itemValue: string) {
  const [value, setValue] = useState(itemValue)

  useEffect(() => {
    if (window.matchMedia("(max-width: 1023px)").matches) setValue("")
  }, [])

  return [value, setValue] as const
}
