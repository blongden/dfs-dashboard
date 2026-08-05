import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo, useEffect } from 'react'
import { fetchLegacyPage, ARCHIVE_2526_ID, SEASON_2324_ID, SEASON_2223_ID } from '../api/utilisation'
import { fetchLegacyRequirements } from '../api/requirements'
import { normaliseLegacy } from '../utils/normalise'
import { buildLegacyReqLookup } from '../utils/joinEvents'
import type { NormalisedBid } from '../types/dfs'
import type { ReqLookup } from '../utils/joinEvents'

type ArchiveTier = 'archive2526' | 'season2324' | 'season2223'

const TIER_RESOURCE: Record<ArchiveTier, string> = {
  archive2526: ARCHIVE_2526_ID,
  season2324: SEASON_2324_ID,
  season2223: SEASON_2223_ID,
}

const TIER_SOURCE: Record<ArchiveTier, NormalisedBid['source']> = {
  archive2526: 'archive',
  season2324: 'season2324',
  season2223: 'season2223',
}

export function useArchiveTier(tier: ArchiveTier, enabled: boolean) {
  const resourceId = TIER_RESOURCE[tier]
  const source = TIER_SOURCE[tier]

  const query = useInfiniteQuery({
    queryKey: ['archive', tier],
    queryFn: ({ pageParam = 0 }) => fetchLegacyPage(resourceId, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.length * 1000
      return fetched < lastPage.total ? fetched : undefined
    },
    enabled,
  })

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage()
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage])

  const reqs = useQuery({
    queryKey: ['archiveReqs', tier],
    queryFn: () => fetchLegacyRequirements(tier),
    enabled,
  })

  const reqLookup: ReqLookup | undefined = useMemo(
    () => (reqs.data ? buildLegacyReqLookup(reqs.data) : undefined),
    [reqs.data]
  )

  const bids = useMemo(
    () =>
      (query.data?.pages.flatMap((p) => p.records) ?? []).map((r) =>
        normaliseLegacy(r, source)
      ),
    [query.data, source]
  )

  return {
    bids,
    reqLookup,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error as Error | null,
  }
}
