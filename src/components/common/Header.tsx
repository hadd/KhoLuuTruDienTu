// import { Link } from '@tanstack/react-router'
// import { useTranslation } from 'react-i18next'

// import { Button } from '@/components/ui/button'
// import { cn } from '@/lib/utils/cn'

// const ARCHITECTURE_GUIDE_URL =
//   'https://tanstack.com/router/latest/docs/framework/react/overview'

// const navItems = [
//   {
//     to: '/',
//     translationKey: 'navigation.home',
//   },
//   {
//     to: '/mcp',
//     translationKey: 'navigation.mcp',
//   },
// ]

// export default function Header() {
//   const { t } = useTranslation()

//   return (
//     <header className="border-b border-border/60 bg-background/80 backdrop-blur">
//       <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
//         <Link to="/" className="flex flex-col">
//           <span className="text-base font-semibold tracking-tight">
//             {t('appName')}
//           </span>
//           <span className="text-xs text-muted-foreground">{t('tagline')}</span>
//         </Link>
//         <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
//           {navItems.map((item) => (
//             <Link
//               key={item.translationKey}
//               to={item.to}
//               className={({ isActive }) =>
//                 cn(
//                   'transition-colors hover:text-primary',
//                   isActive ? 'text-primary' : 'text-muted-foreground',
//                 )
//               }
//             >
//               {t(item.translationKey)}
//             </Link>
//           ))}
//         </nav>
//         <div className="hidden items-center gap-2 md:flex">
//           <Button variant="ghost" asChild>
//             <a href={ARCHITECTURE_GUIDE_URL} target="_blank" rel="noreferrer">
//               {t('cta.secondary')}
//             </a>
//           </Button>
//           <Button asChild>
//             <Link to="/mcp">{t('cta.primary')}</Link>
//           </Button>
//         </div>
//         <div className="flex items-center gap-3 md:hidden">
//           <Link to="/mcp" className="text-sm font-medium text-primary">
//             {t('cta.primary')}
//           </Link>
//         </div>
//       </div>
//     </header>
//   )
// }
