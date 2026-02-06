import { CheckCircle, FileText } from 'lucide-react'
import type { Platform } from '@/lib/converters'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ConverterCardProps {
  platform: Platform
  name: string
  description: string
  onSelect: (platform: Platform) => void
  isSelected: boolean
}

export function ConverterCard({
  platform,
  name,
  description,
  onSelect,
  isSelected,
}: ConverterCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-md border-2 ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-transparent'
      }`}
      onClick={() => onSelect(platform)}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <div className="font-semibold">{name}</div>
          {isSelected && <CheckCircle className="h-5 w-5" />}
        </div>
        <CardDescription className="font-light">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-600">
          支持上传 {name} 数据文件并转换为 Rote 格式
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={(e) => {
            e.stopPropagation()
            onSelect(platform)
          }}
        >
          选择 {name}
        </Button>
      </CardFooter>
    </Card>
  )
}
