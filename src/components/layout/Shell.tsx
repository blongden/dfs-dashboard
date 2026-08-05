interface Props {
  sidebar: React.ReactNode
  detail: React.ReactNode
  header: React.ReactNode
}

export function Shell({ sidebar, detail, header }: Props) {
  return (
    <div className="flex h-screen flex-col bg-white text-gray-900">
      <header className="flex items-center justify-between border-b px-4 py-3 shadow-sm">
        {header}
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 flex-shrink-0 border-r overflow-hidden flex flex-col">
          {sidebar}
        </aside>
        <main className="flex-1 overflow-hidden">
          {detail}
        </main>
      </div>
    </div>
  )
}
