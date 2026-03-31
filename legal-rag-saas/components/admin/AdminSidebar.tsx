'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  TestTube,
  BarChart3,
  Shield,
  MessageSquare,
  Database,
  Activity,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  description?: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Overview și statistici',
  },
  {
    title: 'Utilizatori',
    href: '/admin/users',
    icon: Users,
    description: 'Gestionare utilizatori',
    badge: 'Nou',
  },
  {
    title: 'Documente',
    href: '/admin/documents',
    icon: FileText,
    description: 'Toate documentele',
  },
  {
    title: 'Feedback',
    href: '/admin/feedback',
    icon: MessageSquare,
    description: 'Răspunsuri și rating',
  },
];

const ragNavItems: NavItem[] = [
  {
    title: 'Arhitectură RAG',
    href: '/admin/rag-architecture',
    icon: Settings,
    description: 'Configurare RAG',
  },
  {
    title: 'Test Suite',
    href: '/admin/rag-test',
    icon: TestTube,
    description: 'Testează acuratețea',
  },
  {
    title: 'Performance',
    href: '/admin/performance',
    icon: Activity,
    description: 'Metrici și optimizare',
  },
];

const systemNavItems: NavItem[] = [
  {
    title: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    description: 'Statistici utilizare',
  },
  {
    title: 'Database',
    href: '/admin/database',
    icon: Database,
    description: 'Status și mentenanță',
  },
  {
    title: 'System Health',
    href: '/admin/health',
    icon: Zap,
    description: 'Status servicii',
  },
  {
    title: 'Security',
    href: '/admin/security',
    icon: Shield,
    description: 'Audit și securitate',
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const NavSection = ({ 
    title, 
    items 
  }: { 
    title: string; 
    items: NavItem[] 
  }) => (
    <div className="px-3 py-2">
      {!collapsed && (
        <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          {title}
        </h3>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start relative',
                  collapsed ? 'px-2' : 'px-3'
                )}
                size={collapsed ? 'icon' : 'default'}
              >
                <Icon className={cn('h-4 w-4', !collapsed && 'mr-2')} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.title}</span>
                    {item.badge && (
                      <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {isActive && collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                )}
              </Button>
              {!collapsed && isActive && item.description && (
                <p className="px-3 py-1 text-xs text-muted-foreground">
                  {item.description}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] border-r bg-card transition-all duration-300 hidden lg:block',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Collapse button */}
          <div className="flex justify-end p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          <ScrollArea className="flex-1 py-2">
            <NavSection title="Principal" items={mainNavItems} />
            <Separator className="my-2" />
            <NavSection title="RAG & AI" items={ragNavItems} />
            <Separator className="my-2" />
            <NavSection title="Sistem" items={systemNavItems} />
          </ScrollArea>

          {/* Footer */}
          {!collapsed && (
            <div className="p-4 border-t">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs font-medium mb-1">Status Sistem</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Toate serviciile active
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background lg:hidden">
        <div className="flex justify-around p-2">
          {mainNavItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-col h-14 gap-1"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.title}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
