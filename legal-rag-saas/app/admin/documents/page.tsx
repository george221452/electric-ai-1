'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Search, 
  Trash2, 
  Download, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Document {
  id: string;
  name: string;
  workspaceName: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  pageCount: number;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
}

export default function DocumentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Date mock
  const documents: Document[] = [
    {
      id: '1',
      name: 'NTE_001_Supratensiuni.pdf',
      workspaceName: 'Electric Pro',
      status: 'COMPLETED',
      pageCount: 45,
      fileSize: 2.5 * 1024 * 1024,
      uploadedAt: '2024-03-25',
      uploadedBy: 'Ion Popescu',
    },
    {
      id: '2',
      name: 'Ordin_2983_2024.pdf',
      workspaceName: 'Constructori X',
      status: 'PROCESSING',
      pageCount: 12,
      fileSize: 1.2 * 1024 * 1024,
      uploadedAt: '2024-03-26',
      uploadedBy: 'Maria Ionescu',
    },
    {
      id: '3',
      name: 'Normativ_I7_2011.pdf',
      workspaceName: 'Electric Pro',
      status: 'PENDING',
      pageCount: 0,
      fileSize: 5.8 * 1024 * 1024,
      uploadedAt: '2024-03-26',
      uploadedBy: 'Admin User',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Procesat</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Procesare</Badge>;
      case 'PENDING':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Așteaptă</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Eroare</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.workspaceName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Statistici
  const totalDocs = documents.length;
  const completedDocs = documents.filter(d => d.status === 'COMPLETED').length;
  const processingDocs = documents.filter(d => d.status === 'PROCESSING').length;
  const failedDocs = documents.filter(d => d.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documente</h1>
        <p className="text-muted-foreground">
          Gestionare documente încărcate pe platformă
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalDocs}</div>
            <div className="text-sm text-muted-foreground">Total documente</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{completedDocs}</div>
            <div className="text-sm text-muted-foreground">Procesate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{processingDocs}</div>
            <div className="text-sm text-muted-foreground">În procesare</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{failedDocs}</div>
            <div className="text-sm text-muted-foreground">Cu erori</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Toate Documentele</CardTitle>
              <CardDescription>
                {filteredDocs.length} documente găsite
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Caută documente..."
                  className="pl-8 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtru status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toate statusurile</SelectItem>
                  <SelectItem value="COMPLETED">Procesate</SelectItem>
                  <SelectItem value="PROCESSING">În procesare</SelectItem>
                  <SelectItem value="PENDING">Așteaptă</SelectItem>
                  <SelectItem value="FAILED">Eroare</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{doc.workspaceName}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                      {doc.pageCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{doc.pageCount} pagini</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {getStatusBadge(doc.status)}
                  <div className="text-sm text-muted-foreground">
                    {doc.uploadedAt}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
