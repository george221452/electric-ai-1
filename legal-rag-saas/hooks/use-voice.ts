"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface UseVoiceOptions {
  onTranscript?: (text: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  lang?: string;
}

interface UseVoiceReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  hasSpeechRecognition: boolean;
  permissionStatus: "prompt" | "granted" | "denied" | "unknown";
  isSpeaking: boolean;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  hasSpeechSynthesis: boolean;
  voices: SpeechSynthesisVoice[];
  currentLang: string;
  setLanguage: (lang: string) => void;
  error: string | null;
  clearError: () => void;
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const { onTranscript, onListeningChange, lang = "ro-RO" } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentLang, setCurrentLang] = useState(lang);
  const [permissionStatus, setPermissionStatus] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown");
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onListeningChangeRef = useRef(onListeningChange);
  const voicesLoadedRef = useRef(false);
  
  // Keep callbacks fresh
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onListeningChangeRef.current = onListeningChange;
  }, [onTranscript, onListeningChange]);
  
  // Verifică suportul browserului
  const hasSpeechRecognition = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;
  
  // Încarcă vocile disponibile
  useEffect(() => {
    if (!hasSpeechSynthesis) return;
    
    synthRef.current = window.speechSynthesis;
    
    const loadVoices = () => {
      const availableVoices = synthRef.current?.getVoices() || [];
      console.log("[Voice] Available voices:", availableVoices.map(v => `${v.name} (${v.lang})`));
      setVoices(availableVoices);
      voicesLoadedRef.current = true;
    };
    
    // Vocile se încarcă asincron în unele browsere
    loadVoices();
    
    if (synthRef.current) {
      synthRef.current.onvoiceschanged = loadVoices;
    }
    
    return () => {
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = null;
      }
    };
  }, [hasSpeechSynthesis]);
  
  // Verifică permisiunea pentru microfon
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.permissions) return;
    
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((result) => {
      setPermissionStatus(result.state as "prompt" | "granted" | "denied");
      
      result.addEventListener("change", () => {
        setPermissionStatus(result.state as "prompt" | "granted" | "denied");
      });
    }).catch(() => {
      setPermissionStatus("unknown");
    });
  }, []);
  
  // Stop listening function - defined early
  const stopListening = useCallback(() => {
    console.log("[Voice] Stop listening called");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }
    setIsListening(false);
    onListeningChangeRef.current?.(false);
  }, []);
  
  // Inițializare Speech Recognition
  useEffect(() => {
    if (!hasSpeechRecognition) {
      console.log("[Voice] Speech recognition not supported");
      return;
    }
    
    console.log("[Voice] Initializing speech recognition with lang:", currentLang);
    
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognitionAPI();
    
    const recognition = recognitionRef.current;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = currentLang;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      console.log("[Voice] Recognition started");
      setIsListening(true);
      setTranscript("");
      onListeningChangeRef.current?.(true);
    };
    
    recognition.onresult = (event: any) => {
      console.log("[Voice] Got result:", event);
      
      let finalTranscript = "";
      let interimTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log(`[Voice] Result ${i}: isFinal=${event.results[i].isFinal}, text="${transcript}"`);
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        console.log("[Voice] Final transcript:", finalTranscript);
        setTranscript(finalTranscript);
        if (onTranscriptRef.current) {
          console.log("[Voice] Calling onTranscript callback");
          onTranscriptRef.current(finalTranscript);
        }
        setTimeout(() => {
          stopListening();
        }, 500);
      } else if (interimTranscript) {
        console.log("[Voice] Interim transcript:", interimTranscript);
        setTranscript(interimTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error("[Voice] Speech recognition error:", event.error);
      
      switch (event.error) {
        case "not-allowed":
          setError("Microfonul nu are permisiune. Te rugăm să permiți accesul la microfon în setările browserului.");
          setPermissionStatus("denied");
          break;
        case "no-speech":
          setError("Nu s-a detectat voce. Încearcă să vorbești mai tare sau mai aproape de microfon.");
          break;
        case "network":
          setError("Eroare de rețea. Verifică conexiunea la internet.");
          break;
        case "aborted":
          break;
        default:
          setError(`Eroare recunoaștere vocală: ${event.error}`);
      }
      
      setIsListening(false);
      onListeningChangeRef.current?.(false);
    };
    
    recognition.onend = () => {
      console.log("[Voice] Recognition ended");
      setIsListening(false);
      onListeningChangeRef.current?.(false);
    };
    
    return () => {
      try {
        recognition.stop();
      } catch (e) {
        // Ignore
      }
    };
  }, [hasSpeechRecognition, currentLang, stopListening]);
  
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = currentLang;
    }
  }, [currentLang]);
  
  const startListening = useCallback(() => {
    console.log("[Voice] Start listening called");
    
    if (!recognitionRef.current) {
      console.error("[Voice] Recognition not initialized");
      setError("Browserul tău nu suportă recunoașterea vocală. Folosește Chrome sau Edge.");
      return;
    }
    
    if (permissionStatus === "denied") {
      setError("Microfonul este blocat. Deschide setările browserului și permite accesul.");
      return;
    }
    
    setError(null);
    setTranscript("");
    
    try {
      console.log("[Voice] Starting recognition...");
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("[Voice] Error starting recognition:", err);
      if (err.message?.includes("already started")) {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            recognitionRef.current?.start();
          }, 100);
        } catch (e) {
          // Ignore
        }
      } else {
        setError("Eroare la pornirea microfonului. Încearcă din nou.");
      }
    }
  }, [permissionStatus]);
  
  // Funcție pentru normalizarea textului românesc pentru TTS
  const normalizeRomanianText = (text: string): string => {
    // Înlocuiește diacriticele cu echivalente fonetice pentru citire mai bună
    return text
      .replace(/ă/gi, 'a')
      .replace(/â/gi, 'a')
      .replace(/î/gi, 'i')
      .replace(/ș/gi, 'sh')
      .replace(/ț/gi, 'tz')
      .replace(/Ă/gi, 'A')
      .replace(/Â/gi, 'A')
      .replace(/Î/gi, 'I')
      .replace(/Ș/gi, 'Sh')
      .replace(/Ț/gi, 'Tz');
  };

  const speak = useCallback((text: string) => {
    if (!synthRef.current) {
      setError("Browserul tău nu suportă sinteza vocală.");
      return;
    }
    
    // Oprește orice vorbire anterioară
    synthRef.current.cancel();
    
    // Curăță textul pentru citire
    let cleanText = text
      .replace(/[#*_`~\[\]\|]/g, "")
      .replace(/[🟡🟢⚠️📄✅─═]/g, "")
      .replace(/RĂSPUNS GENERAT DE AI[\s\S]*?NU ESTE DIN DOCUMENTE NORMATIVE/gi, "Atenție. Răspuns generat de inteligență artificială. Nu din documente normative.")
      .replace(/RĂSPUNS BAZAT PE DOCUMENTE NORMATIVE/gi, "Răspuns bazat pe documente normative.")
      .replace(/Ce înseamnă acest lucru:/gi, "")
      .replace(/📋|✅|⚠️|🔍|💡|📝|📚|📖|🟡|🟢|─|═|\||/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();

    // Pentru română, normalizăm diacriticele pentru citire mai bună
    // Vocea franceză/italiană citește mai bine textul fără diacritici romanesti speciale
    const langPrefix = currentLang.split("-")[0];
    if (langPrefix === 'ro') {
      console.log("[Voice] Normalizing Romanian text for better TTS");
      cleanText = normalizeRomanianText(cleanText);
    }
    
    if (!cleanText) {
      console.log("[Voice] No text to speak after cleaning");
      return;
    }
    
    console.log("[Voice] Speaking:", cleanText.substring(0, 100) + "...");
    console.log("[Voice] Requested lang:", currentLang);
    
    utteranceRef.current = new SpeechSynthesisUtterance(cleanText);
    
    // Setează limba
    utteranceRef.current.lang = currentLang;
    
    utteranceRef.current.rate = 0.9;
    utteranceRef.current.pitch = 1;
    utteranceRef.current.volume = 1;
    
    // Găsește cea mai bună voce pentru limbă
    const availableVoices = synthRef.current.getVoices();
    console.log("[Voice] Looking for voices for lang:", currentLang, "prefix:", langPrefix);
    console.log("[Voice] Total voices available:", availableVoices.length);
    
    // Caută vocile în ordinea preferinței
    let selectedVoice: SpeechSynthesisVoice | null = null;
    
    // 1. Caută voce nativă pentru limba exactă
    selectedVoice = availableVoices.find(v => 
      v.lang === currentLang && 
      (v.localService === true || v.name.includes("Google") || v.name.includes("Apple"))
    ) || null;
    
    // 2. Caută voce pentru prefixul limbii
    if (!selectedVoice) {
      selectedVoice = availableVoices.find(v => 
        v.lang.startsWith(langPrefix) && 
        (v.localService === true || v.name.includes("Google") || v.name.includes("Apple"))
      ) || null;
    }
    
    // 3. Caută orice voce pentru limbă
    if (!selectedVoice) {
      selectedVoice = availableVoices.find(v => v.lang.startsWith(langPrefix)) || null;
    }
    
    // 4. Fallback la prima voce disponibilă (doar dacă nu găsim nimic)
    if (!selectedVoice && availableVoices.length > 0) {
      selectedVoice = availableVoices[0];
      console.log("[Voice] Warning: Using fallback voice:", selectedVoice.name, selectedVoice.lang);
    }
    
    if (selectedVoice) {
      utteranceRef.current.voice = selectedVoice;
      console.log("[Voice] Selected voice:", selectedVoice.name, "lang:", selectedVoice.lang, "local:", selectedVoice.localService);
    } else {
      console.warn("[Voice] No voice found! Using default.");
    }
    
    utteranceRef.current.onstart = () => {
      console.log("[Voice] Started speaking");
      setIsSpeaking(true);
    };
    
    utteranceRef.current.onend = () => {
      console.log("[Voice] Finished speaking");
      setIsSpeaking(false);
    };
    
    utteranceRef.current.onerror = (e) => {
      console.error("[Voice] Speech error:", e);
      setIsSpeaking(false);
      setError("Eroare la redarea vocală. Încearcă din nou.");
    };
    
    synthRef.current.speak(utteranceRef.current);
  }, [currentLang, voices]);
  
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  }, []);
  
  const setLanguage = useCallback((lang: string) => {
    setCurrentLang(lang);
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    hasSpeechRecognition,
    permissionStatus,
    isSpeaking,
    speak,
    stopSpeaking,
    hasSpeechSynthesis,
    voices,
    currentLang,
    setLanguage,
    error,
    clearError,
  };
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
