import { v4 as uuidv4 } from 'uuid'
import type { ConversionResult, Memo, MemoSourceData, RoteNote } from './types'

export function convertMemosToRote(data: MemoSourceData): ConversionResult {
  const errors: Array<string> = []
  const warnings: Array<string> = []
  const notes: Array<RoteNote> = []
  let localAttachmentsSkipped = 0

  if (!Array.isArray(data.memos)) {
    return {
      success: false,
      errors: ['无效的数据格式：缺少 memos 数组'],
      warnings: [],
      stats: {
        total: 0,
        converted: 0,
        failed: 1,
        localAttachmentsSkipped: 0,
      },
    }
  }

  data.memos.forEach((memo, index) => {
    try {
      const { note, skippedLocalAttachments } = convertSingleMemo(memo)
      notes.push(note)
      localAttachmentsSkipped += skippedLocalAttachments
    } catch (error) {
      errors.push(`Memo ${index + 1} 转换失败: ${(error as Error).message}`)
    }
  })

  if (localAttachmentsSkipped > 0) {
    warnings.push(
      `检测到 ${localAttachmentsSkipped} 个本地存储的附件已被跳过，因为 Rote 不支持本地存储。请将附件上传到云存储后重新导出。`,
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
  // 过滤掉本地存储的附件
  const localAttachments = attachments.filter(isLocalStorageAttachment)
  const remoteAttachments = attachments.filter(
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
