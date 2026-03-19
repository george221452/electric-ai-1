#!/bin/bash
# Scraper simplu folosind curl (cu bypass SSL)

echo "╔════════════════════════════════════════════════════════╗"
echo "║     🌐 Document Scraper (curl edition)                 ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Folderul de destinație
read -p "📁 Folder unde să salvez documentele: " OUTPUT_DIR
OUTPUT_DIR="${OUTPUT_DIR/#\~/$HOME}"

# Crează folderul
mkdir -p "$OUTPUT_DIR"
echo "📂 Folder: $OUTPUT_DIR"

# URL-ul
read -p "🌐 URL pagină web: " URL

echo ""
echo "🔍 Descarc pagina..."

# Descarcă pagina cu curl (bypass SSL)
HTML_FILE="/tmp/page_$$.html"
curl -sL -k "$URL" -o "$HTML_FILE"

if [ ! -f "$HTML_FILE" ]; then
    echo "❌ Nu pot descărca pagina"
    exit 1
fi

echo "✅ Pagină descărcată ($(wc -c < "$HTML_FILE") bytes)"
echo ""

# Extrage link-uri PDF
echo "🔍 Caut documente PDF..."
grep -oE 'href="[^"]+\.pdf"' "$HTML_FILE" | sed 's/href="//;s/"$//' | sort -u > "/tmp/links_$$.txt"

# Adaugă și link-uri relative
grep -oE "href='[^']+\.pdf'" "$HTML_FILE" | sed "s/href='//;s/'$//" | sort -u >> "/tmp/links_$$.txt"

# Construiește URL-uri complete
BASE_URL=$(echo "$URL" | grep -oE 'https?://[^/]+')

echo ""
echo "📊 Documente găsite:"

COUNT=0
while IFS= read -r link; do
    [ -z "$link" ] && continue
    
    # Construiește URL complet
    if [[ "$link" == http* ]]; then
        FULL_URL="$link"
    elif [[ "$link" == /* ]]; then
        FULL_URL="${BASE_URL}${link}"
    else
        FULL_URL="${URL%/*}/${link}"
    fi
    
    # Filename
    FILENAME=$(basename "$link" | sed 's/[^a-zA-Z0-9._-]/_/g')
    
    # Dacă nu are .pdf, adaugă
    if [[ ! "$FILENAME" =~ \.pdf$ ]]; then
        FILENAME="${FILENAME}.pdf"
    fi
    
    COUNT=$((COUNT + 1))
    echo "  $COUNT. $FILENAME"
    echo "     URL: ${FULL_URL:0:60}..."
    
done < "/tmp/links_$$.txt"

if [ $COUNT -eq 0 ]; then
    echo "⚠️ Nu s-au găsit documente PDF"
    rm -f "$HTML_FILE" "/tmp/links_$$.txt"
    exit 0
fi

echo ""
read -p "⬇️  Vrei să descarci cele $COUNT documente? (da/nu): " CONFIRM

if [[ "$CONFIRM" != "da" && "$CONFIRM" != "d" ]]; then
    echo "❌ Anulat"
    rm -f "$HTML_FILE" "/tmp/links_$$.txt"
    exit 0
fi

echo ""
echo "⬇️  Descărcare documente..."
echo ""

SUCCESS=0
FAILED=0
INDEX=0

while IFS= read -r link; do
    [ -z "$link" ] && continue
    
    INDEX=$((INDEX + 1))
    
    # Construiește URL complet
    if [[ "$link" == http* ]]; then
        FULL_URL="$link"
    elif [[ "$link" == /* ]]; then
        FULL_URL="${BASE_URL}${link}"
    else
        FULL_URL="${URL%/*}/${link}"
    fi
    
    # Filename
    FILENAME=$(basename "$link" | sed 's/[^a-zA-Z0-9._-]/_/g')
    if [[ ! "$FILENAME" =~ \.pdf$ ]]; then
        FILENAME="${FILENAME}.pdf"
    fi
    
    OUTPUT_PATH="$OUTPUT_DIR/$FILENAME"
    
    # Skip dacă există
    if [ -f "$OUTPUT_PATH" ]; then
        echo "  [$INDEX/$COUNT] ⏭️  Există: $FILENAME"
        SUCCESS=$((SUCCESS + 1))
        continue
    fi
    
    # Descarcă
    echo -n "  [$INDEX/$COUNT] Descarc $FILENAME... "
    
    if curl -sL -k "$FULL_URL" -o "$OUTPUT_PATH" --max-time 30; then
        SIZE=$(du -h "$OUTPUT_PATH" 2>/dev/null | cut -f1)
        echo "✅ $SIZE"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "❌ Eroare"
        FAILED=$((FAILED + 1))
    fi
    
    # Delay
    sleep 0.5
    
done < "/tmp/links_$$.txt"

# Curăță
rm -f "$HTML_FILE" "/tmp/links_$$.txt"

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              📊 RAPORT FINAL                           ║"
echo "╠════════════════════════════════════════════════════════╣"
printf "║  ✅ Succes: %3d                                        ║\n" "$SUCCESS"
printf "║  ❌ Eșuate: %3d                                        ║\n" "$FAILED"
printf "║  📁 Folder: %-40s   ║\n" "${OUTPUT_DIR:0:40}"
echo "╚════════════════════════════════════════════════════════╝"

echo ""
echo "📂 Fișiere descărcate:"
ls -lh "$OUTPUT_DIR"/*.pdf 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
