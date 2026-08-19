import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    goatcounter?: {
      count: (opts: { path: string }) => void
    }
  }
}

export function usePageTracking() {
  const location = useLocation()
  useEffect(() => {
    window.goatcounter?.count({ path: location.pathname || '/' })
  }, [location.pathname])
}
