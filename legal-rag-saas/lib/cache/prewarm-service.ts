/**
 * Pre-warm Service
 * 
 * Pre-indexes common questions at startup to ensure fast responses
 * for the most frequent queries.
 */

import { unifiedCache } from './redis-cache';

// Top 100 most common electrical questions for I7/2011
export const TOP_100_QUESTIONS = [
  // Basic definitions (1-20)
  { query: "Ce este un DDR?", category: "basic" },
  { query: "Ce este împământarea de protecție?", category: "basic" },
  { query: "Ce este legarea echipotentială?", category: "basic" },
  { query: "Ce este un tablou electric?", category: "basic" },
  { query: "Ce este un conductor de protecție PE?", category: "basic" },
  { query: "Ce este un electrod de pământ?", category: "basic" },
  { query: "Ce este un circuit electric?", category: "basic" },
  { query: "Ce este o priză de pământ?", category: "basic" },
  { query: "Ce este un disjunctor?", category: "basic" },
  { query: "Ce este o siguranță fuzibilă?", category: "basic" },
  { query: "Ce este factorul de putere?", category: "basic" },
  { query: "Ce este curentul de scurtcircuit?", category: "basic" },
  { query: "Ce este rezistența de izolație?", category: "basic" },
  { query: "Ce este o priză industrială?", category: "basic" },
  { query: "Ce este iluminatul de siguranță?", category: "basic" },
  { query: "Ce este un transformator?", category: "basic" },
  { query: "Ce este un contor electric?", category: "basic" },
  { query: "Ce este o bară colectoare?", category: "basic" },
  { query: "Ce este separarea circuitelor?", category: "basic" },
  { query: "Ce este selectivitatea protecțiilor?", category: "basic" },

  // DDR Questions (21-35)
  { query: "Ce reprezintă valoarea de 30mA pentru DDR?", category: "ddr" },
  { query: "Ce tip de DDR trebuie în locuințe?", category: "ddr" },
  { query: "Unde se montează DDR-ul?", category: "ddr" },
  { query: "Ce curent nominal trebuie pentru DDR?", category: "ddr" },
  { query: "Câte prize pot fi protejate de un DDR?", category: "ddr" },
  { query: "Ce este un DDR de tip A?", category: "ddr" },
  { query: "Ce este un DDR de tip AC?", category: "ddr" },
  { query: "Ce este un DDR de tip B?", category: "ddr" },
  { query: "Ce sensibilitate trebuie pentru DDR în baie?", category: "ddr" },
  { query: "Se poate folosi DDR pentru tot tabloul?", category: "ddr" },
  { query: "Ce verificări se fac la DDR?", category: "ddr" },
  { query: "Cât timp rezistă un DDR?", category: "ddr" },
  { query: "Ce marcaje trebuie să aibă un DDR?", category: "ddr" },
  { query: "Cum se testează un DDR?", category: "ddr" },
  { query: "Ce tensiune nominală trebuie pentru DDR?", category: "ddr" },

  // Prize and circuits (36-50)
  { query: "La ce înălțime se montează prizele?", category: "prize" },
  { query: "Câte prize pot fi pe un circuit?", category: "prize" },
  { query: "Ce secțiune de cablu trebuie pentru prize?", category: "prize" },
  { query: "Ce protecție trebuie pentru prizele din baie?", category: "prize" },
  { query: "Se pot pune prize în baie?", category: "prize" },
  { query: "Ce înălțime trebuie pentru prize în bucătărie?", category: "prize" },
  { query: "Câte circuite de prize trebuie într-o casă?", category: "prize" },
  { query: "Ce tip de prize se folosesc în exterior?", category: "prize" },
  { query: "Ce protecție IP trebuie pentru prize în exterior?", category: "prize" },
  { query: "Se pot monta prize în pardoseală?", category: "prize" },
  { query: "Ce distanță trebuie între prize?", category: "prize" },
  { query: "Ce culori trebuie să aibă prizele?", category: "prize" },
  { query: "Cât curent poate suporta o priză?", category: "prize" },
  { query: "Ce marcaje trebuie să aibă prizele?", category: "prize" },
  { query: "Cum se protejează prizele împotriva umidității?", category: "prize" },

  // Grounding (51-65)
  { query: "Cum se realizează priza de pământ în fundație?", category: "impamantare" },
  { query: "Cât trebuie să fie rezistența de împământare?", category: "impamantare" },
  { query: "Ce tipuri de electrozi de pământ există?", category: "impamantare" },
  { query: "Cum se verifică împământarea?", category: "impamantare" },
  { query: "Ce dimensiuni trebuie să aibă electrozii de pământ?", category: "impamantare" },
  { query: "Cât trebuie să fie adâncimea electrozilor?", category: "impamantare" },
  { query: "Ce materiale se folosesc pentru împământare?", category: "impamantare" },
  { query: "Cum se conectează conductorul PE la împământare?", category: "impamantare" },
  { query: "Ce este legarea echipotentială principală?", category: "impamantare" },
  { query: "Ce este legarea echipotentială suplimentară?", category: "impamantare" },
  { query: "Unde este obligatorie legarea echipotentială suplimentară?", category: "impamantare" },
  { query: "Cum se dimensionează conductorul de împământare?", category: "impamantare" },
  { query: "Ce verificări se fac la priza de pământ?", category: "impamantare" },
  { query: "Câtă rezistență maximă este admisă pentru împământare?", category: "impamantare" },
  { query: "Ce se folosește pentru măsurarea rezistenței de împământare?", category: "impamantare" },

  // Cables (66-80)
  { query: "Ce secțiune de cablu trebuie pentru iluminat?", category: "cabluri" },
  { query: "Ce tip de cabluri se folosesc în instalații electrice?", category: "cabluri" },
  { query: "Se pot îngropa cablurile în șapă?", category: "cabluri" },
  { query: "Cum se dimensionează cablurile electrice?", category: "cabluri" },
  { query: "Ce temperatură maximă pot suporta cablurile?", category: "cabluri" },
  { query: "Ce distanță trebuie între cabluri și țevi de gaz?", category: "cabluri" },
  { query: "Cum se protejează cablurile împotriva mecanică?", category: "cabluri" },
  { query: "Ce marcaje trebuie să aibă cablurile?", category: "cabluri" },
  { query: "Cât curent poate suporta un cablu de 2.5 mm²?", category: "cabluri" },
  { query: "Ce izolație trebuie pentru cablurile din exterior?", category: "cabluri" },
  { query: "Se pot folosi cabluri flexibile în instalații fixe?", category: "cabluri" },
  { query: "Ce se folosește pentru trecerea cablurilor prin pereți?", category: "cabluri" },
  { query: "Cum se calculează căderea de tensiune în cabluri?", category: "cabluri" },
  { query: "Ce verificări se fac la cabluri înainte de montaj?", category: "cabluri" },
  { query: "Cât trebuie să fie adâncimea de îngropare a cablurilor?", category: "cabluri" },

  // Protection and safety (81-95)
  { query: "Ce protecție trebuie pentru prizele din exterior?", category: "protectie" },
  { query: "Ce protecție IP trebuie în baie?", category: "protectie" },
  { query: "Cum se realizează selectivitatea între siguranțe?", category: "protectie" },
  { query: "Ce tip de siguranțe se folosesc pentru iluminat?", category: "protectie" },
  { query: "Cum se dimensionează conductorul de protecție PE?", category: "protectie" },
  { query: "Ce este protecția la supratensiuni?", category: "protectie" },
  { query: "Ce este protecția la suprasarcină?", category: "protectie" },
  { query: "Ce este protecția la scurtcircuit?", category: "protectie" },
  { query: "Cum se protejează circuitele împotriva supratensiunilor?", category: "protectie" },
  { query: "Ce distanțe de siguranță trebuie respectate?", category: "protectie" },
  { query: "Ce verificări se fac la instalațiile electrice?", category: "protectie" },
  { query: "Ce documente trebuie pentru recepția unei instalații?", category: "protectie" },
  { query: "Cine poate efectua verificări la instalații electrice?", category: "protectie" },
  { query: "Ce este declarația de conformitate?", category: "protectie" },
  { query: "Ce măsuri de protecție se iau în caz de incendiu?", category: "protectie" },

  // Tables and articles (96-100)
  { query: "Ce spune Tabelul 4.1 despre DDR?", category: "referinte" },
  { query: "Ce conține Tabelul 5.1 despre secțiuni de cabluri?", category: "referinte" },
  { query: "Ce spune articolul 5.4.23 despre prize?", category: "referinte" },
  { query: "Ce conține capitolul 6 despre împământare?", category: "referinte" },
  { query: "Ce spune normativul despre instalațiile în zone periculoase?", category: "referinte" },
];

/**
 * Pre-warm the cache with top questions
 */
export async function prewarmCache(
  workspaceId: string,
  apiEndpoint: string = 'http://localhost:3000/api/rag/query'
): Promise<{
  success: number;
  failed: number;
  total: number;
}> {
  console.log(`[Pre-warm] Starting cache pre-warming with ${TOP_100_QUESTIONS.length} questions...`);
  
  let success = 0;
  let failed = 0;

  for (let i = 0; i < TOP_100_QUESTIONS.length; i++) {
    const { query, category } = TOP_100_QUESTIONS[i];
    
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          workspaceId,
        }),
      });

      if (response.ok) {
        success++;
        console.log(`[Pre-warm] [${i + 1}/100] ✅ ${category}: "${query.substring(0, 50)}..."`);
      } else {
        failed++;
        console.log(`[Pre-warm] [${i + 1}/100] ❌ ${category}: "${query.substring(0, 50)}..."`);
      }
    } catch (error) {
      failed++;
      console.error(`[Pre-warm] [${i + 1}/100] ❌ Error:`, error);
    }

    // Wait 200ms between requests to avoid overwhelming the API
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[Pre-warm] Complete! Success: ${success}, Failed: ${failed}`);
  
  return { success, failed, total: TOP_100_QUESTIONS.length };
}

/**
 * Check if cache needs pre-warming
 */
export async function shouldPrewarm(): Promise<boolean> {
  const stats = await unifiedCache.getStats();
  
  // If cache has less than 20 entries, it's probably a fresh start
  if (stats.size < 20) {
    return true;
  }
  
  return false;
}

/**
 * Get pre-warm status
 */
export function getPrewarmProgress(): {
  total: number;
  categories: Record<string, number>;
} {
  const categories: Record<string, number> = {};
  
  for (const q of TOP_100_QUESTIONS) {
    categories[q.category] = (categories[q.category] || 0) + 1;
  }
  
  return {
    total: TOP_100_QUESTIONS.length,
    categories,
  };
}
