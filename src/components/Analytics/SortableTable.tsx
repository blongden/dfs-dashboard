import { useState } from 'react'

export function useSortState<K extends string>(defaultKey: K, defaultAsc = false) {
  const [sortKey, setSortKey] = useState<K>(defaultKey)
  const [asc, setAsc] = useState(defaultAsc)

  function handleSort(col: string) {
    const key = col as K
    if (key === sortKey) setAsc((v) => !v)
    else { setSortKey(key); setAsc(false) }
  }

  return { sortKey, asc, handleSort }
}

interface ThProps {
  label: string
  col: string
  active: boolean
  asc: boolean
  onSort: (col: string) => void
  align?: 'left' | 'right'
  className?: string
}

export function Th({ label, col, active, asc, onSort, align = 'right', className = '' }: ThProps) {
  return (
    <th
      onClick={() => onSort(col)}
      className={`cursor-pointer select-none px-3 py-2 text-xs uppercase tracking-wide text-gray-500 hover:text-gray-800 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      {label}
      {active
        ? <span className="ml-1 text-gray-400">{asc ? '↑' : '↓'}</span>
        : <span className="ml-1 invisible">↓</span>
      }
    </th>
  )
}
