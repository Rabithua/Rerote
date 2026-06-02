import { convertMemosToRote } from './memos-to-rote'
import { convertFlomoToRote, isFlomoSourceData } from './flomo-to-rote'
import { fetchMemosFromApi, validateMemosApiConfig } from './memos-api'
import type {
  ConversionOptions,
  ConversionResult,
  FlomoSourceData,
  MemoSourceData,
  SQLiteSourceData,
} from './types'
import type { FetchProgress, MemosApiConfig } from './memos-api'

export { fetchMemosFromApi, validateMemosApiConfig }
export type { MemosApiConfig, FetchProgress }

export enum Platform {
  MEMOS = 'memos',
  FLOMO = 'flomo',
}

export type DataSourceMode = 'file' | 'api'

export interface Converter {
  platform: Platform
  name: string
  description: string | { zh: string; en: string }
  convert: (
    data: any,
    selectedUserId?: number,
    options?: ConversionOptions,
  ) => ConversionResult
  validate: (data: any) => boolean
  supportedModes: Array<DataSourceMode>
  apiDescription?: string | { zh: string; en: string }
  usageInstructions?: {
    steps: Array<string> | { zh: Array<string>; en: Array<string> }
    dataSourceOptions?: Array<{
      mode: DataSourceMode
      description: string | { zh: string; en: string }
    }>
  }
  acceptedFormats?: string
}

export const converters: Array<Converter> = [
  {
    platform: Platform.MEMOS,
    name: 'Memos',
    description: {
      zh: '转换 Memos 数据到 Rote 格式',
      en: 'Convert Memos data to Rote format',
    },
    convert: convertMemosToRote,
    validate: (data: any): data is MemoSourceData | SQLiteSourceData => {
      // 验证 JSON 格式
      if (data && 'memos' in data && Array.isArray(data.memos)) {
        return true
      }
      // 验证 SQLite 格式
      if (
        data &&
        'users' in data &&
        Array.isArray(data.users) &&
        'memos' in data &&
        Array.isArray(data.memos)
      ) {
        return true
      }
      return false
    },
    supportedModes: ['api', 'file'],
    apiDescription: {
      zh: '通过 Memos API 获取数据，需要提供实例地址和 Access Token',
      en: 'Fetch data through Memos API, requires instance address and Access Token',
    },
    usageInstructions: {
      steps: {
        zh: [
          '选择您要转换的笔记平台',
          '选择数据的来源方式',
          '点击开始转换按钮，等待处理完成',
          '下载转换后的 Rote 格式数据文件',
          '在 Rote 应用中导入该文件即可',
        ],
        en: [
          'Select the note platform you want to convert',
          'Select the data source method',
          'Click the start conversion button and wait for processing to complete',
          'Download the converted Rote format data file',
          'Import the file in the Rote app',
        ],
      },
      dataSourceOptions: [
        {
          mode: 'api',
          description: {
            zh: '直接连接您的 Memos 实例获取数据（推荐）',
            en: 'Connect directly to your Memos instance to fetch data (recommended)',
          },
        },
        {
          mode: 'file',
          description: {
            zh: '上传 Memos SQLite 数据库文件（.db, .sqlite, .sqlite3）',
            en: 'Upload Memos SQLite database file (.db, .sqlite, .sqlite3)',
          },
        },
      ],
    },
  },
  {
    platform: Platform.FLOMO,
    name: 'flomo',
    description: {
      zh: '转换 flomo HTML 导出到 Rote 格式',
      en: 'Convert flomo HTML exports to Rote format',
    },
    convert: convertFlomoToRote,
    validate: (data: any): data is FlomoSourceData => isFlomoSourceData(data),
    supportedModes: ['file'],
    acceptedFormats: '.html,.htm,.zip',
    usageInstructions: {
      steps: {
        zh: [
          '选择 flomo 平台',
          '上传 flomo 导出的 HTML 文件，或包含 HTML 的 zip 压缩包',
          '点击开始转换按钮，等待处理完成',
          '下载转换后的 Rote 格式数据文件',
          '在 Rote 应用中导入该文件即可',
        ],
        en: [
          'Select the flomo platform',
          'Upload the flomo exported HTML file, or a zip archive containing it',
          'Click the start conversion button and wait for processing to complete',
          'Download the converted Rote format data file',
          'Import the file in the Rote app',
        ],
      },
      dataSourceOptions: [
        {
          mode: 'file',
          description: {
            zh: '上传 flomo 导出的 HTML 文件或 zip 压缩包',
            en: 'Upload a flomo exported HTML file or zip archive',
          },
        },
      ],
    },
  },
]

export function getConverter(platform: Platform): Converter | undefined {
  return converters.find((c) => c.platform === (platform as string))
}
