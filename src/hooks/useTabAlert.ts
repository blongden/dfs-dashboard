import { useEffect, useRef } from 'react'

const BASE_TITLE = 'DFS Dashboard'

function getFaviconEl(): HTMLLinkElement {
  let el = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'icon'
    document.head.appendChild(el)
  }
  return el
}

function setBadgeFavicon(originalHref: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 32, 32)
    ctx.beginPath()
    ctx.arc(24, 8, 8, 0, 2 * Math.PI)
    ctx.fillStyle = '#dc2626'
    ctx.fill()
    getFaviconEl().href = canvas.toDataURL('image/png')
  }
  img.onerror = () => {
    // Canvas draw blocked (CSP/cross-origin) — skip favicon badge, title badge still works
  }
  img.crossOrigin = 'anonymous'
  img.src = originalHref
}

export function useTabAlert(count: number) {
  const originalHref = useRef<string>('')

  // Capture original href once on mount, before any badge is applied
  useEffect(() => {
    originalHref.current = getFaviconEl().href
  }, [])

  useEffect(() => {
    if (count > 0) {
      document.title = `(${count}) ${BASE_TITLE}`
      if (originalHref.current) setBadgeFavicon(originalHref.current)
    } else {
      document.title = BASE_TITLE
      // Restore original SVG href directly — no canvas needed
      if (originalHref.current) getFaviconEl().href = originalHref.current
    }
  }, [count])
}
