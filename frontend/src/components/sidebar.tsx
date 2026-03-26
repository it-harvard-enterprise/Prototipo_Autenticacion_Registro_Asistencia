'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  FileSpreadsheet,
  LogOut,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface SidebarProps {
  userEmail?: string
  userName?: string
  onClose?: () => void
}

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: 'Estudiantes',
    href: '/dashboard/students',
    icon: Users,
  },
  {
    label: 'Cursos',
    href: '/dashboard/courses',
    icon: BookOpen,
  },
  {
    label: 'Tomar Asistencia',
    href: '/dashboard/attendance',
    icon: ClipboardList,
    disabled: true,
    badge: 'Próximamente',
  },
  {
    label: 'Exportar Excel',
    href: '/dashboard/export',
    icon: FileSpreadsheet,
    disabled: true,
    badge: 'Próximamente',
  },
]

export function Sidebar({ userEmail, userName, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : userEmail
    ? userEmail[0].toUpperCase()
    : 'U'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(item: (typeof navItems)[0]) {
    if (item.exact) {
      return pathname === item.href
    }
    return pathname.startsWith(item.href)
  }

  return (
    <div className="flex flex-col h-full bg-[#3d100f] text-white w-64">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#6b1e1d]">
        <div>
          <h2 className="text-lg font-bold text-white">SysAsistencia</h2>
          <p className="text-xs text-[#d49392]">Sistema de Asistencia</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#d49392] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#b07271] cursor-not-allowed select-none"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-[#6b1e1d] text-[#d49392] border-0"
                  >
                    {item.badge}
                  </Badge>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-[#6b1e1d] text-white'
                  : 'text-[#dba8a7] hover:bg-[#521614] hover:text-white'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="px-4 pb-4 border-t border-[#6b1e1d] pt-4">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-[#8a2826] text-white text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            {userName && (
              <p className="text-sm font-medium text-white truncate">{userName}</p>
            )}
            {userEmail && (
              <p className="text-xs text-[#d49392] truncate">{userEmail}</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-[#dba8a7] hover:text-white hover:bg-[#521614]"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
