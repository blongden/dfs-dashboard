import { useCallback, useEffect, useState } from 'react'

export type NotificationStatus = 'unsupported' | 'blocked' | 'unasked' | 'disabled' | 'on'

const STORAGE_KEY = 'dfs-notifications-enabled'

function readAppEnabled(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== 'false' } catch { return true }
}

function writeAppEnabled(value: boolean) {
  try { localStorage.setItem(STORAGE_KEY, String(value)) } catch {}
}

function currentPermission(): NotificationPermission {
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied'
}

export function useNotifications(): {
  status: NotificationStatus
  toggle: () => Promise<void>
  notify: (title: string, body: string) => void
} {
  const supported = typeof Notification !== 'undefined'
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission)
  const [appEnabled, setAppEnabled] = useState(readAppEnabled)

  useEffect(() => {
    if (!supported || typeof navigator.permissions === 'undefined') return
    // PermissionState uses 'prompt'; NotificationPermission uses 'default' — normalise.
    const normalise = (s: PermissionState): NotificationPermission =>
      s === 'prompt' ? 'default' : (s as NotificationPermission)
    navigator.permissions.query({ name: 'notifications' as PermissionName }).then((ps) => {
      setPermission(normalise(ps.state))
      ps.onchange = () => setPermission(normalise(ps.state))
    })
  }, [supported])

  const status: NotificationStatus = !supported
    ? 'unsupported'
    : permission === 'denied'
    ? 'blocked'
    : permission === 'default'
    ? 'unasked'
    : appEnabled
    ? 'on'
    : 'disabled'

  const toggle = useCallback(async () => {
    if (!supported) return
    if (permission === 'default') {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result === 'granted') {
        setAppEnabled(true)
        writeAppEnabled(true)
      }
    } else if (permission === 'granted') {
      const next = !appEnabled
      setAppEnabled(next)
      writeAppEnabled(next)
    }
  }, [supported, permission, appEnabled])

  const notify = useCallback((title: string, body: string) => {
    if (status !== 'on') return
    new Notification(title, { body, icon: '/dfs-dashboard/favicon.ico' })
  }, [status])

  return { status, toggle, notify }
}
