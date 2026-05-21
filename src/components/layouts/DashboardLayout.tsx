// import { useNavigate } from '@tanstack/react-router'
// import { useEffect, useState } from 'react'

// import { useAuthStore } from '@/features/auth/store'

// import { DashboardHeader } from './DashboardHeader'
// import { DashboardSidebar } from './DashboardSidebar'

// interface DashboardLayoutProps {
//   children: React.ReactNode
// }

// export function DashboardLayout({ children }: DashboardLayoutProps) {
//   const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
//     if (typeof window === 'undefined') return true
//     const stored = window.localStorage.getItem('dashboard_sidebar_open')
//     if (stored === null) return true
//     return stored === 'true'
//   })
//   const navigate = useNavigate()
//   const accessToken = useAuthStore((state) => state.accessToken)

//   // Redirect to login if access token is missing (reactive auth guard)
//   useEffect(() => {
//     if (!accessToken) {
//       navigate({ to: '/login' })
//     }
//   }, [accessToken, navigate])

//   useEffect(() => {
//     if (typeof window === 'undefined') return
//     window.localStorage.setItem('dashboard_sidebar_open', String(sidebarOpen))
//   }, [sidebarOpen])

//   const toggleSidebar = () => {
//     setSidebarOpen((prev) => !prev)
//   }

//   return (
//     <div className="flex h-screen overflow-hidden bg-background">
//       {/* Sidebar */}
//       <aside
//         className={`
//           fixed left-0 top-0 z-40 h-screen w-56 bg-card text-sidebar-foreground border-r border-sidebar-border
//           transform transition-transform duration-300 ease-in-out
//           ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
//         `}
//       >
//         <DashboardSidebar />
//       </aside>

//       {/* Main Content Area */}
//       <div
//         className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out"
//         style={{ marginLeft: sidebarOpen ? '14rem' : '0' }}
//       >
//         {/* Header */}
//         <DashboardHeader
//           sidebarOpen={sidebarOpen}
//           onMenuClick={toggleSidebar}
//         />

//         {/* Scrollable Main Content */}
//         <main className="flex-1 overflow-hidden pt-12">
//           <div className="h-full w-full flex flex-col ">{children}</div>
//         </main>
//       </div>
//     </div>
//   )
// }
