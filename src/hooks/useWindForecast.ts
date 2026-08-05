import { useQuery } from '@tanstack/react-query'
import { fetchWindForecast } from '../api/windForecast'

export function useWindForecast(date: string | null) {
  return useQuery({
    queryKey: ['windForecast', date],
    queryFn: () => fetchWindForecast(date!),
    enabled: date !== null,
    staleTime: 30 * 60 * 1000,
  })
}
