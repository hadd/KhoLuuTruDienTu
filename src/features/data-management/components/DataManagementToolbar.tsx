import logoSrc from '@/assets/images/Lg1.png'

export function DataManagementToolbar() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center">
        <img
          src={logoSrc}
          alt="Logo"
          className="h-4 w-auto"
        />
      </div>
    </div>
  )
}
