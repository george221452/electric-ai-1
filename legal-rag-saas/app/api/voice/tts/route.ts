import { NextRequest, NextResponse } from "next/server";

const OPENVOICE_URL = process.env.OPENVOICE_URL || "http://localhost:7860";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId = "default", language = "ro" } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    console.log(`[Voice API] Generating TTS for: "${text.substring(0, 50)}..."`);

    // Apel către serviciul OpenVoice - endpoint-ul /speak
    const response = await fetch(`${OPENVOICE_URL}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.trim(),
        voice_id: voiceId,
        language: 'pl', // XTTS: folosim Poloneză (fonetic apropiat de Română)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Voice API] OpenVoice error:", errorText);
      return NextResponse.json(
        { error: "TTS generation failed" },
        { status: response.status }
      );
    }

    // Primim audio direct (wav), convertim la base64
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    
    return NextResponse.json({
      success: true,
      audioBase64: audioBase64,
      format: "wav",
      voiceId: voiceId,
      language: language,
    });
  } catch (error) {
    console.error("[Voice API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
