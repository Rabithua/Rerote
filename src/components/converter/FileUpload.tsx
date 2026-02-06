import { useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  acceptedFormats?: string
}

export function FileUpload({
  onFileSelect,
  acceptedFormats = '.db,.sqlite,.sqlite3',
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      onFileSelect(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="p-6 bg-foreground/5">
      <div className="space-y-4">
        {!selectedFile ? (
          <div
            className="cursor-pointer flex items-center gap-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-8" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                点击选择文件或拖拽文件到此处
              </div>
              <div className="text-xs text-gray-500 mt-1">
                支持 {acceptedFormats} 格式
              </div>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={acceptedFormats}
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="flex gap-2 p-4 bg-muted rounded-lg">
            <FileText className="h-6 w-6 text-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {selectedFile.name}
              </div>
              <div className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemoveFile}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
