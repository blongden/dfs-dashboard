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

function drawFavicon(count: number, originalDataUrl: string | null) {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const finish = () => {
    if (count > 0) {
      // Red badge circle in top-right corner
      ctx.beginPath()
      ctx.arc(24, 8, 8, 0, 2 * Math.PI)
      ctx.fillStyle = '#dc2626'
      ctx.fill()
    }
    getFaviconEl().href = canvas.toDataURL('image/png')
  }

  if (originalDataUrl) {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 32, 32)
      finish()
    }
    img.src = originalDataUrl
  } else {
    // Fallback: plain blue square if the SVG can't be loaded
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(0, 0, 32, 32)
    finish()
  }
}

export function useTabAlert(count: number) {
  const originalFaviconUrl = useRef<string | null>(null)
  const originalTitle = useRef<string>(BASE_TITLE)

  // Capture the original favicon data URL once on mount
  useEffect(() => {
    const el = getFaviconEl()
    if (!el.href) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0, 32, 32)
      originalFaviconUrl.current = canvas.toDataURL('image/png')
    }
    img.onerror = () => {
      originalFaviconUrl.current = null
    }
    img.src = el.href
  }, [])

  useEffect(() => {
    if (count > 0) {
      document.title = `(${count}) ${BASE_TITLE}`
      drawFavicon(count, originalFaviconUrl.current)
    } else {
      document.title = originalTitle.current
      drawFavicon(0, originalFaviconUrl.current)
    }
  }, [count])
}
