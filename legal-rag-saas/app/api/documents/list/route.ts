import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId") || "550e8400-e29b-41d4-a716-446655440000";
    
    const files: { name: string; size: number; modified: string }[] = [];
    const workspaceDir = join(UPLOADS_DIR, workspaceId);

    try {
      const entries = await readdir(workspaceDir);
      
      for (const entry of entries) {
        if (entry.endsWith('.txt')) {
          const filePath = join(workspaceDir, entry);
          const stats = await stat(filePath);
          files.push({
            name: entry,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          });
        }
      }
    } catch (e) {
      // Directory might not exist
    }

    return NextResponse.json({ documents: files });
  } catch (error) {
    console.error("[Documents List] Error:", error);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}
