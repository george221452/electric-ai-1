'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Database, 
  Activity, 
  Zap, 
  Server,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  uptime: string;
  latency: string;
  icon: React.ElementType;
}

const services: ServiceStatus[] = [
  { name: 'PostgreSQL', status: 'healthy', uptime: '99.9%', latency: '12ms', icon: Database },
  { name: 'Qdrant', status: 'healthy', uptime: '99.8%', latency: '45ms', icon: Zap },
  { name: 'Redis', status: 'healthy', uptime: '100%', latency: '2ms', icon: Activity },
  { name: 'Next.js App', status: 'healthy', uptime: '99.5%', latency: '120ms', icon: Server },
];

export default function HealthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
        <p className="text-muted-foreground">
          Monitorizare status și performanță servicii
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Card key={service.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={service.status === 'healthy' ? 'default' : 'destructive'}
                    className={service.status === 'healthy' ? 'bg-green-500' : ''}
                  >
                    {service.status === 'healthy' ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertCircle className="w-3 h-3 mr-1" />
                    )}
                    {service.status === 'healthy' ? 'Healthy' : 'Error'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span className="font-medium">{service.uptime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency:</span>
                    <span className="font-medium">{service.latency}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resurse Sistem</CardTitle>
          <CardDescription>Utilizare resurse server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>CPU Usage</span>
              <span className="font-medium">45%</span>
            </div>
            <Progress value={45} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Memory Usage</span>
              <span className="font-medium">62%</span>
            </div>
            <Progress value={62} className="h-2" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Disk Usage</span>
              <span className="font-medium">38%</span>
            </div>
            <Progress value={38} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
