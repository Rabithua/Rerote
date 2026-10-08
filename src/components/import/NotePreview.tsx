import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RoteNote } from '@/lib/converters/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface NotePreviewProps {
  notes: Array<RoteNote>
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onSelectAll: (all: boolean) => void
  disabled: boolean
}
const PAGE_SIZE = 25

export function NotePreview({
  notes,
  selectedIds,
  onToggle,
  onSelectAll,
  disabled,
}: NotePreviewProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(event.target.value)
      setPage(0)
    },
    [],
  )
  const filtered = notes.filter((note) =>
    `${note.title} ${note.content} ${note.tags.join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="text-sm">
          {t('direct.selected', {
            count: selectedIds.size,
            total: notes.length,
          })}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectAll(true)}
          disabled={disabled}
        >
          {t('direct.selectAll')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSelectAll(false)}
          disabled={disabled}
        >
          {t('direct.selectNone')}
        </Button>
      </div>
      <Input
        type="search"
        value={search}
        onChange={handleSearch}
        placeholder={t('direct.search')}
        aria-label={t('direct.search')}
      />
      {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((note) => (
        <div key={note.id} className="flex gap-3 py-2">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-gray-500"
            id={`note-${note.id}`}
            checked={selectedIds.has(note.id)}
            onChange={() => onToggle(note.id)}
            disabled={disabled}
          />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <label
              htmlFor={`note-${note.id}`}
              className="text-sm font-medium break-words"
            >
              {note.title ||
                note.content.slice(0, 100) ||
                t('direct.imageOnly')}
            </label>
            <div className="text-xs text-muted-foreground">
              {new Date(note.createdAt).toLocaleString()} ·{' '}
              {t('direct.attachments', { count: note.attachments.length })}{' '}
              {note.tags.map((tag) => `#${tag}`).join(' ')}
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                {t('direct.previewContent')}
              </summary>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm py-2">
                {note.content}
              </pre>
              {note.attachments.map((attachment, index) => (
                <div
                  key={attachment.id}
                  className="text-xs text-muted-foreground break-all"
                >
                  {index + 1}.{' '}
                  {attachment.details.mimetype || t('direct.image')} ·{' '}
                  {attachment.url}
                </div>
              ))}
            </details>
          </div>
        </div>
      ))}
      <div className="flex gap-3 items-center">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 0}
          onClick={() => setPage((value) => value - 1)}
        >
          {t('direct.previous')}
        </Button>
        <div className="text-xs text-muted-foreground">
          {page + 1} / {pages}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= pages}
          onClick={() => setPage((value) => value + 1)}
        >
          {t('direct.next')}
        </Button>
      </div>
    </div>
  )
}
