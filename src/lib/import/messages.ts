import type { TFunction } from 'i18next'

export function importErrorText(code: string, t: TFunction): string {
  if (code.startsWith('openkey_permission_required:'))
    return t('direct.errors.permission', { permission: code.split(':')[1] })
  const key = `direct.errors.${code}`
  const message = t(key)
  return message === key
    ? t('direct.errors.operation_failed', { code })
    : message
}
