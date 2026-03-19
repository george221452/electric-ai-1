/**
 * Simple analyzer for universal concepts
 */

export function isUniversalConcept(subject: string): boolean {
  const universalSubjects = ['selectivitate', 'scurtcircuit', 'tensiune'];
  return universalSubjects.includes(subject.toLowerCase());
}

export function getUniversalResponse(subject: string): string {
  const responses: Record<string, string> = {
    'selectivitate': `**Selectivitatea** - Principii Generale

Selectivitatea se realizează PRIN ACELEAȘI PRINCIPII indiferent de material (cupru/aluminiu) sau locație (interior/exterior):

### 1. Raportul curenților (1:3)
- Tablou principal (amonte): 300mA
- Tablou intermediar: 100mA  
- Tablou final (aval): 30mA

### 2. Temporizare
- Tip S (selectiv, amonte): 150-500ms
- Tip general (aval): 40-300ms

### 3. Schema pentru 3 tablouri

Principal: DDR 300mA tip S
    ↓
Etaj 1: DDR 100mA tip S
    ↓
Etaj 2: DDR 30mA tip general

### IMPORTANT:
Aceste principii sunt UNIVERSALE și se aplică identic pentru:
- Instalații interioare sau exterioare
- Conductoare din cupru sau aluminiu
- Orice secțiune (1.5mm², 2.5mm², 10mm², etc.)

Doar dimensiunile conductoarelor diferă, NU principiile de selectivitate!`,

    'scurtcircuit': `**Curentul de scurtcircuit** - Calcul General

Formula: Isc = Un / Z

Unde:
- Un = tensiune nominală
- Z = impedanța de scurtcircuit

Materialul (cupru/aluminiu) afectează doar valoarea numerică, NU metodologia!`,

    'default': `Pentru ${subject}, principiile generale sunt aceleași indiferent de detalii constructive.`
  };

  return responses[subject.toLowerCase()] || responses['default'];
}
