import { useQuery } from '@tanstack/react-query'
import type { DfsEvent } from '../types/dfs'
import { fetchBmuReference, fetchBoalf, aggregateByPeriod } from '../api/balancing'
import type { BalancingPeriod } from '../api/balancing'

function isBst(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00Z')
  const year = d.getUTCFullYear()
  const marchEnd = new Date(Date.UTC(year, 2, 31))
  marchEnd.setUTCDate(31 - marchEnd.getUTCDay())
  const octEnd = new Date(Date.UTC(year, 9, 31))
  octEnd.setUTCDate(31 - octEnd.getUTCDay())
  return d >= marchEnd && d < octEnd
}

function toUtcIso(date: string, time: string, offsetHours: number): string {
  const [h, m] = time.split(':').map(Number)
  const bstOffset = isBst(date) ? 1 : 0
  const dt = new Date(Date.UTC(
    ...date.split('-').map(Number) as [number, number, number],
    h - bstOffset + offsetHours,
    m,
    0,
  ))
  return dt.toISOString().slice(0, 19) + 'Z'
}

export function eventSettlementPeriod(date: string, time: string): number {
  const [h, m] = time.split(':').map(Number)
  const bstOffset = isBst(date) ? 1 : 0
  const utcH = h - bstOffset
  return Math.floor((utcH * 60 + m) / 30) + 1
}

export function useBalancingActions(event: DfsEvent | null): {
  data: BalancingPeriod[]
  eventPeriod: number
  isLoading: boolean
  error: unknown
} {
  const enabled = !!event

  const { data: bmuRef, isLoading: bmuLoading } = useQuery({
    queryKey: ['bmuReference'],
    queryFn: fetchBmuReference,
    staleTime: 24 * 60 * 60 * 1000,
    enabled,
  })

  // ±1 hour around the event — keeps us well within Elexon's window limits
  const from = event ? toUtcIso(event.date, event.from, -1) : ''
  const to   = event ? toUtcIso(event.date, event.to,   +1) : ''

  const { data: boalf, isLoading: boalfLoading, error } = useQuery({
    queryKey: ['boalf', event?.date, event?.from],
    queryFn: () => fetchBoalf(from, to),
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  const data: BalancingPeriod[] =
    bmuRef && boalf ? aggregateByPeriod(boalf, bmuRef) : []

  return {
    data,
    eventPeriod: event ? eventSettlementPeriod(event.date, event.from) : 0,
    isLoading: bmuLoading || boalfLoading,
    error,
  }
}
