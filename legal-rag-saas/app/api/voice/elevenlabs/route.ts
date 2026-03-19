import { NextRequest, NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId = "21m00Tcm4TlvDq8ikWAM" } = body; // Default: Adam

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 }
      );
    }

    console.log(`[ElevenLabs] Generating TTS for: "${text.substring(0, 50)}..."`);

    // Apel către ElevenLabs API
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_multilingual_v2", // Cel mai bun pentru română
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[ElevenLabs] Error:", errorData);
      return NextResponse.json(
        { error: errorData.detail?.message || "TTS generation failed" },
        { status: response.status }
      );
    }

    // Convertim audio la base64
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audioBase64: audioBase64,
      format: "mp3",
      voiceId: voiceId,
    });
  } catch (error) {
    console.error("[ElevenLabs API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - listează voice-urile disponibile
export async function GET() {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        "Accept": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch voices" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ voices: data.voices });
  } catch (error) {
    console.error("[ElevenLabs API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
