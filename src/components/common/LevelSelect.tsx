// import { useTranslation } from 'react-i18next'

// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select'
// import type { LevelKey } from '@/lib/constants/categories'
// import { getLevelLabel, LEVEL_KEYS } from '@/lib/constants/categories'
// import { cn } from '@/lib/utils/cn'

// interface LevelSelectProps {
//   value?: LevelKey | null
//   onValueChange?: (value: LevelKey | null) => void
//   placeholder?: string
//   disabled?: boolean
//   className?: string
//   allowClear?: boolean
// }

// export function LevelSelect({
//   value,
//   onValueChange,
//   placeholder,
//   disabled = false,
//   className,
//   allowClear = false,
// }: LevelSelectProps) {
//   const { i18n } = useTranslation()
//   const lang = i18n.language === 'en' ? 'en' : 'vi'

//   const handleValueChange = (newValue: string) => {
//     if (newValue === '__clear__') {
//       onValueChange?.(null)
//       return
//     }
//     if (newValue === '' || newValue === value) {
//       onValueChange?.(null)
//       return
//     }
//     onValueChange?.(newValue as LevelKey)
//   }

//   return (
//     <Select
//       value={value ?? ''}
//       onValueChange={handleValueChange}
//       disabled={disabled}
//     >
//       <SelectTrigger className={cn('w-full', className)}>
//         <SelectValue
//           placeholder={
//             placeholder ?? (lang === 'vi' ? 'Chọn mức độ' : 'Select level')
//           }
//         />
//       </SelectTrigger>
//       <SelectContent>
//         {allowClear && (
//           <SelectItem value="__clear__">
//             <span className="text-muted-foreground">
//               {lang === 'vi' ? 'Không chọn' : 'No selection'}
//             </span>
//           </SelectItem>
//         )}
//         {LEVEL_KEYS.map((key) => (
//           <SelectItem key={key} value={key}>
//             {getLevelLabel(key, lang)}
//           </SelectItem>
//         ))}
//       </SelectContent>
//     </Select>
//   )
// }
