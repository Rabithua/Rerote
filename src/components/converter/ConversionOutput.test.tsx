// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ConversionOutput } from './ConversionOutput'
import { convertDinoxToRote } from '@/lib/converters/dinox-to-rote'
import { downloadJSON } from '@/lib/utils/file'
import i18n from '@/lib/i18n/config'

vi.mock('@/lib/utils/file', () => ({ downloadJSON: vi.fn() }))

const result = convertDinoxToRote([
  { title: 'Example', contentMd: 'A note', createTime: '2024-01-02 03:04:05' },
])

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('conversion output choices', () => {
  it('exports JSON without requiring an instance or OpenKey', async () => {
    await i18n.changeLanguage('en')
    render(
      <ConversionOutput
        result={result}
        busy={false}
        preserveVisibility={false}
        onBusyChange={vi.fn()}
      />,
    )
    expect(screen.queryByLabelText('OpenKey')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Import selected notes directly' }),
    ).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Download JSON file' }))
    expect(downloadJSON).toHaveBeenCalledWith(
      result.data,
      expect.stringMatching(/^rote-export-.*\.json$/),
    )
  })

  it('shows connection and note selection only after opting into direct import', async () => {
    await i18n.changeLanguage('en')
    const { rerender } = render(
      <ConversionOutput
        result={result}
        busy={false}
        preserveVisibility={false}
        onBusyChange={vi.fn()}
      />,
    )
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'Import directly into Rote' }),
      { button: 0, ctrlKey: false },
    )
    expect(screen.getByLabelText('OpenKey')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Import selected notes directly' })
        .hasAttribute('disabled'),
    ).toBe(true)
    rerender(
      <ConversionOutput
        result={result}
        busy={true}
        preserveVisibility={false}
        onBusyChange={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('tab', { name: 'Export JSON' }).hasAttribute('disabled'),
    ).toBe(true)
    rerender(
      <ConversionOutput
        result={result}
        busy={false}
        preserveVisibility={false}
        onBusyChange={vi.fn()}
      />,
    )
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Export JSON' }), {
      button: 0,
      ctrlKey: false,
    })
    expect(screen.queryByLabelText('OpenKey')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Download JSON file' }),
    ).toBeTruthy()
  })
})
