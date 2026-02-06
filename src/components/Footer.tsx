import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Github } from 'lucide-react'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="">
      <div className="flex items-center justify-between gap-4 mx-2">
        <div className="text-sm font-light">
          {t('common.appName')} © {new Date().getFullYear()}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <a
              href="https://github.com/Rabithua/Rerote"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </footer>
  )
}
