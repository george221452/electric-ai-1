# 🎙️ Voice Cloning - Vocea Ta în Sistem

Acest sistem folosește **XTTS v2** (Coqui TTS) pentru voice cloning complet gratuit.

## Cum funcționează

1. **Tu înregistrezi** 10-30 secunde cu vocea ta citind un text
2. **AI-ul învață** cum vorbești din acel sample
3. **Sistemul poate "citi"** orice răspuns cu vocea ta!

## Setup Rapid

### Pasul 1: Pornește serviciul de voice cloning

```bash
# Oprește tot mai întâi
docker compose down

# Pornește cu voice cloning inclus
docker compose -f docker-compose.yml -f docker-compose.voice.yml up -d

# Sau alternativ, pornește doar voice cloning:
docker compose -f docker-compose.voice.yml up -d
```

### Pasul 2: Înregistrează-ți vocea

**Opțiunea A: Cu telefonul/computerul**
1. Deschide aplicația Voice Recorder ( sau Audacity)
2. Setări: **WAV, 22050Hz, mono**
3. Citește acest text (10-20 secunde):

```
Bună ziua! Sunt un electrician autorizat și vreau să învăț despre 
instalațiile electrice conform normativelor I7 și PE 116. 
Voi folosi acest sistem pentru a studia și a mă pregăti pentru examene.
```

4. Salvează fișierul ca `vocea_mea.wav`

**Opțiunea B: Direct în browser (în curând)**
- Vom adăuga buton de "Înregistrează vocea" direct în interfață

### Pasul 3: Copiază fișierul

```bash
# Copiază în folderul voice-samples
cp vocea_mea.wav ./voice-samples/

# Sau redenumește
cp vocea_mea.wav ./voice-samples/default.wav
```

### Pasul 4: Testează

1. Deschide aplicația: http://localhost:3000/dashboard
2. Pune o întrebare
3. Apasă butonul **"Vocea mea"** pe răspuns
4. Ascultă cum citește cu vocea ta! 🎉

## Recomandări pentru sample audio

| Parametru | Valoare ideală |
|-----------|----------------|
| Format | WAV |
| Sample rate | 22050 Hz sau 44100 Hz |
| Canale | Mono (1 canal) |
| Durată | 10-30 secunde |
| Volum | Clar, fără distorsiuni |
| Fundal | Liniște, fără zgomot |

## Troubleshooting

### "Nu găsesc sample audio"
Verifică că fișierul e în `./voice-samples/` și se termină în `.wav`

### "Vocea sună robotic"
- Sample-ul tău e prea scurt (< 10 secunde)
- Calitatea audio e proastă
- Înregistrează din nou cu mai multă claritate

### "Serviciul nu răspunde"
```bash
# Verifică dacă containerul rulează
docker ps | grep openvoice

# Vezi log-uri
docker logs legal-rag-saas-openvoice-1

# Repornește
docker compose -f docker-compose.voice.yml restart
```

## Tehnologie

- **Model**: XTTS v2 (Coqui TTS)
- **Capabilități**: Voice cloning, multilingual
- **Calitate**: Aproape indistinguibil de vocea reală
- **Cost**: 100% FREE, open source

## Limbi suportate

- 🇷🇴 Română (ro)
- 🇬🇧 Engleză (en)
- 🇫🇷 Franceză (fr)
- 🇩🇪 Germană (de)
- 🇪🇸 Spaniolă (es)
- + multe altele

## Alternative

Dacă nu vrei voice cloning, sistemul folosește automat **Web Speech API** (vocea browserului).

---

**Întrebări?** Verifică log-urile în consola browserului (F12) sau log-urile Docker.
