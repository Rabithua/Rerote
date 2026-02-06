export function downloadJSON(data: any, filename: string) {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

export function readJSONFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        resolve(json)
      } catch {
        reject(new Error('无法解析 JSON 文件'))
      }
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

export async function readSQLiteFile(file: File): Promise<any> {
  const { default: initSqlJs } = await import('sql.js')
  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
  })

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer
        const db = new SQL.Database(new Uint8Array(buffer))

        // 读取所有用户
        let users = []
        try {
          const usersResult = db.exec('SELECT * FROM user')
          users = usersResult[0]?.values?.map((row: any[]) => ({
            id: row[0],
            created_ts: row[1],
            updated_ts: row[2],
            row_status: row[3],
            username: row[4],
            role: row[5],
            email: row[6],
            nickname: row[7],
            avatar_url: row[9],
            description: row[10],
          })) || []
        } catch (error) {
          console.warn('读取用户表失败:', error)
          users = []
        }

        // 读取所有 memos
        let memos = []
        try {
          const memosResult = db.exec('SELECT * FROM memo')
          memos = memosResult[0]?.values?.map((row: any[]) => ({
            id: row[0],
            uid: row[1],
            creator_id: row[2],
            created_ts: row[3],
            updated_ts: row[4],
            row_status: row[5],
            content: row[6],
            visibility: row[7],
            pinned: row[8] === 1,
            payload: JSON.parse(row[9] || '{}'),
          })) || []
        } catch (error) {
          console.warn('读取备忘录表失败:', error)
          memos = []
        }

        // 读取所有附件
        let attachments = []
        try {
          const attachmentsResult = db.exec('SELECT * FROM attachment')
          attachments = attachmentsResult[0]?.values?.map((row: any[]) => ({
            id: row[0],
            uid: row[1],
            creator_id: row[2],
            created_ts: row[3],
            updated_ts: row[4],
            filename: row[5],
            blob: row[6],
            type: row[7],
            size: row[8],
            memo_id: row[9],
            storage_type: row[10],
            reference: row[11],
            payload: JSON.parse(row[12] || '{}'),
          })) || []
        } catch (error) {
          console.warn('读取附件表失败:', error)
          attachments = []
        }

        db.close()
        resolve({ users, memos, attachments })
      } catch (error) {
        console.error('解析 SQLite 数据库失败:', error)
        reject(new Error(`无法解析 SQLite 数据库文件: ${(error as Error).message}`))
      }
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}
