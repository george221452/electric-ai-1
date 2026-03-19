import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("file");
    const workspaceId = searchParams.get("workspaceId") || "550e8400-e29b-41d4-a716-446655440000";

    if (!filename) {
      return NextResponse.json(
        { error: "Filename required" },
        { status: 400 }
      );
    }

    // Security: prevent directory traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const workspaceDir = join(UPLOADS_DIR, workspaceId);
    const filePath = join(workspaceDir, sanitizedFilename);

    try {
      const content = await readFile(filePath, "utf-8");
      
      // Parse paragraphs with line numbers
      const lines = content.split('\n');
      const paragraphs = lines.map((line, index) => ({
        lineNumber: index + 1,
        text: line.trim(),
      })).filter(p => p.text.length > 0);

      return NextResponse.json({
        filename: sanitizedFilename,
        content,
        paragraphs,
        totalLines: lines.length,
        totalParagraphs: paragraphs.length,
      });
    } catch (e) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("[Documents] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
