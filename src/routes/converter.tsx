import { createFileRoute } from '@tanstack/react-router'
import { ConverterPage } from '@/components/converter/ConverterPage'

export const Route = createFileRoute('/converter')({
  component: ConverterPage,
})
