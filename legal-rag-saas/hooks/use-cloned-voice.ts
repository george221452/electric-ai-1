"use client";

import { useState, useCallback, useRef } from "react";

interface UseClonedVoiceReturn {
  isGenerating: boolean;
  isPlaying: boolean;
  error: string | null;
  generateAndPlay: (text: string, voiceId?: string, useElevenLabs?: boolean) => Promise<void>;
  stopPlaying: () => void;
  clearError: () => void;
}

export function useClonedVoice(): UseClonedVoiceReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const generateAndPlay = useCallback(async (text: string, voiceId: string = "default", useElevenLabs: boolean = false) => {
    if (!text || text.trim().length === 0) {
      setError("Nu există text de citit");
      return;
    }

    // Oprește audio anterior dacă există
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (useElevenLabs) {
        // 🎙️ ElevenLabs - Voce AI Pro (Română nativă)
        console.log("[ElevenLabs] Generating TTS...");
        
        const response = await fetch("/api/voice/elevenlabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            voiceId: "21m00Tcm4TlvDq8ikWAM", // Adam - voce naturală
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Eroare ElevenLabs");
        }

        const data = await response.json();
        
        if (!data.audioBase64) {
          throw new Error("Nu s-a primit audio");
        }

        // Crează audio element și redă
        const audioSrc = `data:audio/mp3;base64,${data.audioBase64}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;

        audio.onplay = () => {
          console.log("[ElevenLabs] Playing...");
          setIsPlaying(true);
          setIsGenerating(false);
        };

        audio.onended = () => {
          console.log("[ElevenLabs] Finished");
          setIsPlaying(false);
          audioRef.current = null;
        };

        audio.onerror = () => {
          console.error("[ElevenLabs] Playback error");
          setIsPlaying(false);
          setError("Eroare la redarea audio");
          audioRef.current = null;
        };

        await audio.play();
      } else {
        // 🎙️ XTTS Local - Vocea mea (Poloneză, fonetic apropiat)
        console.log("[XTTS Local] Generating TTS...");
        
        const response = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text.trim(),
            voiceId,
            language: "pl", // Poloneză - fonetic apropiat de Română
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Eroare la generarea vocii");
        }

        const data = await response.json();
        
        if (!data.audioBase64) {
          throw new Error("Nu s-a primit audio");
        }

        // Crează audio element și redă
        const audioSrc = `data:audio/wav;base64,${data.audioBase64}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;

        audio.onplay = () => {
          console.log("[XTTS] Playing...");
          setIsPlaying(true);
          setIsGenerating(false);
        };

        audio.onended = () => {
          console.log("[XTTS] Finished");
          setIsPlaying(false);
          audioRef.current = null;
        };

        audio.onerror = () => {
          console.error("[XTTS] Playback error");
          setIsPlaying(false);
          setError("Eroare la redarea audio");
          audioRef.current = null;
        };

        await audio.play();
      }
    } catch (err: any) {
      console.error("[Voice] Error:", err);
      setError(err.message || "Eroare la generarea vocii");
      setIsGenerating(false);
    }
  }, []);

  const stopPlaying = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isGenerating,
    isPlaying,
    error,
    generateAndPlay,
    stopPlaying,
    clearError,
  };
}
