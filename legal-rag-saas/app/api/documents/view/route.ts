import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const docName = searchParams.get("name");
    const workspaceId = searchParams.get("workspaceId") || "550e8400-e29b-41d4-a716-446655440000";

    if (!docName) {
      return NextResponse.json(
        { error: "Document name required" },
        { status: 400 }
      );
    }

    // Find document by name in database
    const document = await prisma.document.findFirst({
      where: {
        name: docName,
        workspaceId: workspaceId,
      },
      select: {
        id: true,
        name: true,
        pageCount: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get all paragraphs for this document
    const paragraphs = await prisma.paragraph.findMany({
      where: {
        documentId: document.id,
      },
      orderBy: {
        paragraphNumber: 'asc',
      },
      select: {
        id: true,
        content: true,
        pageNumber: true,
        paragraphNumber: true,
        articleNumber: true,
        paragraphLetter: true,
      },
    });

    // Create paragraphs array for the viewer
    const viewerParagraphs = paragraphs.map((para, idx) => ({
      lineNumber: idx + 1,
      text: para.content,
      pageNumber: para.pageNumber,
      paragraphId: para.id,
    }));

    return NextResponse.json({
      filename: document.name,
      content: paragraphs.map(p => p.content).join('\n'),
      paragraphs: viewerParagraphs,
      totalLines: viewerParagraphs.length,
      totalParagraphs: paragraphs.length,
      documentId: document.id,
      pageCount: document.pageCount,
    });

  } catch (error) {
    console.error("[Documents View] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
