import { useQuery } from '@tanstack/react-query'
import { fetchConstraintFlows } from '../api/constraints'
import type { DfsEvent } from '../types/dfs'

export function useConstraints(event: DfsEvent | null) {
  return useQuery({
    queryKey: ['constraints', event?.date, event?.from, event?.to],
    queryFn: () => fetchConstraintFlows(event!.date, event!.from, event!.to),
    enabled: event !== null,
    staleTime: 10 * 60 * 1000,
  })
}
