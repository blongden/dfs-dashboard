export function ErrorBanner({ error }: { error: Error }) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {error.message}
    </div>
  )
}
