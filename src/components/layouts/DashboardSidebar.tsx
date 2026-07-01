// import { skipToken, useQuery } from '@tanstack/react-query'
// import { Link, useLocation } from '@tanstack/react-router'
// import type { LucideIcon } from 'lucide-react'
// import {
//   Book,
//   BookOpen,
//   Bot,
//   Calendar,
//   ChevronDown,
//   ChevronRight,
//   Command,
//   History,
//   Home,
//   Printer,
//   Scan,
//   School,
//   UserCircle,
//   Users,
// } from 'lucide-react'
// import { useEffect, useState } from 'react'
// import { useTranslation } from 'react-i18next'

// import logoSrc from '@/assets/images/Lg1.png'
// import { useProfile } from '@/features/auth/hooks'
// import {
//   myClassroomsQueryOptions,
//   myCoursesQueryOptions,
// } from '@/features/teacher/queries'
// import { useActiveContext } from '@/lib/hooks/useActiveContext'
// import { isPathActive } from '@/lib/utils/breadcrumb-matcher'
// import { cn } from '@/lib/utils/cn'
// import {
//   getAllowedMenuGroups,
//   getRoleName,
//   MENU_GROUP_TEACHING,
// } from '@/lib/utils/roleMenu'

// // Menu Configuration Types
// interface MenuItem {
//   id: string
//   to: string
//   search?: Record<string, unknown>
//   icon: LucideIcon
//   translationKey: string
//   path: string
// }

// interface MenuGroup {
//   id: string
//   translationKey: string
//   items: Array<MenuItem>
//   // Optional fields to make the group itself a direct link
//   to?: string
//   search?: Record<string, unknown>
//   icon?: LucideIcon
//   path?: string
// }

// // Menu Configuration
// const menuGroups: Array<MenuGroup> = [
//   // TODO: Add question bank group when available
//   // {
//   //   id: 'questionBank',
//   //   translationKey: 'sidebar.groups.questionBank',
//   //   items: [
//   //     {
//   //       id: 'questionBankList',
//   //       to: '/school-management/question-bank',
//   //       search: { page: 1, limit: 20 },
//   //       icon: BookOpen,
//   //       translationKey: 'sidebar.questionBankList',
//   //       path: '/school-management/question-bank',
//   //     },
//   //   ],
//   // },
//   {
//     id: 'tools',
//     translationKey: 'sidebar.groups.tools',
//     items: [
//       {
//         id: 'examGrading',
//         to: '/exam-grading/history',
//         search: { page: 1, limit: 20 },
//         icon: History,
//         translationKey: 'sidebar.examGrading',
//         path: '/exam-grading/history',
//       },
//     ],
//   },
//   {
//     id: 'schoolManagement',
//     translationKey: 'sidebar.groups.schoolManagement',
//     items: [
//       {
//         id: 'academicYears',
//         to: '/school-management/academic-years',
//         search: { page: 1, limit: 20 },
//         icon: Calendar,
//         translationKey: 'sidebar.academicYears',
//         path: '/school-management/academic-years',
//       },
//       {
//         id: 'learningStandards',
//         to: '/school-management/learning-standards',
//         search: { page: 1, limit: 20 },
//         icon: Book,
//         translationKey: 'sidebar.learningStandards',
//         path: '/school-management/learning-standards',
//       },
//       {
//         id: 'teachers',
//         to: '/school-management/teachers',
//         search: { page: 1, limit: 20 },
//         icon: Users,
//         translationKey: 'sidebar.teachers',
//         path: '/school-management/teachers',
//       },
//       {
//         id: 'classes',
//         to: '/school-management/classes',
//         search: { page: 1, limit: 20 },
//         icon: School,
//         translationKey: 'sidebar.classes',
//         path: '/school-management/classes',
//       },
//       {
//         id: 'students',
//         to: '/school-management/students',
//         search: { page: 1, limit: 20 },
//         icon: UserCircle,
//         translationKey: 'sidebar.students',
//         path: '/school-management/students',
//       },
//     ],
//   },
//   // {
//   //   id: 'deviceManagement',
//   //   translationKey: 'sidebar.groups.deviceManagement',
//   //   items: [
//   //     {
//   //       id: 'agentManagement',
//   //       to: '/device-management/agents',
//   //       search: { page: 1, limit: 10 },
//   //       icon: Bot,
//   //       translationKey: 'sidebar.agentManagement',
//   //       path: '/device-management/agents',
//   //     },
//   //     {
//   //       id: 'scanManagement',
//   //       to: '/device-management/scanners',
//   //       search: { page: 1, limit: 10 },
//   //       icon: Scan,
//   //       translationKey: 'sidebar.scanManagement',
//   //       path: '/device-management/scanners',
//   //     },
//   //     {
//   //       id: 'printManagement',
//   //       to: '/device-management/printers',
//   //       search: { page: 1, limit: 10 },
//   //       icon: Printer,
//   //       translationKey: 'sidebar.printManagement',
//   //       path: '/device-management/printers',
//   //     },
//   //     {
//   //       id: 'deviceCommands',
//   //       to: '/device-management/device-commands',
//   //       search: { page: 1, limit: 10 },
//   //       icon: Command,
//   //       translationKey: 'sidebar.deviceCommands',
//   //       path: '/device-management/device-commands',
//   //     },
//   //   ],
//   // },
// ]

// // Reusable Components
// interface MenuItemLinkProps {
//   item: MenuItem
//   isActive: boolean
//   t: (key: string) => string
// }

// function MenuItemLink({ item, isActive, t }: MenuItemLinkProps) {
//   const Icon = item.icon
//   return (
//     <Link
//       to={item.to}
//       search={item.search}
//       className={cn(
//         'group relative flex mb-1 w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm font-semibold transition-all duration-200',
//         isActive
//           ? 'border-l-[3px] border-sidebar-ring bg-accent text-sidebar-primary'
//           : 'text-sidebar-foreground hover:bg-sidebar-accent',
//       )}
//     >
//       <Icon className="h-4 w-4 shrink-0" />
//       <span className="ml-3">{t(item.translationKey as any)}</span>
//     </Link>
//   )
// }

// interface MenuGroupComponentProps {
//   group: MenuGroup
//   isOpen: boolean
//   onToggle: () => void
//   isActive: (path: string) => boolean
//   t: (key: string) => string
//   children?: React.ReactNode
// }

// function MenuGroupComponent({
//   group,
//   isOpen,
//   onToggle,
//   isActive,
//   t,
//   children,
// }: MenuGroupComponentProps) {
//   // Mode 1: Direct Link Mode - if group has `to`, render as a direct link
//   if (group.to && group.icon && group.path) {
//     const Icon = group.icon
//     return (
//       <Link
//         to={group.to}
//         search={group.search}
//         className={cn(
//           'group relative flex mb-1 w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm font-semibold transition-all duration-200',
//           isActive(group.path)
//             ? 'border-l-[3px] border-sidebar-ring bg-accent text-sidebar-primary'
//             : 'text-sidebar-foreground hover:bg-sidebar-accent',
//         )}
//       >
//         <Icon className="h-4 w-4 shrink-0" />
//         <span className="ml-3">{t(group.translationKey as any)}</span>
//       </Link>
//     )
//   }

//   // Mode 2: Collapsible Mode - traditional group with items
//   return (
//     <div className="mb-3">
//       <button
//         onClick={onToggle}
//         className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-sidebar-foreground transition-colors"
//       >
//         <span>{t(group.translationKey as any)}</span>
//         {isOpen ? (
//           <ChevronDown className="h-4 w-4" />
//         ) : (
//           <ChevronRight className="h-4 w-4" />
//         )}
//       </button>
//       {isOpen && (
//         <div className="mt-2 space-y-2 pl-2 border-sidebar-border">
//           {children ||
//             (group.items.length > 0
//               ? group.items.map((item) => (
//                   <MenuItemLink
//                     key={item.id}
//                     item={item}
//                     isActive={isActive(item.path)}
//                     t={t}
//                   />
//                 ))
//               : null)}
//         </div>
//       )}
//     </div>
//   )
// }

// export function DashboardSidebar() {
//   const { t } = useTranslation('home')
//   const location = useLocation()
//   const { user, currentSchoolId, currentUserRole } = useProfile()
//   const { activeCourseId, activeClassId } = useActiveContext()

//   // Get role-based menu filtering
//   const roleName = getRoleName(currentUserRole)
//   const allowedMenuGroups = getAllowedMenuGroups(roleName)
//   const showTeachingGroup = allowedMenuGroups.includes(MENU_GROUP_TEACHING)
//   const filteredMenuGroups = menuGroups.filter((group) =>
//     allowedMenuGroups.includes(group.id),
//   )

//   const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
//     mySubjects: true,
//     homeroomClasses: true,
//     tools: true,
//     // TODO: Add question bank group when available
//     // questionBank: true,
//     schoolManagement: true,
//     deviceManagement: true,
//   })

//   const { data: coursesData } = useQuery(
//     currentSchoolId
//       ? myCoursesQueryOptions(currentSchoolId, { limit: 10 })
//       : {
//           queryKey: ['teacher', 'courses', 'my', 'disabled'],
//           queryFn: skipToken,
//         },
//   )

//   const { data: classroomsData } = useQuery(
//     currentSchoolId
//       ? myClassroomsQueryOptions(currentSchoolId, { limit: 10 })
//       : {
//           queryKey: ['teacher', 'classrooms', 'my', 'disabled'],
//           queryFn: skipToken,
//         },
//   )

//   const courses = coursesData?.items ?? []
//   const classrooms = classroomsData?.items ?? []

//   // Auto-expand groups when their children are active
//   useEffect(() => {
//     setOpenGroups((prev) => {
//       const updates: Record<string, boolean> = {}

//       // Auto-expand mySubjects if a course is active
//       if (activeCourseId && !prev.mySubjects) {
//         updates.mySubjects = true
//       }

//       // Auto-expand homeroomClasses if a class is active
//       if (activeClassId && !prev.homeroomClasses) {
//         updates.homeroomClasses = true
//       }

//       // Auto-expand schoolManagement if we're in a school-management route
//       if (
//         location.pathname.startsWith('/school-management') &&
//         !prev.schoolManagement
//       ) {
//         updates.schoolManagement = true
//       }

//       if (location.pathname.startsWith('/exam-grading') && !prev.tools) {
//         updates.tools = true
//       }

//       if (Object.keys(updates).length > 0) {
//         return { ...prev, ...updates }
//       }

//       return prev
//     })
//   }, [activeCourseId, activeClassId, location.pathname])

//   const toggleGroup = (group: string) => {
//     setOpenGroups((prev) => ({
//       ...prev,
//       [group]: !prev[group],
//     }))
//   }

//   // Breadcrumb-aware active state detection
//   const isActive = (path: string, exact: boolean = false) => {
//     return isPathActive(path, location.pathname, exact)
//   }

//   return (
//     <aside className="h-full w-56 border-r border-sidebar-border bg-card text-sidebar-foreground">
//       <div className="flex h-full flex-col">
//         {/* Logo */}
//         <div className="flex h-12 items-center border-b border-sidebar-border bg-card px-4">
//           <div className="flex items-center gap-2">
//             <img
//               src={logoSrc}
//               alt="Nextedu.ai"
//               className="h-3 w-auto"
//               style={{ height: '32px' }}
//             />
//           </div>
//         </div>

//         {/* Navigation */}
//         <nav className="flex-1 overflow-y-auto px-3 py-4">
//           <div className="space-y-3">
//             {/* Trang chủ */}
//             <Link
//               to="/"
//               className={cn(
//                 'group relative flex w-full cursor-pointer items-center rounded-md px-2 py-2 text-sm font-semibold transition-all duration-200',
//                 isActive('/', true)
//                   ? 'border-l-[3px] border-sidebar-ring bg-accent text-sidebar-foreground'
//                   : 'text-sidebar-foreground/80 hover:bg-sidebar-accent',
//               )}
//             >
//               <Home className="h-5 w-5 shrink-0" />
//               <span className="ml-3">{t('sidebar.home')}</span>
//             </Link>

//             {/* Thời khóa biểu */}
//             {/* TODO: Add timetable route when available */}

//             {/* Thư viện giảng dạy */}
//             {/* TODO: Add teaching library route when available */}

//             {/* MÔN HỌC CỦA TÔI Group (My Subjects) - Only for teachers */}
//             {showTeachingGroup && (
//               <MenuGroupComponent
//                 group={{
//                   id: 'mySubjects',
//                   translationKey: 'sidebar.groups.mySubjects',
//                   items: [],
//                 }}
//                 isOpen={openGroups.mySubjects}
//                 onToggle={() => toggleGroup('mySubjects')}
//                 isActive={isActive}
//                 t={t as (key: string) => string}
//               >
//                 {courses.length > 0 ? (
//                   courses.map((course) => {
//                     const isCourseActive = activeCourseId === course.id
//                     return (
//                       <Link
//                         key={course.id}
//                         to="/course/$courseId"
//                         params={{ courseId: course.id }}
//                         className={cn(
//                           'group relative flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-sm font-semibold transition-all duration-200',
//                           isCourseActive
//                             ? 'border-l-[3px] border-sidebar-ring bg-accent text-sidebar-foreground'
//                             : 'text-sidebar-foreground/80 hover:bg-sidebar-accent',
//                         )}
//                       >
//                         <Book className="h-4 w-4 shrink-0" />
//                         <span className="ml-3 truncate">
//                           {course.name}
//                           {course.classroom?.name
//                             ? ` - ${course.classroom.name}`
//                             : ''}
//                         </span>
//                       </Link>
//                     )
//                   })
//                 ) : (
//                   <div className="px-3 py-2 text-sm text-muted-foreground">
//                     {t('sidebar.noCourses')}
//                   </div>
//                 )}
//               </MenuGroupComponent>
//             )}

//             {/* LỚP CHỦ NHIỆM Group (Homeroom Classes) - Only for teachers, only show if classrooms exist */}
//             {showTeachingGroup && classrooms.length > 0 && (
//               <MenuGroupComponent
//                 group={{
//                   id: 'homeroomClasses',
//                   translationKey: 'sidebar.groups.homeroomClasses',
//                   items: [],
//                 }}
//                 isOpen={openGroups.homeroomClasses}
//                 onToggle={() => toggleGroup('homeroomClasses')}
//                 isActive={isActive}
//                 t={t as (key: string) => string}
//               >
//                 {classrooms.map((classroom) => {
//                   const isClassActive = activeClassId === classroom.id
//                   return (
//                     <Link
//                       key={classroom.id}
//                       to="/school-management/classes/$classId"
//                       params={{ classId: classroom.id }}
//                       className={cn(
//                         'group relative flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-sm font-semibold transition-all duration-200',
//                         isClassActive
//                           ? 'border-l-[3px] border-sidebar-ring bg-accent text-sidebar-foreground'
//                           : 'text-sidebar-foreground/80 hover:bg-sidebar-accent',
//                       )}
//                     >
//                       <School className="h-4 w-4 shrink-0" />
//                       <span className="ml-3 truncate">{classroom.name}</span>
//                     </Link>
//                   )
//                 })}
//               </MenuGroupComponent>
//             )}

//             {/* Configurable Menu Groups */}
//             {filteredMenuGroups.map((group) => (
//               <MenuGroupComponent
//                 key={group.id}
//                 group={group}
//                 isOpen={openGroups[group.id] ?? false}
//                 onToggle={() => toggleGroup(group.id)}
//                 isActive={isActive}
//                 t={t as (key: string) => string}
//               />
//             ))}
//           </div>
//         </nav>

//         {/* Footer */}
//         <div className="border-t border-sidebar-border h-14 flex items-center justify-center">
//           <div className="text-xs text-muted-foreground">
//             {(currentUserRole || user?.school) && (
//               <p className="text-xs leading-tight font-medium truncate">
//                 {currentUserRole && <span>{currentUserRole.role.name}</span>}
//                 {currentUserRole && user?.school && <span> • </span>}
//                 {user?.school && <span>{user.school.name}</span>}
//               </p>
//             )}
//           </div>
//         </div>
//       </div>
//     </aside>
//   )
// }
