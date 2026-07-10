import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

interface ListPageSearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}

export function ListPageSearchInput({
  value,
  onChange,
  onSearch,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: ListPageSearchInputProps) {
  const { t } = useTranslation('common')

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSearch()
    }
  }

  return (
    <div className={cn('relative w-full max-w-md', className)}>
      <Input
        className="border-input bg-background pr-9"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel ?? placeholder}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
        onClick={onSearch}
        aria-label={t('search.submit')}
      >
        <Search className="size-4" />
      </Button>
    </div>
  )
}
