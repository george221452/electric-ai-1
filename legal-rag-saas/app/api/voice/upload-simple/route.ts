import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";

const execAsync = promisify(exec);
const SAMPLES_DIR = join(process.cwd(), "voice-samples");

// Configurare pentru App Router - permite fișiere până la 10MB
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function findFfmpeg(): Promise<string | null> {
  // Posibile căi pentru ffmpeg
  const possiblePaths = [
    join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "ffmpeg",
  ];
  
  for (const path of possiblePaths) {
    try {
      await execAsync(`"${path}" -version`, { timeout: 5000 });
      console.log("[Voice Upload] Found ffmpeg at:", path);
      return path;
    } catch {
      continue;
    }
  }
  
  return null;
}

async function convertWebmToWav(inputPath: string, outputPath: string): Promise<void> {
  const ffmpegCmd = await findFfmpeg();
  
  if (!ffmpegCmd) {
    console.log("[Voice Upload] ffmpeg not found, saving as webm");
    throw new Error("ffmpeg not available");
  }
  
  const cmd = `"${ffmpegCmd}" -i "${inputPath}" -ar 22050 -ac 1 -c:a pcm_s16le "${outputPath}" -y`;
  console.log("[Voice Upload] Converting:", cmd);
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
    if (stderr) console.log("[Voice Upload] ffmpeg stderr:", stderr.substring(0, 200));
    console.log("[Voice Upload] Conversion successful:", outputPath);
  } catch (error: any) {
    console.error("[Voice Upload] Conversion failed:", error.message);
    throw new Error("Failed to convert audio to WAV format: " + error.message);
  }
}

export async function POST(req: NextRequest) {
  console.log("[Voice Upload] Received upload request");
  
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const voiceName = (formData.get("voice_name") as string) || "default";

    console.log("[Voice Upload] Voice name:", voiceName);
    console.log("[Voice Upload] Audio file:", audioFile?.name, "size:", audioFile?.size);

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Crează directorul dacă nu există
    await mkdir(SAMPLES_DIR, { recursive: true });

    // Salvează fișierul temporar
    const bytes = await audioFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilename = `${voiceName}_temp.webm`;
    const wavFilename = `${voiceName}.wav`;
    const tempPath = join(SAMPLES_DIR, tempFilename);
    const wavPath = join(SAMPLES_DIR, wavFilename);
    
    await writeFile(tempPath, buffer);
    console.log(`[Voice Upload] Saved temp file: ${tempPath} (${buffer.length} bytes)`);

    // Convertește în WAV
    let conversionSuccess = false;
    try {
      await convertWebmToWav(tempPath, wavPath);
      conversionSuccess = true;
      
      // Șterge fișierul temporar webm
      try {
        await unlink(tempPath);
      } catch (e) {
        console.log("[Voice Upload] Could not delete temp file:", e);
      }
      
      // Șterge vechiul fișier .webm dacă există
      const oldWebmPath = join(SAMPLES_DIR, `${voiceName}.webm`);
      if (existsSync(oldWebmPath)) {
        try {
          await unlink(oldWebmPath);
          console.log(`[Voice Upload] Deleted old file: ${oldWebmPath}`);
        } catch {
          // Ignoră
        }
      }

      console.log(`[Voice Upload] Saved WAV: ${wavPath}`);

      return NextResponse.json({
        success: true,
        voice_id: voiceName,
        path: wavPath,
        message: "Vocea ta a fost salvată!"
      });
    } catch (convError: any) {
      console.error("[Voice Upload] Conversion error:", convError.message);
      
      // Fallback: salvează ca webm dacă conversia eșuează
      if (!conversionSuccess) {
        const webmPath = join(SAMPLES_DIR, `${voiceName}.webm`);
        try {
          await writeFile(webmPath, buffer);
          console.log(`[Voice Upload] Saved as webm fallback: ${webmPath}`);
          
          // Șterge temporarul
          try {
            await unlink(tempPath);
          } catch {}
          
          return NextResponse.json({
            success: true,
            voice_id: voiceName,
            path: webmPath,
            message: "Vocea salvată (format webm - conversia WAV nu a reușit)"
          });
        } catch (saveError: any) {
          console.error("[Voice Upload] Fallback save failed:", saveError.message);
        }
      }
      
      return NextResponse.json(
        { error: convError.message || "Failed to process audio" },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("[Voice Upload] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to save voice sample: " + error.message },
      { status: 500 }
    );
  }
}
