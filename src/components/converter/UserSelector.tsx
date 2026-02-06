import { Check, User } from 'lucide-react'
import type { User as UserType } from '@/lib/converters/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'

interface UserSelectorProps {
  users: Array<UserType>
  selectedUserId: number | null
  onUserSelect: (userId: number) => void
  onConfirm: () => void
}

export function UserSelector({
  users,
  selectedUserId,
  onUserSelect,
  onConfirm,
}: UserSelectorProps) {
  const { t } = useTranslation()

  return (
    <Card className="p-6 bg-foreground/5">
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('userSelector.selectUser')}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('userSelector.selectUserDescription')}
          </p>
        </div>

        <RadioGroup
          value={selectedUserId?.toString() || ''}
          onValueChange={(value) => onUserSelect(Number(value))}
          className="space-y-3"
        >
          {users.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                selectedUserId === user.id
                  ? 'border-gray-500 bg-gray-500/10'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <RadioGroupItem
                value={user.id.toString()}
                id={`user-${user.id}`}
              />
              <Label
                htmlFor={`user-${user.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-gray-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {user.username}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.nickname || t('userSelector.noNickname')}
                    </div>
                  </div>
                </div>
              </Label>
              {selectedUserId === user.id && (
                <Check className="h-5 w-5 text-gray-500" />
              )}
            </div>
          ))}
        </RadioGroup>

        <Button
          onClick={onConfirm}
          disabled={selectedUserId === null}
          className="w-full"
        >
          {t('userSelector.confirmSelection')}
        </Button>
      </div>
    </Card>
  )
}
