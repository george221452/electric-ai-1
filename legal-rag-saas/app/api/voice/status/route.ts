import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

const SAMPLES_DIR = process.env.VOICE_SAMPLES_DIR || "./voice-samples";

export async function GET() {
  try {
    // Verifică dacă există sample-uri audio
    let hasVoice = false;
    let voices: string[] = [];

    try {
      const files = await readdir(SAMPLES_DIR);
      voices = files
        .filter(f => f.endsWith(".wav") || f.endsWith(".mp3"))
        .map(f => f.replace(/\.wav$|\.mp3$/, ""));
      hasVoice = voices.length > 0;
    } catch {
      // Folderul nu există sau nu e accesibil
      hasVoice = false;
    }

    return NextResponse.json({
      hasVoice,
      voices,
      serviceAvailable: true,
    });
  } catch (error) {
    console.error("[Voice Status] Error:", error);
    return NextResponse.json(
      { hasVoice: false, voices: [], serviceAvailable: false },
      { status: 500 }
    );
  }
}
