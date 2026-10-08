import { convertDinoxToRote, isDinoxSourceData } from './dinox-to-rote'
import { convertMemosToRote } from './memos-to-rote'
import { convertFlomoToRote, isFlomoSourceData } from './flomo-to-rote'
import { fetchMemosFromApi, validateMemosApiConfig } from './memos-api'
import { convertWereadToRote, isWereadSourceData } from './weread-to-rote'
import { fetchWereadFromApi } from './weread-api'
import type {
  ConversionOptions,
  ConversionResult,
  FlomoSourceData,
  MemoSourceData,
  SQLiteSourceData,
  WereadSourceData,
  WereadTextSourceData,
} from './types'
import type { FetchProgress, MemosApiConfig } from './memos-api'

export { fetchMemosFromApi, fetchWereadFromApi, validateMemosApiConfig }
export type { MemosApiConfig, FetchProgress }

export enum Platform {
  DINOX = 'dinox',
  MEMOS = 'memos',
  FLOMO = 'flomo',
  WEREAD = 'weread',
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
    platform: Platform.DINOX,
    name: 'Dinox',
    description: {
      zh: '导入 Dinox JSON 笔记和远程图片',
      en: 'Import Dinox JSON notes and remote images',
    },
    convert: convertDinoxToRote,
    validate: isDinoxSourceData,
    supportedModes: ['file'],
    acceptedFormats: '.json',
    usageInstructions: {
      steps: {
        zh: [
          '连接 Rote 实例并检查权限',
          '上传 Dinox JSON 导出文件',
          '预览并勾选笔记',
          '直接导入，查看结果；可下载 JSON 备份',
        ],
        en: [
          'Connect your Rote instance and check permissions',
          'Upload a Dinox JSON export',
          'Preview and select notes',
          'Import directly, review results; optionally download a JSON backup',
        ],
      },
    },
  },
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
          '准备要转换的 Memos 数据',
          '选择数据的来源方式',
          '点击开始转换按钮，等待处理完成',
          '预览并勾选要导入的笔记',
          '直接导入并查看结果，可选下载 JSON 备份',
        ],
        en: [
          'Prepare the Memos data you want to convert',
          'Select the data source method',
          'Click the start conversion button and wait for processing to complete',
          'Preview and select the notes to import',
          'Import directly and review results; optionally download a JSON backup',
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
      zh: '转换 flomo HTML 导出到 Rote 格式。注意：flomo 官方导出文件不携带附件，因此无法迁移附件。',
      en: 'Convert flomo HTML exports to Rote format. Note: flomo export files do not include attachments, so attachments cannot be migrated.',
    },
    convert: convertFlomoToRote,
    validate: (data: any): data is FlomoSourceData => isFlomoSourceData(data),
    supportedModes: ['file'],
    acceptedFormats: '.html,.htm,.zip',
    usageInstructions: {
      steps: {
        zh: [
          '从 flomo 网页版导出数据',
          '上传 flomo 导出的 HTML 文件，或包含 HTML 的 zip 压缩包。flomo 官方导出文件不携带附件，因此无法迁移附件',
          '点击开始转换按钮，等待处理完成',
          '预览并勾选要导入的笔记',
          '直接导入并查看结果，可选下载 JSON 备份',
        ],
        en: [
          'Export data from flomo Web',
          'Upload the flomo exported HTML file, or a zip archive containing it. flomo export files do not include attachments, so attachments cannot be migrated',
          'Click the start conversion button and wait for processing to complete',
          'Preview and select the notes to import',
          'Import directly and review results; optionally download a JSON backup',
        ],
      },
      dataSourceOptions: [
        {
          mode: 'file',
          description: {
            zh: '上传 flomo 导出的 HTML 文件或 zip 压缩包（不包含附件）',
            en: 'Upload a flomo exported HTML file or zip archive (attachments are not included)',
          },
        },
      ],
    },
  },
  {
    platform: Platform.WEREAD,
    name: '微信读书',
    description: {
      zh: '将微信读书的划线和想法转换为 Rote 笔记',
      en: 'Convert WeRead highlights and reviews to Rote notes',
    },
    convert: convertWereadToRote,
    validate: (data: any): data is WereadSourceData | WereadTextSourceData =>
      isWereadSourceData(data),
    supportedModes: ['api', 'file'],
    apiDescription: {
      zh: '使用微信读书官方 Skill API Key 一键获取全部划线和想法，数据直接从微信读书读取。',
      en: 'Use the official WeRead Skill API Key to fetch all highlights and reviews directly from WeRead.',
    },
    acceptedFormats: '.json,.txt',
    usageInstructions: {
      steps: {
        zh: [
          '在微信读书 Skill 页面登录并获取 API Key',
          '推荐使用 API Key 一键获取；也可上传 JSON/TXT 离线备份',
          '点击开始转换按钮，等待处理完成',
          '预览并勾选要导入的笔记',
          '直接导入并查看结果，可选下载 JSON 备份',
        ],
        en: [
          'Sign in on the WeRead Skill page and obtain an API Key',
          'Use the API Key for one-click fetching, or upload a JSON/TXT offline backup',
          'Click the start conversion button and wait for processing to complete',
          'Preview and select the notes to import',
          'Import directly and review results; optionally download a JSON backup',
        ],
      },
      dataSourceOptions: [
        {
          mode: 'api',
          description: {
            zh: '通过微信读书官方 Skill API 获取全部笔记（推荐）',
            en: 'Fetch all notes through the official WeRead Skill API (recommended)',
          },
        },
        {
          mode: 'file',
          description: {
            zh: '上传微信读书笔记 JSON 或 TXT 文件',
            en: 'Upload a WeRead notes JSON or TXT file',
          },
        },
      ],
    },
  },
]

export function getConverter(platform: Platform): Converter | undefined {
  return converters.find((c) => c.platform === (platform as string))
}
