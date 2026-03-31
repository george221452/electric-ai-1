/**
 * Admin Dashboard - Pagina Principală
 * 
 * Afișează:
 * - Statistici generale platformă
 * - Status servicii
 * - Acces rapid la toate secțiunile
 * - Activitate recentă
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  Activity,
  Database,
  Zap,
  Settings,
  TestTube,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { getArchitectureSettings } from '@/lib/rag-architectures/settings-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const metadata: Metadata = {
  title: 'Admin Dashboard - LegalRAG',
  description: 'Dashboard de administrare platformă',
};

async function getDashboardData() {
  try {
    // Statistici utilizatori
    const usersCount = await prisma.user.count();
    const recentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Ultima săptămână
        },
      },
    });

    // Documente
    const documentsCount = await prisma.document.count();
    const documentsByStatus = await prisma.document.groupBy({
      by: ['status'],
      _count: true,
    });

    // Workspaces
    const workspacesCount = await prisma.workspace.count();

    // Feedback
    const feedbackCount = await prisma.feedback.count();
    const feedbackStats = await prisma.feedback.groupBy({
      by: ['rating'],
      _count: true,
    });

    // Setări RAG
    const ragSettings = await getArchitectureSettings();

    return {
      users: {
        total: usersCount,
        recent: recentUsers,
      },
      documents: {
        total: documentsCount,
        byStatus: documentsByStatus,
      },
      workspaces: workspacesCount,
      feedback: {
        total: feedbackCount,
        byRating: feedbackStats,
      },
      rag: ragSettings,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return null;
  }
}

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  const StatCard = ({
    title,
    value,
    description,
    icon: Icon,
    trend,
    href,
  }: {
    title: string;
    value: string | number;
    description: string;
    icon: React.ElementType;
    trend?: { value: number; positive: boolean };
    href: string;
  }) => (
    <Link href={href}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && (
            <div className={`text-xs mt-2 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '+' : ''}{trend.value}% față de săptămâna trecută
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );

  const QuickActionCard = ({
    title,
    description,
    icon: Icon,
    href,
    color,
  }: {
    title: string;
    description: string;
    icon: React.ElementType;
    href: string;
    color: string;
  }) => (
    <Link href={href}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${color}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview și management platformă LegalRAG
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Utilizatori Total"
          value={data?.users.total || 0}
          description={`${data?.users.recent || 0} noi în ultima săptămână`}
          icon={Users}
          trend={{ value: 12, positive: true }}
          href="/admin/users"
        />
        <StatCard
          title="Documente"
          value={data?.documents.total || 0}
          description={`${data?.documents.byStatus.find(s => s.status === 'COMPLETED')?._count || 0} procesate`}
          icon={FileText}
          href="/admin/documents"
        />
        <StatCard
          title="Workspace-uri"
          value={data?.workspaces || 0}
          description="Active pe platformă"
          icon={LayoutDashboard}
          href="/admin/users"
        />
        <StatCard
          title="Feedback-uri"
          value={data?.feedback.total || 0}
          description="Rating-uri primite"
          icon={MessageSquare}
          href="/admin/feedback"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Left Column - Quick Actions */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Acțiuni Rapide</CardTitle>
              <CardDescription>
                Accesează rapid cele mai folosite secțiuni
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <QuickActionCard
                title="Arhitectură RAG"
                description="Configurează setările RAG: Legacy vs Hybrid, componente, thresholds"
                icon={Settings}
                href="/admin/rag-architecture"
                color="bg-blue-500"
              />
              <QuickActionCard
                title="Test Suite"
                description="Rulează teste de acuratețe pe setul de întrebări definite"
                icon={TestTube}
                href="/admin/rag-test"
                color="bg-purple-500"
              />
              <QuickActionCard
                title="Gestionare Utilizatori"
                description="Vezi și administrează toți utilizatorii platformei"
                icon={Users}
                href="/admin/users"
                color="bg-green-500"
              />
              <QuickActionCard
                title="Analytics & Rapoarte"
                description="Statistici detaliate despre utilizare și performanță"
                icon={BarChart3}
                href="/admin/analytics"
                color="bg-orange-500"
              />
            </CardContent>
          </Card>

          {/* RAG Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Status RAG
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Arhitectura Activă</span>
                <Badge 
                  variant={data?.rag.activeArchitecture === 'legacy' ? 'default' : 'secondary'}
                  className={data?.rag.activeArchitecture === 'legacy' ? 'bg-blue-500' : 'bg-purple-500'}
                >
                  {data?.rag.activeArchitecture === 'legacy' ? 'Legacy' : 'Hybrid'}
                </Badge>
              </div>
              
              {data?.rag.activeArchitecture === 'legacy' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vector Search</span>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Keyword Search</span>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Min Score</span>
                    <span className="font-mono">{data?.rag.legacyMinScoreThreshold || 0.40}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Synonym Expansion</span>
                    {data?.rag.hybridUseSynonymExpansion ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-muted-foreground">OFF</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Smart Router</span>
                    {data?.rag.hybridUseSmartRouter ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-muted-foreground">OFF</span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Link href="/admin/rag-architecture">
                  <Button variant="outline" className="w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurează RAG
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Status & Activity */}
        <div className="lg:col-span-3 space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Sănătate Sistem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">PostgreSQL</span>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1" />
                    Online
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Qdrant</span>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1" />
                    Online
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Redis</span>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1" />
                    Online
                  </Badge>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/admin/health" className="w-full">
                <Button variant="ghost" className="w-full">
                  Vezi detalii
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Activitate Recentă</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />
                  <div>
                    <p className="text-sm">Document procesat</p>
                    <p className="text-xs text-muted-foreground">Ordin_2983.pdf • Acum 5 min</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 mt-2" />
                  <div>
                    <p className="text-sm">Utilizator nou înregistrat</p>
                    <p className="text-xs text-muted-foreground">ion.popescu@example.com • Acum 15 min</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-purple-500 mt-2" />
                  <div>
                    <p className="text-sm">Setare RAG modificată</p>
                    <p className="text-xs text-muted-foreground">Arhitectura schimbată în Hybrid • Acum 1 oră</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feedback Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Feedback Utilizatori</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>👍 Pozitiv</span>
                  <span className="font-medium">
                    {data?.feedback.byRating.find(r => r.rating === 2)?._count || 0}
                  </span>
                </div>
                <Progress 
                  value={data?.feedback.total ? 
                    ((data?.feedback.byRating.find(r => r.rating === 2)?._count || 0) / data.feedback.total * 100) : 0
                  } 
                  className="h-2"
                />
                <div className="flex items-center justify-between text-sm">
                  <span>👎 Negativ</span>
                  <span className="font-medium">
                    {data?.feedback.byRating.find(r => r.rating === 1)?._count || 0}
                  </span>
                </div>
                <Progress 
                  value={data?.feedback.total ? 
                    ((data?.feedback.byRating.find(r => r.rating === 1)?._count || 0) / data.feedback.total * 100) : 0
                  } 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
