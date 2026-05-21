// import { skipToken } from '@tanstack/react-query'
// import * as React from 'react'
// import { useTranslation } from 'react-i18next'

// import { useCurrentSchool } from '@/features/auth/hooks'
// import { publishedLearningStandardsQueryOptions } from '@/features/learning-standards/queries'
// import { studentsQueryOptions } from '@/features/students/queries'
// import { teachersQueryOptions } from '@/features/teachers/queries'
// import type { LearningStandardT, StudentT, TeacherT } from '@/types/common'

// import { SearchInput } from './SearchInput'
// import { SearchSelect } from './SearchSelect'
// import { SearchSelectMulti } from './SearchSelectMulti'

// /**
//  * Factory helper to create a TeacherSearchSelect component
//  *
//  * @example
//  * // ✅ Correct - Use factory helper
//  * const TeacherSelect = createTeacherSearchSelect()
//  * <TeacherSelect value={value} onChange={setValue} />
//  */
// export function createTeacherSearchSelect() {
//   return function TeacherSearchSelect({
//     value,
//     onChange,
//     disabled = false,
//     className,
//     excludeIds = [],
//   }: {
//     value?: string | null
//     onChange?: (value: string | null) => void
//     disabled?: boolean
//     className?: string
//     excludeIds?: Array<string>
//   }) {
//     const { t } = useTranslation('school')
//     const schoolId = useCurrentSchool()

//     return (
//       <SearchSelect<TeacherT>
//         value={value}
//         onChange={onChange}
//         queryOptions={(search) =>
//           schoolId
//             ? teachersQueryOptions(schoolId, {
//                 search,
//                 page: 1,
//                 limit: 50,
//               })
//             : {
//                 queryKey: ['school-management', 'teachers', 'disabled'],
//                 queryFn: skipToken,
//               }
//         }
//         getOptionValue={(teacher) => teacher.id}
//         getOptionLabel={(teacher) =>
//           teacher.employeeCode
//             ? `${teacher.name} • ${teacher.employeeCode}`
//             : teacher.name
//         }
//         placeholder={t('courses.teachers.searchPlaceholder', {
//           defaultValue: 'Chọn giáo viên',
//         })}
//         searchPlaceholder={t('courses.teachers.searchInput', {
//           defaultValue: 'Tìm kiếm giáo viên...',
//         })}
//         emptyMessage={t('courses.teachers.emptySearch', {
//           defaultValue: 'Không tìm thấy giáo viên phù hợp',
//         })}
//         disabled={disabled || !schoolId}
//         className={className}
//         excludeIds={excludeIds}
//         namespace="school"
//       />
//     )
//   }
// }

// /**
//  * Factory helper to create a LearningStandardSearchSelect component
//  *
//  * @example
//  * // ✅ Correct - Use factory helper
//  * const LearningStandardSelect = createLearningStandardSearchSelect()
//  * <LearningStandardSelect value={value} onChange={setValue} />
//  */
// export function createLearningStandardSearchSelect() {
//   return function LearningStandardSearchSelect({
//     value,
//     onChange,
//     disabled = false,
//     className,
//   }: {
//     value?: string | null
//     onChange?: (value: string | null) => void
//     disabled?: boolean
//     className?: string
//   }) {
//     const { t } = useTranslation('school')
//     const schoolId = useCurrentSchool()

//     return (
//       <SearchSelect<LearningStandardT>
//         value={value}
//         onChange={onChange}
//         queryOptions={(search) =>
//           schoolId
//             ? publishedLearningStandardsQueryOptions(schoolId, {
//                 search,
//                 page: 1,
//                 limit: 50,
//                 paging: false,
//               })
//             : {
//                 queryKey: [
//                   'school-management',
//                   'learning-standards',
//                   'disabled',
//                 ],
//                 queryFn: skipToken,
//               }
//         }
//         getOptionValue={(standard) => standard.id}
//         getOptionLabel={(standard) =>
//           standard.code ? `${standard.code} • ${standard.name}` : standard.name
//         }
//         placeholder={t('classes.subjects.form.learningStandard.placeholder', {
//           defaultValue: 'Chọn chuẩn đầu ra',
//         })}
//         searchPlaceholder={t(
//           'classes.subjects.form.learningStandard.searchPlaceholder',
//           {
//             defaultValue: 'Tìm kiếm chuẩn đầu ra...',
//           },
//         )}
//         emptyMessage={t('classes.subjects.form.learningStandard.empty', {
//           defaultValue: 'Không tìm thấy chuẩn đầu ra phù hợp',
//         })}
//         disabled={disabled || !schoolId}
//         className={className}
//         namespace="school"
//       />
//     )
//   }
// }

// /**
//  * Factory helper to create a StudentSearchSelect component (single select)
//  *
//  * @example
//  * // ✅ Correct - Use factory helper
//  * const StudentSelect = createStudentSearchSelect()
//  * <StudentSelect value={value} onChange={setValue} />
//  */
// export function createStudentSearchSelect() {
//   return function StudentSearchSelect({
//     value,
//     onChange,
//     disabled = false,
//     className,
//     excludeIds = [],
//     schoolId: providedSchoolId,
//   }: {
//     value?: string | null
//     onChange?: (value: string | null) => void
//     disabled?: boolean
//     className?: string
//     excludeIds?: Array<string>
//     schoolId?: string
//   }) {
//     const { t } = useTranslation('school')
//     const currentSchoolId = useCurrentSchool()
//     const schoolId = providedSchoolId || currentSchoolId

//     return (
//       <SearchSelect<StudentT>
//         value={value}
//         onChange={onChange}
//         queryOptions={(search) =>
//           schoolId
//             ? studentsQueryOptions(schoolId, {
//                 search,
//                 page: 1,
//                 limit: 50,
//               })
//             : {
//                 queryKey: ['school-management', 'students', 'disabled'],
//                 queryFn: skipToken,
//               }
//         }
//         getOptionValue={(student) => student.userId}
//         getOptionLabel={(student) =>
//           student.user?.fullName ||
//           student.fullName ||
//           student.user?.email ||
//           ''
//         }
//         placeholder={t('classes.students.importDialog.selectTab.placeholder', {
//           defaultValue: 'Chọn học sinh',
//         })}
//         searchPlaceholder={t(
//           'classes.students.importDialog.selectTab.placeholder',
//           {
//             defaultValue: 'Tìm kiếm học sinh...',
//           },
//         )}
//         emptyMessage={t('classes.students.importDialog.selectTab.noResults', {
//           defaultValue: 'Không tìm thấy học sinh phù hợp',
//         })}
//         disabled={disabled || !schoolId}
//         className={className}
//         excludeIds={excludeIds}
//         namespace="school"
//       />
//     )
//   }
// }

// /**
//  * Factory helper to create a StudentMultiSelect component
//  *
//  * @example
//  * // ✅ Correct - Use factory helper
//  * const StudentMultiSelect = createStudentMultiSelect()
//  * <StudentMultiSelect value={value} onValueChange={setValue} />
//  */
// export function createStudentMultiSelect() {
//   return function StudentMultiSelect({
//     value = [],
//     onValueChange,
//     disabled = false,
//     className,
//     excludeIds = [],
//     schoolId: providedSchoolId,
//   }: {
//     value?: Array<string>
//     onValueChange?: (value: Array<string>) => void
//     disabled?: boolean
//     className?: string
//     excludeIds?: Array<string>
//     schoolId?: string
//   }) {
//     const { t } = useTranslation('school')
//     const currentSchoolId = useCurrentSchool()
//     const schoolId = providedSchoolId || currentSchoolId

//     return (
//       <SearchSelectMulti<StudentT>
//         value={value}
//         onValueChange={onValueChange}
//         queryOptions={(search) =>
//           schoolId
//             ? studentsQueryOptions(schoolId, {
//                 search,
//                 page: 1,
//                 limit: 50,
//               })
//             : {
//                 queryKey: ['school-management', 'students', 'disabled'],
//                 queryFn: skipToken,
//               }
//         }
//         getOptionValue={(student) => student.userId}
//         getOptionLabel={(student) =>
//           student.user?.fullName ||
//           student.fullName ||
//           student.user?.email ||
//           ''
//         }
//         getOptionDisplay={(student) => (
//           <div className="flex flex-col min-w-0">
//             <span className="truncate text-sm">
//               {student.user?.fullName ||
//                 student.fullName ||
//                 student.user?.email}
//             </span>
//             {student.studentCode &&
//               student.user?.fullName &&
//               student.studentCode !==
//                 (student.user?.fullName || student.fullName) && (
//                 <span className="truncate text-xs text-muted-foreground">
//                   {student.studentCode}
//                 </span>
//               )}
//           </div>
//         )}
//         placeholder={t('classes.students.importDialog.selectTab.placeholder', {
//           defaultValue: 'Chọn học sinh',
//         })}
//         searchPlaceholder={t(
//           'classes.students.importDialog.selectTab.placeholder',
//           {
//             defaultValue: 'Tìm kiếm học sinh...',
//           },
//         )}
//         emptyMessage={t('classes.students.importDialog.selectTab.noResults', {
//           defaultValue: 'Không tìm thấy học sinh phù hợp',
//         })}
//         disabled={disabled || !schoolId}
//         className={className}
//         excludeIds={excludeIds}
//         namespace="school"
//       />
//     )
//   }
// }

// /**
//  * Generic factory helper to create a SearchInput component with i18n support
//  *
//  * @param placeholderKey - Translation key for placeholder
//  * @param placeholderDefault - Default placeholder text if translation key not found
//  * @param namespace - i18n namespace (default: 'school')
//  * @returns A SearchInput component with configured placeholder
//  *
//  * @example
//  * // ✅ Correct - Use generic factory helper
//  * const StudentStatisticsSearchInput = createSearchInput(
//  *   'courses.detail.competencyAssessment.search.placeholder',
//  *   'Tìm kiếm học sinh...',
//  *   'school'
//  * )
//  * <StudentStatisticsSearchInput
//  *   value={searchValue}
//  *   onChange={setSearchValue}
//  *   onDebouncedChange={(value) => {
//  *     // Handle debounced search
//  *   }}
//  * />
//  */
// export function createSearchInput(
//   placeholderKey: string,
//   placeholderDefault: string,
//   namespace:
//     | 'school'
//     | 'common'
//     | 'auth'
//     | 'home'
//     | 'question-studio'
//     | 'question-bank'
//     | 'courses'
//     | 'assignments' = 'school',
// ) {
//   return function SearchInputComponent({
//     value,
//     onChange,
//     onDebouncedChange,
//     className,
//     disabled = false,
//   }: {
//     value: string
//     onChange: (value: string) => void
//     onDebouncedChange?: (value: string) => void
//     className?: string
//     disabled?: boolean
//   }) {
//     const { t } = useTranslation(namespace)

//     return (
//       <SearchInput
//         value={value}
//         onChange={onChange}
//         onDebouncedChange={onDebouncedChange}
//         placeholder={t(placeholderKey as any, {
//           defaultValue: placeholderDefault,
//         })}
//         className={className}
//         disabled={disabled}
//       />
//     )
//   }
// }
