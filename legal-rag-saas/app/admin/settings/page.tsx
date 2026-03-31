'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Setări Platformă</h1>
        <p className="text-muted-foreground">
          Configurări generale pentru platformă
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Setări Generale
          </CardTitle>
          <CardDescription>
            Configurări de bază pentru platformă
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nume Platformă</Label>
              <Input defaultValue="LegalRAG" />
            </div>
            <div className="space-y-2">
              <Label>Email Contact</Label>
              <Input defaultValue="contact@legalrag.ro" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Înregistrare Deschisă</Label>
                <p className="text-sm text-muted-foreground">Permite utilizatorilor noi să se înregistreze</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Afișează pagina de mentenanță</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Trimite notificări pe email</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>

          <div className="flex justify-end">
            <Button>
              <Save className="mr-2 h-4 w-4" />
              Salvează Setări
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
