import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

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
  .use(LanguageDetector)
  .init({
    resources,
    lng: 'en', // 默认语言改为英文
    fallbackLng: 'en', // 回退语言改为英文
    interpolation: {
      escapeValue: false, // 不需要转义 HTML
    },
    detection: {
      order: ['navigator', 'localStorage', 'cookie'], // 检测顺序：浏览器语言 → localStorage → cookie
      caches: ['localStorage', 'cookie'], // 缓存语言选择
    },
  })

export const getCurrentLanguage = (): Language => {
  return (i18n.language as Language) || 'en'
}

export default i18n
