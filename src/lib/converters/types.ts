export interface MemoSourceData {
  memos: Array<Memo>
  nextPageToken: string
}

export interface Memo {
  name: string
  state: string
  creator: string
  createTime: string
  updateTime: string
  displayTime: string
  content: string
  visibility: string
  tags: Array<string>
  pinned: boolean
  attachments: Array<any>
  relations: Array<any>
  reactions: Array<any>
  property: {
    hasLink: boolean
    hasTaskList: boolean
    hasCode: boolean
    hasIncompleteTasks: boolean
  }
  snippet: string
}

export interface RoteOutputData {
  notes: Array<RoteNote>
}

export interface RoteNote {
  id: string
  title: string
  type: string
  tags: Array<string>
  content: string
  state: string
  archived: boolean
  authorid: string
  articleId: string | null
  pin: boolean
  editor: string
  createdAt: string
  updatedAt: string
  author: {
    username: string
    nickname: string
    avatar: string | null
  }
  attachments: Array<RoteAttachment>
  reactions: Array<any>
}

export interface RoteAttachment {
  id: string
  url: string
  compressUrl: string
  userid: string
  roteid: string
  storage: string
  details: {
    key: string
    size: number
    mtime: string
    mimetype: string
    compressKey: string
  }
  createdAt: string
  updatedAt: string
  sortIndex: number
}

export interface ConversionResult {
  success: boolean
  data?: RoteOutputData
  errors: Array<string>
  warnings: Array<string>
  stats: {
    total: number
    converted: number
    failed: number
    localAttachmentsSkipped: number
  }
}
