import { v4 as uuidv4 } from 'uuid'
import type {
  ConversionResult,
  Memo,
  MemoSourceData,
  RoteNote,
  SQLiteSourceData,
} from './types'

import { getCurrentLanguage } from '@/lib/i18n/config'

export function convertMemosToRote(
  data: MemoSourceData | SQLiteSourceData,
  selectedUserId?: number,
): ConversionResult {
  // 检查数据类型，区分是 JSON 还是 SQLite 格式
  // SQLite 格式有 users 属性，JSON 格式没有
  if ('users' in data && 'memos' in data) {
    // SQLite 格式
    return convertFromSQLite(data, selectedUserId)
  } else if ('memos' in data && Array.isArray(data.memos)) {
    // JSON 格式（保持原样）
    return convertFromJSON(data)
  } else {
    const lang = getCurrentLanguage()
    return {
      success: false,
      errors: [lang === 'zh' ? '无效的数据格式' : 'Invalid data format'],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 1,
        localAttachmentsSkipped: 0,
      },
    }
  }
}

function convertFromJSON(data: MemoSourceData): ConversionResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []
  const notes: Array<RoteNote> = []
  let localAttachmentsSkipped = 0
  let emptyContentWithoutAttachmentsCount = 0

  data.memos.forEach((memo, index) => {
    try {
      const { note, skippedLocalAttachments } = convertSingleMemo(memo)

      // 检查是否没有附件且内容为空
      if (note.attachments.length === 0 && !note.content.trim()) {
        note.content = ''
        emptyContentWithoutAttachmentsCount++
      }

      notes.push(note)
      localAttachmentsSkipped += skippedLocalAttachments
    } catch (error) {
      errors.push(`Memo ${index + 1} 转换失败: ${(error as Error).message}`)
    }
  })

  const lang = getCurrentLanguage()
  if (localAttachmentsSkipped > 0) {
    warnings.push(
      lang === 'zh'
        ? `检测到 ${localAttachmentsSkipped} 个本地存储的附件已被跳过，因为 Rote 不支持本地存储。请将附件上传到云存储后重新导出。`
        : `Detected ${localAttachmentsSkipped} locally stored attachments skipped because Rote does not support local storage. Please upload attachments to cloud storage and re-export.`,
    )
  }

  if (emptyContentWithoutAttachmentsCount > 0) {
    warnings.push(
      lang === 'zh'
        ? `检测到 ${emptyContentWithoutAttachmentsCount} 条没有附件且内容为空的记录，已舍弃其内容。`
        : `Detected ${emptyContentWithoutAttachmentsCount} records with no attachments and empty content, their content has been discarded.`,
    )
  }

  return {
    success: errors.length === 0,
    data: { notes },
    errors,
    warnings,
    stats: {
      total: data.memos.length,
      converted: notes.length,
      failed: errors.length,
      localAttachmentsSkipped,
    },
  }
}

function convertFromSQLite(
  data: SQLiteSourceData,
  selectedUserId?: number,
): ConversionResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []
  const notes: Array<RoteNote> = []
  let localAttachmentsSkipped = 0

  // 确保必要的数据字段存在
  const lang = getCurrentLanguage()
  if (!data.memos || !Array.isArray(data.memos)) {
    return {
      success: false,
      errors: [lang === 'zh' ? '数据库中没有找到备忘录数据' : 'No memo data found in database'],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 0,
        localAttachmentsSkipped: 0,
      },
    }
  }

  if (!data.users || !Array.isArray(data.users)) {
    return {
      success: false,
      errors: [lang === 'zh' ? '数据库中没有找到用户数据' : 'No user data found in database'],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 0,
        localAttachmentsSkipped: 0,
      },
    }
  }

  if (!data.attachments || !Array.isArray(data.attachments)) {
    data.attachments = []
  }

  // 根据选择的用户筛选 memos
  let filteredMemos = data.memos
  if (selectedUserId !== undefined) {
    filteredMemos = data.memos.filter(
      (memo) => memo.creator_id === selectedUserId,
    )
  }

  if (filteredMemos.length === 0) {
    return {
      success: false,
      errors: [lang === 'zh' ? '未找到要转换的备忘录数据' : 'No memo data to convert found'],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 0,
        localAttachmentsSkipped: 0,
      },
    }
  }

  // 获取用户信息（用于作者信息）
  const getUserInfo = (userId: number) => {
    const user = data.users.find((u) => u.id === userId)
    return {
      username: user?.username || `user_${userId}`,
      nickname: user?.nickname || `User ${userId}`,
      avatar: user?.avatar_url || null,
    }
  }

  let emptyContentWithoutAttachmentsCount = 0

  filteredMemos.forEach((memo, index) => {
    try {
      // 验证备忘录的基本字段
      if (!memo.content || !memo.visibility) {
        errors.push(`Memo ${index + 1} 缺少必要字段: 内容或可见性`)
        return
      }

      // 转换 SQLite Memo 格式到 RoteNote 格式
      const state = convertVisibility(memo.visibility)
      const userInfo = getUserInfo(memo.creator_id)

      // 获取 memo 相关的附件
      const memoAttachments = data.attachments.filter(
        (att) => att.memo_id === memo.id,
      )
      const { attachments, skippedCount } =
        convertSQLiteAttachments(memoAttachments)
      localAttachmentsSkipped += skippedCount

      const note: RoteNote = {
        id: uuidv4(),
        title: '',
        type: 'Rote',
        tags: memo.payload?.tags || [],
        content: memo.content,
        state,
        archived: memo.row_status !== 'NORMAL',
        authorid: memo.creator_id.toString(),
        articleId: null,
        pin: memo.pinned,
        editor: 'normal',
        createdAt: new Date(memo.created_ts * 1000).toISOString(),
        updatedAt: new Date(memo.updated_ts * 1000).toISOString(),
        author: userInfo,
        attachments,
        reactions: [],
      }

      // 检查是否没有附件且内容为空
      if (note.attachments.length === 0 && !note.content.trim()) {
        note.content = ''
        emptyContentWithoutAttachmentsCount++
      }

      notes.push(note)
    } catch (error) {
      errors.push(`Memo ${index + 1} 转换失败: ${(error as Error).message}`)
    }
  })

  if (localAttachmentsSkipped > 0) {
    warnings.push(
      lang === 'zh'
        ? `检测到 ${localAttachmentsSkipped} 个本地存储的附件已被跳过，因为 Rote 不支持本地存储。`
        : `Detected ${localAttachmentsSkipped} locally stored attachments skipped because Rote does not support local storage.`,
    )
  }

  if (emptyContentWithoutAttachmentsCount > 0) {
    warnings.push(
      lang === 'zh'
        ? `检测到 ${emptyContentWithoutAttachmentsCount} 条没有附件且内容为空的记录，已舍弃其内容。`
        : `Detected ${emptyContentWithoutAttachmentsCount} records with no attachments and empty content, their content has been discarded.`,
    )
  }

  return {
    success: errors.length === 0,
    data: { notes },
    errors,
    warnings,
    stats: {
      total: filteredMemos.length,
      converted: notes.length,
      failed: errors.length,
      localAttachmentsSkipped,
    },
  }
}

function convertSQLiteAttachments(attachments: Array<any>): {
  attachments: Array<any>
  skippedCount: number
} {
  // SQLite 附件转换逻辑
  const localAttachments = attachments.filter(
    (att) => att.storage_type === 'LOCAL' || !att.reference,
  )
  const remoteAttachments = attachments.filter(
    (att) => att.storage_type !== 'LOCAL' && att.reference,
  )

  const converted = remoteAttachments.map((att) => {
    return {
      id: uuidv4(),
      url: att.reference,
      compressUrl: att.reference,
      userid: '',
      roteid: '',
      storage: 'REMOTE',
      details: {
        key: att.filename,
        size: att.size,
        mtime: new Date(att.created_ts * 1000).toISOString(),
        mimetype: att.type || 'application/octet-stream',
        compressKey: '',
      },
      createdAt: new Date(att.created_ts * 1000).toISOString(),
      updatedAt: new Date(att.updated_ts * 1000).toISOString(),
      sortIndex: 0,
    }
  })

  return {
    attachments: converted,
    skippedCount: localAttachments.length,
  }
}

interface ConvertMemoResult {
  note: RoteNote
  skippedLocalAttachments: number
}

function convertSingleMemo(memo: Memo): ConvertMemoResult {
  // 转换可见性
  const state = convertVisibility(memo.visibility)
  const { attachments, skippedCount } = convertAttachments(memo.attachments)

  const note: RoteNote = {
    id: uuidv4(),
    title: '',
    type: 'Rote',
    tags: memo.tags,
    content: memo.content,
    state,
    archived: memo.state !== 'NORMAL',
    authorid: extractUserId(memo.creator),
    articleId: null,
    pin: memo.pinned,
    editor: 'normal',
    createdAt: memo.createTime,
    updatedAt: memo.updateTime,
    author: {
      username: `user_${extractUserId(memo.creator)}`,
      nickname: `User ${extractUserId(memo.creator)}`,
      avatar: null,
    },
    attachments,
    reactions: [],
  }

  return { note, skippedLocalAttachments: skippedCount }
}

function convertVisibility(visibility: string): string {
  switch (visibility.toUpperCase()) {
    case 'PUBLIC':
      return 'public'
    case 'PRIVATE':
      return 'private'
    case 'PROTECTED':
      return 'protected'
    default:
      return 'private'
  }
}

function extractUserId(creator: string): string {
  // 从格式 "users/{id}" 中提取用户 ID
  const match = creator.match(/users\/(\d+)/)
  return match ? match[1] : uuidv4()
}

interface ConvertAttachmentsResult {
  attachments: Array<any>
  skippedCount: number
}

function isLocalStorageAttachment(att: any): boolean {
  // 本地存储的附件通常是以 / 开头的相对路径，或者没有 http/https 协议
  const url = att.externalLink || att.url || ''
  if (!url) return true
  return !url.startsWith('http://') && !url.startsWith('https://')
}

function convertAttachments(attachments: Array<any>): ConvertAttachmentsResult {
  // 确保 attachments 是数组
  const safeAttachments = Array.isArray(attachments) ? attachments : []

  // 过滤掉本地存储的附件
  const localAttachments = safeAttachments.filter(isLocalStorageAttachment)
  const remoteAttachments = safeAttachments.filter(
    (att) => !isLocalStorageAttachment(att),
  )

  const converted = remoteAttachments.map((att) => {
    const url = att.externalLink || att.url || ''
    return {
      id: uuidv4(),
      url,
      compressUrl: url,
      userid: '',
      roteid: '',
      storage: 'REMOTE',
      details: {
        key: att.filename || att.name || '',
        size: att.size || 0,
        mtime: new Date().toISOString(),
        mimetype: att.type || att.mimetype || 'application/octet-stream',
        compressKey: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortIndex: 0,
    }
  })

  return {
    attachments: converted,
    skippedCount: localAttachments.length,
  }
}
