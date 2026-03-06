import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paragraph = await prisma.paragraph.findUnique({
      where: { id: params.id },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            pageCount: true,
          },
        },
      },
    });

    if (!paragraph) {
      return NextResponse.json(
        { error: 'Paragraf negăsit' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: paragraph.id,
        content: paragraph.content,
        pageNumber: paragraph.pageNumber,
        paragraphNumber: paragraph.paragraphNumber,
        document: paragraph.document,
      },
    });
  } catch (error) {
    console.error('[Paragraph API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
