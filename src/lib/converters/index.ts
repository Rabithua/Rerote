import { convertMemosToRote } from './memos-to-rote'
import { fetchMemosFromApi, validateMemosApiConfig } from './memos-api'
import type { ConversionResult, MemoSourceData, SQLiteSourceData } from './types'
import type { FetchProgress, MemosApiConfig } from './memos-api'

export { fetchMemosFromApi, validateMemosApiConfig }
export type { MemosApiConfig, FetchProgress }

export enum Platform {
  MEMOS = 'memos',
  // 未来可以添加其他平台
}

export type DataSourceMode = 'file' | 'api'

export interface Converter {
  platform: Platform
  name: string
  description: string
  convert: (data: any, selectedUserId?: number) => ConversionResult
  validate: (data: any) => boolean
  supportedModes: Array<DataSourceMode>
  apiDescription?: string
}

export const converters: Array<Converter> = [
  {
    platform: Platform.MEMOS,
    name: 'Memos',
    description: '转换 Memos 数据到 Rote 格式',
    convert: convertMemosToRote,
    validate: (data: any): data is MemoSourceData | SQLiteSourceData => {
      // 验证 JSON 格式
      if (data && 'memos' in data && Array.isArray(data.memos)) {
        return true
      }
      // 验证 SQLite 格式
      if (data && 'users' in data && Array.isArray(data.users) && 'memos' in data && Array.isArray(data.memos)) {
        return true
      }
      return false
    },
    supportedModes: ['api', 'file'],
    apiDescription: '通过 Memos API 获取数据，需要提供实例地址和 Access Token',
  },
]

export function getConverter(platform: Platform): Converter | undefined {
  return converters.find((c) => c.platform === (platform as string))
}
