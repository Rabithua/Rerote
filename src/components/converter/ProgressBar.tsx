interface ProgressBarProps {
  progress: number
  label?: string
  showPercentage?: boolean
}

export function ProgressBar({
  progress,
  label,
  showPercentage = true,
}: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, Math.round(progress)))

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-sm font-medium text-gray-700">{label}</div>
      )}
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-foreground h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showPercentage && (
          <div className="text-sm text-gray-500 w-12 text-right">
            {percentage}%
          </div>
        )}
      </div>
    </div>
  )
}
