import { useQuery } from '@tanstack/react-query'
import { fetchInterconnectorFlows } from '../api/interconnectors'
import { toUtcIso } from './useBalancingActions'
import type { DfsEvent } from '../types/dfs'

export function useInterconnectors(event: DfsEvent | null) {
  return useQuery({
    queryKey: ['interconnectors', event?.date, event?.from, event?.to],
    queryFn: () =>
      fetchInterconnectorFlows(toUtcIso(event!.date, event!.from), toUtcIso(event!.date, event!.to)),
    enabled: event !== null,
    staleTime: 10 * 60 * 1000,
  })
}
