'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Settings,
  LogOut,
  User,
  Shield,
  Home,
  Menu,
  Bell,
  Search,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AdminSidebar } from './AdminSidebar';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AdminHeader({ user }: AdminHeaderProps) {
  const pathname = usePathname();

  // Generează breadcrumb din pathname
  const pathSegments = pathname
    .split('/')
    .filter(Boolean)
    .slice(1); // Skip 'admin'

  const getBreadcrumbLabel = (segment: string) => {
    const labels: Record<string, string> = {
      'rag-architecture': 'Arhitectură RAG',
      'rag-test': 'Test Suite',
      'users': 'Utilizatori',
      'documents': 'Documente',
      'feedback': 'Feedback',
      'analytics': 'Analytics',
      'database': 'Database',
      'health': 'System Health',
      'security': 'Securitate',
      'performance': 'Performance',
    };
    return labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Logo & Mobile Menu */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Admin Center</h2>
              </div>
              <div className="py-4">
                <AdminSidebar />
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-sm">LegalRAG</h1>
              <p className="text-[10px] text-muted-foreground">Admin Center</p>
            </div>
          </Link>

          {/* Breadcrumb - Desktop */}
          <div className="hidden lg:block ml-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin">
                    <Home className="h-3.5 w-3.5" />
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1;
                  const href = '/admin/' + pathSegments.slice(0, index + 1).join('/');
                  
                  return (
                    <div key={segment} className="flex items-center gap-2">
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{getBreadcrumbLabel(segment)}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={href}>
                            {getBreadcrumbLabel(segment)}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </div>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        {/* Right: Actions & User */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Search className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificări</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-80 overflow-auto">
                <div className="p-3 text-sm border-b">
                  <p className="font-medium">Nou utilizator înregistrat</p>
                  <p className="text-xs text-muted-foreground">Acum 5 minute</p>
                </div>
                <div className="p-3 text-sm border-b">
                  <p className="font-medium">Document procesat cu succes</p>
                  <p className="text-xs text-muted-foreground">Acum 15 minute</p>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.image || ''} alt={user.name || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user.name?.charAt(0) || user.email?.charAt(0) || 'A'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name || 'Admin'}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <Badge variant="secondary" className="mt-2">
                  <Shield className="mr-1 h-3 w-3" />
                  Administrator
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Înapoi la App
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Setări
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Deconectare
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
