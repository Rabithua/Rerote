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
  usageInstructions?: {
    steps: Array<string>
    dataSourceOptions?: Array<{
      mode: DataSourceMode
      description: string
    }>
  }
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
    usageInstructions: {
      steps: [
        '选择您要转换的笔记平台（目前支持 Memos）',
        '选择数据的来源方式',
        '点击开始转换按钮，等待处理完成',
        '下载转换后的 Rote 格式数据文件',
        '在 Rote 应用中导入该文件即可',
      ],
      dataSourceOptions: [
        {
          mode: 'api',
          description: '直接连接您的 Memos 实例获取数据（推荐）',
        },
        {
          mode: 'file',
          description: '上传 Memos SQLite 数据库文件（.db, .sqlite, .sqlite3）',
        },
      ],
    },
  },
]

export function getConverter(platform: Platform): Converter | undefined {
  return converters.find((c) => c.platform === (platform as string))
}
