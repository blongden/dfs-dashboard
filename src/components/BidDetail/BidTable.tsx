import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { SortingState } from '@tanstack/react-table'
import { useState } from 'react'
import type { NormalisedBid } from '../../types/dfs'
import { StatusBadge } from '../ui/StatusBadge'

const col = createColumnHelper<NormalisedBid>()

const columns = [
  col.accessor('provider', { header: 'Provider' }),
  col.accessor('unit', { header: 'Unit' }),
  col.accessor('volumeMW', {
    header: 'MW',
    cell: (i) => <span className="font-semibold">{i.getValue().toFixed(1)}</span>,
    meta: { align: 'right' },
  }),
  col.accessor('pricePerMWh', {
    header: '£/MWh',
    cell: (i) => `£${i.getValue().toLocaleString()}`,
    meta: { align: 'right' },
  }),
  col.accessor('status', {
    header: 'Status',
    cell: (i) => <StatusBadge status={i.getValue()} />,
  }),
]

interface Props {
  bids: NormalisedBid[]
}

export function BidTable({ bids }: Props) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'status', desc: false },
    { id: 'pricePerMWh', desc: true },
  ])

  const table = useReactTable({
    data: bids,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className={`cursor-pointer select-none px-3 py-2 text-left hover:text-gray-800 ${
                    (h.column.columnDef.meta as { align?: string } | undefined)?.align === 'right'
                      ? 'text-right'
                      : ''
                  }`}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b last:border-0 hover:bg-gray-50 ${
                row.original.status === 'Rejected' ? 'opacity-50' : ''
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={`px-3 py-2 ${
                    (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right'
                      ? 'text-right'
                      : ''
                  }`}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
