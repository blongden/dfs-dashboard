import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchCurrent } from '../api/utilisation'
import { fetchCurrentRequirements } from '../api/requirements'
import { fetchSettlementSummary } from '../api/settlement'
import { normaliseCurrent } from '../utils/normalise'
import { deriveEvents, buildCurrentReqLookup, applySettlement, mergeAnnouncedEvents } from '../utils/joinEvents'
import type { NormalisedBid, DfsEvent } from '../types/dfs'

export function useEvents(): {
  events: DfsEvent[]
  bids: NormalisedBid[]
  isLoading: boolean
  error: Error | null
} {
  const current = useQuery({ queryKey: ['current'], queryFn: fetchCurrent })
  const reqs = useQuery({ queryKey: ['currentReqs'], queryFn: fetchCurrentRequirements })
  const settlement = useQuery({ queryKey: ['settlement'], queryFn: fetchSettlementSummary, staleTime: 10 * 60 * 1000 })

  const bids = useMemo(
    () => (current.data ?? []).map(normaliseCurrent),
    [current.data]
  )

  const reqLookup = useMemo(
    () => (reqs.data ? buildCurrentReqLookup(reqs.data) : undefined),
    [reqs.data]
  )

  const events = useMemo(() => {
    const derived = deriveEvents(bids, reqLookup)
    const withSettlement = settlement.data ? applySettlement(derived, settlement.data) : derived
    return reqs.data ? mergeAnnouncedEvents(withSettlement, reqs.data) : withSettlement
  }, [bids, reqLookup, settlement.data, reqs.data])

  return {
    events,
    bids,
    isLoading: current.isLoading || reqs.isLoading,
    error: (current.error ?? reqs.error) as Error | null,
  }
}
