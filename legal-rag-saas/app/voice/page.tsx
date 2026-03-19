import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Info, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function VoicePage() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Înapoi la Chat
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Configurare Voce Personală</h1>
          <div className="w-24" /> {/* Spacer pentru centrat */}
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Info className="h-5 w-5" />
              Cum funcționează?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-blue-700 space-y-2">
            <p>
              <strong>Înregistrează-ți vocea o singură dată</strong> și sistemul o va folosi 
              pentru a citi TOATE răspunsurile pe care le primești. 
            </p>
            <p>
              Vei auzi răspunsurile în <strong>propria ta voce</strong>, vorbind în limba română 
              cu intonație naturală!
            </p>
            <ul className="list-disc list-inside text-sm mt-2 space-y-1">
              <li>100% gratuit și privat (vocea rămâne pe calculatorul tău)</li>
              <li>Funcționează cu orice text, chiar și cu cuvinte noi</li>
              <li>Poți reînregistra oricând dacă nu-ți place cum sună</li>
              <li>Durată recomandată: 15-20 secunde de vorbire clară</li>
            </ul>
          </CardContent>
        </Card>

        {/* Recorder */}
        <VoiceRecorder />

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Întrebări Frecvente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium">De ce trebuie să citesc un text anume?</p>
              <p className="text-muted-foreground">
                AI-ul are nevoie să-ți audie vocea vorbind natural pentru a învăța 
                cum pronunți cuvintele. Textul conține diverse sunete din limba română.
              </p>
            </div>
            <div>
              <p className="font-medium">Unde este salvată vocea mea?</p>
              <p className="text-muted-foreground">
                Pe calculatorul tău, în folderul <code>voice-samples/</code>. 
                Nu pleacă nicăieri, este 100% privat.
              </p>
            </div>
            <div>
              <p className="font-medium">Ce se întâmplă dacă nu-mi place cum sună?</p>
              <p className="text-muted-foreground">
                Poți reveni oricând pe această pagină și reînregistra. 
                Încearcă să vorbești mai clar sau să folosești un microfon mai bun.
              </p>
            </div>
            <div>
              <p className="font-medium">Pot șterge vocea mea?</p>
              <p className="text-muted-foreground">
                Da! Șterge fișierul <code>voice-samples/default.wav</code> și 
                sistemul va folosi vocea standard a browserului.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
