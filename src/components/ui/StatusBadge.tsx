interface Props {
  status: 'Accepted' | 'Rejected'
}

export function StatusBadge({ status }: Props) {
  const cls =
    status === 'Accepted'
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}
