import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import zhTranslation from './locales/zh.json'
import enTranslation from './locales/en.json'

export type Language = 'zh' | 'en'

export const resources = {
  zh: {
    translation: zhTranslation,
  },
  en: {
    translation: enTranslation,
  },
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh', // 默认语言
    fallbackLng: 'zh', // 回退语言
    interpolation: {
      escapeValue: false, // 不需要转义 HTML
    },
  })

export const getCurrentLanguage = (): Language => {
  return (i18n.language as Language) || 'zh'
}

export default i18n
