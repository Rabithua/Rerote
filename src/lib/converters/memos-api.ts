import type { Memo, MemoSourceData } from './types'

export interface MemosApiConfig {
  baseUrl: string
  token: string
}

export interface FetchProgress {
  current: number
  total: number | null
  message: string
}

/**
 * 从 Memos 实例 API 获取所有 memos 数据
 * @param config API 配置（实例地址和 token）
 * @param onProgress 进度回调
 * @returns MemoSourceData 格式的数据
 */
export async function fetchMemosFromApi(
  config: MemosApiConfig,
  onProgress?: (progress: FetchProgress) => void,
): Promise<MemoSourceData> {
  const { baseUrl, token } = config

  // 规范化 baseUrl，移除末尾斜杠
  const normalizedUrl = baseUrl.replace(/\/+$/, '')

  const allMemos: Array<Memo> = []
  let pageToken = ''
  let pageCount = 0
  const pageSize = 50

  onProgress?.({
    current: 0,
    total: null,
    message: '正在连接 Memos 实例...',
  })

  // 循环获取所有分页数据
  do {
    pageCount++

    const url = new URL(`${normalizedUrl}/api/v1/memos`)
    url.searchParams.set('pageSize', String(pageSize))
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    onProgress?.({
      current: allMemos.length,
      total: null,
      message: `正在获取第 ${pageCount} 页数据...`,
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('认证失败：请检查您的 Token 是否正确')
      }
      if (response.status === 403) {
        throw new Error('权限不足：Token 可能没有足够的权限')
      }
      if (response.status === 404) {
        throw new Error('API 地址无效：请检查实例地址是否正确')
      }
      throw new Error(`请求失败：${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as MemoSourceData

    if (!Array.isArray(data.memos)) {
      throw new Error('API 返回的数据格式无效')
    }

    allMemos.push(...data.memos)
    pageToken = data.nextPageToken || ''

    onProgress?.({
      current: allMemos.length,
      total: null,
      message: `已获取 ${allMemos.length} 条记录...`,
    })
  } while (pageToken)

  onProgress?.({
    current: allMemos.length,
    total: allMemos.length,
    message: `获取完成，共 ${allMemos.length} 条记录`,
  })

  return {
    memos: allMemos,
    nextPageToken: '',
  }
}

/**
 * 验证 Memos API 配置是否有效
 */
export async function validateMemosApiConfig(
  config: MemosApiConfig,
): Promise<boolean> {
  const { baseUrl, token } = config
  const normalizedUrl = baseUrl.replace(/\/+$/, '')

  try {
    const response = await fetch(`${normalizedUrl}/api/v1/memos?pageSize=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    return response.ok
  } catch {
    return false
  }
}
