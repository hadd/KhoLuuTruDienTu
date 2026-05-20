import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, LogOut, Menu, Settings, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AppBreadcrumb } from '@/components/common/AppBreadcrumb'
import { BackgroundJobsMenu } from '@/components/common/BackgroundJobsMenu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProfile } from '@/features/auth/hooks'
import { authStore } from '@/features/auth/store'

interface DashboardHeaderProps {
  sidebarOpen: boolean
  onMenuClick: () => void
}

export function DashboardHeader({
  sidebarOpen,
  onMenuClick,
}: DashboardHeaderProps) {
  const { t, i18n } = useTranslation('home')
  const { user } = useProfile()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLang = window.localStorage.getItem('app_language')
    if (storedLang && storedLang !== i18n.language) {
      i18n.changeLanguage(storedLang)
    }
  }, [i18n])

  const handleChangeLanguage = (lng: 'vi' | 'en') => {
    if (lng === i18n.language) return
    i18n.changeLanguage(lng)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('app_language', lng)
    }
  }

  const handleProfileClick = () => {
    setDropdownOpen(false)
    navigate({ to: '/profile' })
  }

  const handleLogout = () => {
    // Cancel all in-flight queries to prevent stale data from being set
    queryClient.cancelQueries()
    // Clear all query cache to ensure no stale data remains
    queryClient.clear()
    // Clear auth state (tokens and user data)
    authStore.reset()
    // Navigate to login page immediately (router will handle redirect)
    navigate({ to: '/login' })
  }

  const userInitial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : 'G'

  return (
    <header
      className="fixed top-0 right-0 z-30 h-12 border-b border-border bg-card text-foreground transition-all duration-300 ease-in-out"
      style={{
        left: sidebarOpen ? '14rem' : '0',
        width: sidebarOpen ? 'calc(100% - 14rem)' : '100%',
      }}
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Sidebar toggle and Breadcrumb */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>

          <AppBreadcrumb />
        </div>

        {/* Right: Background tasks, language switcher, user */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <BackgroundJobsMenu />
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hidden sm:flex items-center gap-2  bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted">
                <span className="flex items-center gap-1 bg-background px-2 py-0.5 text-xs font-medium">
                  <span>{i18n.language === 'vi' ? '🇻🇳' : '🇺🇸'}</span>
                  <span className="uppercase">
                    {i18n.language === 'vi' ? 'VI' : 'EN'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {t('header.language')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleChangeLanguage('vi')}>
                <span className="mr-2">🇻🇳</span>
                <span className="text-sm">{t('header.language_vi')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChangeLanguage('en')}>
                <span className="mr-2">🇺🇸</span>
                <span className="text-sm">{t('header.language_en')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Dropdown */}
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 hover:bg-muted">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                    {user?.fullName ||
                      user?.email ||
                      'giaovien.toan@nextedu.ai'}
                  </span>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded- bg-primary text-sm font-semibold text-primary-foreground">
                  {userInitial}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {t('header.dropdown.accountInfo')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfileClick}>
                <User className="mr-2 h-4 w-4" />
                {t('header.dropdown.profile')}
              </DropdownMenuItem>
              {/* <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                {t('header.dropdown.settings')}
              </DropdownMenuItem> */}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-500 focus:text-red-500"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('header.dropdown.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
