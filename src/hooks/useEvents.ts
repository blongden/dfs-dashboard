import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchCurrent } from '../api/utilisation'
import { fetchCurrentRequirements } from '../api/requirements'
import { fetchSettlementSummary } from '../api/settlement'
import { normaliseCurrent } from '../utils/normalise'
import { buildCurrentReqLookup } from '../utils/joinEvents'
import type { NormalisedBid } from '../types/dfs'
import type { RawSettlementRow } from '../api/settlement'
import type { RawCurrentRequirement } from '../api/requirements'
import type { ReqLookup } from '../utils/joinEvents'

export function useEvents(): {
  bids: NormalisedBid[]
  rawReqs: RawCurrentRequirement[]
  reqLookup: ReqLookup | undefined
  settlementRows: RawSettlementRow[]
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

  return {
    bids,
    rawReqs: reqs.data ?? [],
    reqLookup,
    settlementRows: settlement.data ?? [],
    isLoading: current.isLoading || reqs.isLoading,
    error: (current.error ?? reqs.error) as Error | null,
  }
}
