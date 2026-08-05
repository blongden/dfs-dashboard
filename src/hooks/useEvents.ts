import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchCurrent } from '../api/utilisation'
import { fetchCurrentRequirements } from '../api/requirements'
import { normaliseCurrent } from '../utils/normalise'
import { deriveEvents, buildCurrentReqLookup } from '../utils/joinEvents'
import type { NormalisedBid, DfsEvent } from '../types/dfs'

export function useEvents(): {
  events: DfsEvent[]
  bids: NormalisedBid[]
  isLoading: boolean
  error: Error | null
} {
  const current = useQuery({ queryKey: ['current'], queryFn: fetchCurrent })
  const reqs = useQuery({ queryKey: ['currentReqs'], queryFn: fetchCurrentRequirements })

  const bids = useMemo(
    () => (current.data ?? []).map(normaliseCurrent),
    [current.data]
  )

  const reqLookup = useMemo(
    () => (reqs.data ? buildCurrentReqLookup(reqs.data) : undefined),
    [reqs.data]
  )

  const events = useMemo(() => deriveEvents(bids, reqLookup), [bids, reqLookup])

  return {
    events,
    bids,
    isLoading: current.isLoading || reqs.isLoading,
    error: (current.error ?? reqs.error) as Error | null,
  }
}
