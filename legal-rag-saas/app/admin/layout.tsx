/**
 * Admin Layout - Dashboard de Comandă Central
 * 
 * Toate paginile de admin folosesc acest layout:
 * - Sidebar navigabil pe stânga
 * - Header cu user info
 * - Breadcrumb navigation
 * - Responsive (mobile drawer)
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Admin Center - LegalRAG',
  description: 'Dashboard de administrare platformă',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Verificare autentificare
  if (!session?.user?.email) {
    redirect('/auth/signin?callbackUrl=/admin');
  }

  // Verificare admin - folosește același logic ca în paginile existente
  const isAdmin = (session.user as any).isAdmin === true || 
                  session.user.email === 'admin@example.com';

  if (!isAdmin) {
    redirect('/dashboard?error=not-admin');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header fix sus */}
      <AdminHeader user={session.user} />
      
      <div className="flex pt-14">
        {/* Sidebar fix stânga */}
        <AdminSidebar />
        
        {/* Main content */}
        <main className="flex-1 lg:ml-64 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      
      <Toaster />
    </div>
  );
}
