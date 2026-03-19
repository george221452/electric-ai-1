"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, Play, Save, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const SAMPLE_TEXTS = [
  {
    id: "scurt",
    title: "Varianta Scurtă (10 secunde)",
    text: `Bună ziua! Sunt electrician autorizat și folosesc acest sistem pentru a studia normativele I7 și PE 116. Vocea mea va citi răspunsurile sistemului.`,
  },
  {
    id: "mediu", 
    title: "Varianta Medie (20 secunde) - RECOMANDAT",
    text: `Bună ziua! Numele meu este utilizatorul acestui sistem inteligent de învățare pentru electricieni. Voi folosi această aplicație pentru a studia normativele tehnice precum I7 din 2011 și PE 116. Sistemul îmi va oferi răspunsuri bazate pe documente legale și tehnice, iar eu voi asculta aceste răspunsuri în propria mea voce. Mulțumesc!`,
  },
  {
    id: "lung",
    title: "Varianta Lungă (30 secunde) - CEA MAI BUNĂ CALITATE",
    text: `Bună ziua! Sunt un electrician autorizat în România și folosesc acest sistem inteligent pentru pregătirea examenelor și consultarea normativelor. Aplicația îmi oferă răspunsuri bazate pe I7 din 2011, PE 116 și alte documente tehnice. Îmi doresc ca sistemul să citească aceste răspunsuri folosind propria mea voce nativă, pentru o experiență personalizată și naturală. Acum înregistrez acest sample audio pentru a putea clona vocea mea. Mulțumesc pentru această tehnologie minunată!`,
  },
];

export function VoiceRecorder() {
  const [selectedText, setSelectedText] = useState(SAMPLE_TEXTS[1]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Verifică suportul browserului
  const hasMediaRecorder = typeof window !== "undefined" && "MediaRecorder" in window;
  const hasGetUserMedia = typeof window !== "undefined" && "navigator" in window && "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices;

  // Log la montare
  useEffect(() => {
    console.log("[VoiceRecorder] Browser support check:");
    console.log("  - MediaRecorder:", hasMediaRecorder);
    console.log("  - getUserMedia:", hasGetUserMedia);
    console.log("  - User agent:", navigator.userAgent);
    
    if (typeof window !== "undefined" && "MediaRecorder" in window) {
      console.log("[VoiceRecorder] Supported MIME types:");
      console.log("  - audio/webm;codecs=opus:", MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));
      console.log("  - audio/webm:", MediaRecorder.isTypeSupported('audio/webm'));
      console.log("  - audio/mp4:", MediaRecorder.isTypeSupported('audio/mp4'));
    }
  }, [hasMediaRecorder, hasGetUserMedia]);

  const startRecording = useCallback(async () => {
    console.log("[VoiceRecorder] Start recording clicked");
    console.log("[VoiceRecorder] MediaRecorder supported:", hasMediaRecorder);
    console.log("[VoiceRecorder] getUserMedia supported:", hasGetUserMedia);

    if (!hasMediaRecorder) {
      setError("Browserul tău nu suportă înregistrarea audio. Folosește Chrome, Edge sau Firefox.");
      return;
    }

    if (!hasGetUserMedia) {
      setError("Browserul tău nu permite accesul la microfon.");
      return;
    }

    try {
      setError(null);
      setRecordedBlob(null);
      setRecordedUrl(null);
      setUploadSuccess(false);
      audioChunksRef.current = [];

      console.log("[VoiceRecorder] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 22050,
          channelCount: 1,
        } 
      });
      console.log("[VoiceRecorder] Microphone access granted!");

      // Verifică ce mime types sunt suportate
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      
      console.log("[VoiceRecorder] Using mime type:", mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        console.log("[VoiceRecorder] Data available:", event.data.size, "bytes");
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("[VoiceRecorder] Recording stopped");
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedUrl(url);
        
        // Oprește toate track-urile
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error("[VoiceRecorder] MediaRecorder error:", event);
        setError("Eroare la înregistrare. Încearcă din nou.");
      };

      mediaRecorder.start(100); // Colectează date la fiecare 100ms
      console.log("[VoiceRecorder] MediaRecorder started");
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("[VoiceRecorder] Recording error:", err);
      console.error("[VoiceRecorder] Error name:", err.name);
      console.error("[VoiceRecorder] Error message:", err.message);
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("Accesul la microfon a fost refuzat. Apasă pe iconița 🔒 din bara de adrese și permite accesul.");
      } else if (err.name === "NotFoundError") {
        setError("Nu s-a găsit niciun microfon. Conectează un microfon și încearcă din nou.");
      } else {
        setError(err.message || "Eroare la accesarea microfonului. Verifică permisiunile.");
      }
    }
  }, [hasMediaRecorder, hasGetUserMedia]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const playRecording = useCallback(() => {
    if (!recordedUrl) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    audioRef.current = new Audio(recordedUrl);
    audioRef.current.onplay = () => setIsPlaying(true);
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.play();
  }, [recordedUrl]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const saveVoice = useCallback(async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", recordedBlob, "vocea_mea.webm");
      formData.append("voice_name", "default");

      // Încearcă mai întâi API-ul simplu (care salvează direct)
      console.log("[VoiceRecorder] Saving voice...");
      let response = await fetch("/api/voice/upload-simple", {
        method: "POST",
        body: formData,
      });

      // Dacă eșuează, încearcă serviciul extern
      if (!response.ok) {
        console.log("[VoiceRecorder] Trying external voice service...");
        response = await fetch("http://localhost:7860/upload", {
          method: "POST",
          body: formData,
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Eroare la salvare");
      }

      const data = await response.json();
      console.log("Voice saved:", data);
      setUploadSuccess(true);

      // Afișează mesaj despre status
      if (data.message) {
        setError(data.message); // Folosim error state pentru mesaj info (verde)
      }

      // Reîmprospătează pagina după 3 secunde
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Eroare la salvarea vocii. Încearcă din nou.");
    } finally {
      setIsUploading(false);
    }
  }, [recordedBlob]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Înregistrează-ți Vocea
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avertisment browser */}
        {(!hasMediaRecorder || !hasGetUserMedia) && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium mb-2">⚠️ Browserul tău nu suportă înregistrarea audio</p>
            <p className="text-sm text-red-600">
              Folosește <strong>Chrome</strong>, <strong>Edge</strong> sau <strong>Firefox</strong> pentru a înregistra vocea.
            </p>
          </div>
        )}

        {/* Selectare text */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Alege textul de citit:</label>
          <div className="grid gap-2">
            {SAMPLE_TEXTS.map((text) => (
              <Button
                key={text.id}
                variant={selectedText.id === text.id ? "default" : "outline"}
                className="justify-start h-auto py-3 px-4"
                onClick={() => setSelectedText(text)}
              >
                <div className="text-left">
                  <div className="font-medium">{text.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {text.text.substring(0, 80)}...
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Text de citit */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Text de citit:</p>
          <p className="text-sm leading-relaxed">{selectedText.text}</p>
        </div>

        {/* Timer */}
        {isRecording && (
          <div className="text-center">
            <div className="text-3xl font-bold text-red-500 animate-pulse">
              {formatTime(recordingTime)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Înregistrare în curs...
            </p>
          </div>
        )}

        {/* Butoane control */}
        <div className="flex justify-center gap-4">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="gap-2 bg-red-500 hover:bg-red-600"
              disabled={!!recordedBlob || !hasMediaRecorder || !hasGetUserMedia}
              title={!hasMediaRecorder || !hasGetUserMedia ? "Browserul nu suportă înregistrarea audio" : ""}
            >
              <Mic className="h-5 w-5" />
              {!hasMediaRecorder || !hasGetUserMedia ? "Nu e suportat" : "Începe Înregistrarea"}
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="gap-2"
            >
              <Square className="h-5 w-5" />
              Oprește ({formatTime(recordingTime)})
            </Button>
          )}
        </div>

        {/* Playback și Salvare */}
        {recordedBlob && recordedUrl && (
          <div className="space-y-4 p-4 border rounded-lg">
            <p className="text-sm font-medium text-center">Înregistrare finalizată!</p>
            
            <div className="flex justify-center gap-3">
              {!isPlaying ? (
                <Button onClick={playRecording} variant="outline" className="gap-2">
                  <Play className="h-4 w-4" />
                  Ascultă
                </Button>
              ) : (
                <Button onClick={stopPlayback} variant="outline" className="gap-2">
                  <Square className="h-4 w-4" />
                  Oprește
                </Button>
              )}
              
              <Button 
                onClick={saveVoice} 
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Se salvează...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvează Vocea Mea
                  </>
                )}
              </Button>
            </div>

            <audio ref={(el) => { if (el) audioRef.current = el; }} src={recordedUrl} className="hidden" />
          </div>
        )}

        {/* Erori */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Succes */}
        {uploadSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-green-700 font-medium">Vocea ta a fost salvată!</p>
              <p className="text-xs text-green-600">Pagina se va reîmprospăta automat...</p>
            </div>
          </div>
        )}

        {/* Instrucțiuni */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 <strong>Sfaturi pentru o înregistrare bună:</strong></p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>Folosește un microfon de calitate (căști cu microfon sunt perfecte)</li>
            <li>Înregistrează într-o cameră liniștită, fără ecou</li>
            <li>Vorbește natural, clar, cu intonație normală</li>
            <li>Nu vorbi prea repede sau prea încet</li>
            <li>Distanța de microfon: 15-20 cm</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
