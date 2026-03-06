import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DocumentList } from "@/components/documents/document-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Test workspace for demo
const TEST_WORKSPACE_ID = "550e8400-e29b-41d4-a716-446655440000";

export default async function DashboardPage() {
  const session = await auth();

  // Allow both authenticated and demo users
  const user = session?.user || { 
    id: "demo-user", 
    email: "demo@legalrag.com",
    name: "Demo User"
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">LegalRAG Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="chat" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="documents">Documente</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <ChatInterface workspaceId={TEST_WORKSPACE_ID} />
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documentele mele</CardTitle>
              </CardHeader>
              <CardContent>
                <DocumentList workspaceId={TEST_WORKSPACE_ID} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
