/**
 * Table Extractor Module
 * 
 * Extracts and indexes tables from normative documents (I7/2011).
 * Tables contain crucial technical data that needs to be searchable.
 */

export interface TableCell {
  row: number;
  col: number;
  content: string;
}

export interface NormativeTable {
  id: string;
  tableNumber: string; // e.g., "Tabelul 4.1"
  title: string;
  pageNumber: number;
  documentId: string;
  documentName: string;
  headers: string[];
  rows: string[][];
  rawText: string;
}

export interface TableSearchResult {
  table: NormativeTable;
  relevanceScore: number;
  matchedCells: TableCell[];
}

/**
 * Extract tables from text content using pattern matching
 * Designed for Romanian normative documents (I7/2011 format)
 */
export function extractTablesFromText(
  text: string,
  documentId: string,
  documentName: string
): NormativeTable[] {
  const tables: NormativeTable[] = [];
  
  // Pattern to find table references like "Tabelul 4.1" or "Tabelul 4.1."
  const tableRefPattern = /Tabelul\s+(\d+\.\d+(?:\.\d+)?)[\s.:-]*\n?([^\n]*(?:\n[^\n]{0,100}){0,5})/gi;
  
  let match;
  while ((match = tableRefPattern.exec(text)) !== null) {
    const tableNumber = `Tabelul ${match[1]}`;
    const tableContext = match[0] + match[2];
    
    // Try to extract table structure from context
    const table = parseTableStructure(
      tableContext,
      tableNumber,
      documentId,
      documentName,
      extractPageNumber(text, match.index)
    );
    
    if (table) {
      tables.push(table);
    }
  }
  
  return tables;
}

/**
 * Parse table structure from text context
 */
function parseTableStructure(
  context: string,
  tableNumber: string,
  documentId: string,
  documentName: string,
  pageNumber: number
): NormativeTable | null {
  // Extract title (usually after table number)
  const titleMatch = context.match(/Tabelul\s+\d+\.\d+[\s.:-]+([^\n]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Tabel ${tableNumber}`;
  
  // Look for tabular data patterns
  // Common patterns in normatives:
  // - Rows with multiple columns separated by tabs or multiple spaces
  // - Numbered rows
  // - Measurement units (mm, A, V, etc.)
  
  const lines = context.split('\n').filter(l => l.trim().length > 0);
  const rows: string[][] = [];
  const headers: string[] = [];
  
  let foundData = false;
  
  for (let i = 0; i < lines.length && i < 50; i++) {
    const line = lines[i].trim();
    
    // Skip table number line and title
    if (line.match(/Tabelul\s+\d+\.\d+/i)) continue;
    if (line === title) continue;
    
    // Detect headers (usually short lines with capital letters)
    if (!foundData && line.length < 100 && line.match(/[A-ZĂÎȘȚÂ]/)) {
      headers.push(...splitColumns(line));
      continue;
    }
    
    // Detect data rows (contain numbers, units, or are structured)
    if (line.match(/\d/) || line.includes('\t') || line.match(/\s{3,}/)) {
      const cols = splitColumns(line);
      if (cols.length >= 2) {
        rows.push(cols);
        foundData = true;
      }
    }
  }
  
  // Only return if we found actual data
  if (rows.length === 0) {
    return {
      id: `${documentId}-${tableNumber.replace(/\s/g, '_')}`,
      tableNumber,
      title,
      pageNumber,
      documentId,
      documentName,
      headers: headers.length > 0 ? headers : ['Coloana 1', 'Coloana 2'],
      rows: [],
      rawText: context.substring(0, 2000), // Store raw context for reference
    };
  }
  
  return {
    id: `${documentId}-${tableNumber.replace(/\s/g, '_')}`,
    tableNumber,
    title,
    pageNumber,
    documentId,
    documentName,
    headers: headers.length > 0 ? headers : generateHeaders(rows[0]?.length || 2),
    rows,
    rawText: context.substring(0, 2000),
  };
}

/**
 * Split a line into columns
 */
function splitColumns(line: string): string[] {
  // Try tab first
  if (line.includes('\t')) {
    return line.split('\t').map(c => c.trim()).filter(c => c.length > 0);
  }
  
  // Try multiple spaces (3+)
  const multiSpacePattern = /\s{3,}/;
  if (multiSpacePattern.test(line)) {
    return line.split(multiSpacePattern).map(c => c.trim()).filter(c => c.length > 0);
  }
  
  // Try pipe separator
  if (line.includes('|')) {
    return line.split('|').map(c => c.trim()).filter(c => c.length > 0);
  }
  
  // Default: return as single column or split on 2+ spaces
  return line.split(/\s{2,}/).map(c => c.trim()).filter(c => c.length > 0);
}

/**
 * Generate generic headers
 */
function generateHeaders(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Coloana ${i + 1}`);
}

/**
 * Extract page number from text position
 */
function extractPageNumber(text: string, position: number): number {
  // Look for page markers before this position
  const textBefore = text.substring(0, position);
  const pageMatches = textBefore.match(/pag(?:ina)?\.?\s*(\d+)/gi);
  
  if (pageMatches && pageMatches.length > 0) {
    const lastMatch = pageMatches[pageMatches.length - 1];
    const numMatch = lastMatch.match(/(\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }
  }
  
  // Estimate based on position (rough approximation)
  return Math.floor(position / 3000) + 1;
}

/**
 * Search tables by keyword
 */
export function searchTables(
  tables: NormativeTable[],
  query: string
): TableSearchResult[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  const results: TableSearchResult[] = [];
  
  for (const table of tables) {
    let score = 0;
    const matchedCells: TableCell[] = [];
    
    // Check table number match
    if (table.tableNumber.toLowerCase().includes(queryLower)) {
      score += 50;
    }
    
    // Check title match
    if (table.title.toLowerCase().includes(queryLower)) {
      score += 30;
    }
    
    // Check headers
    table.headers.forEach((header, colIdx) => {
      const headerLower = header.toLowerCase();
      for (const word of queryWords) {
        if (headerLower.includes(word)) {
          score += 10;
          matchedCells.push({ row: 0, col: colIdx, content: header });
        }
      }
    });
    
    // Check data rows
    table.rows.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const cellLower = cell.toLowerCase();
        for (const word of queryWords) {
          if (cellLower.includes(word)) {
            score += 5;
            matchedCells.push({ row: rowIdx + 1, col: colIdx, content: cell });
          }
        }
      });
    });
    
    // Check raw text
    if (table.rawText.toLowerCase().includes(queryLower)) {
      score += 3;
    }
    
    if (score > 0) {
      results.push({
        table,
        relevanceScore: score,
        matchedCells: matchedCells.slice(0, 10), // Limit matches
      });
    }
  }
  
  // Sort by relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return results;
}

/**
 * Format table for display
 */
export function formatTableForDisplay(table: NormativeTable): string {
  let output = `**${table.tableNumber}**\n`;
  output += `${table.title}\n`;
  output += `📄 Pagina ${table.pageNumber} din ${table.documentName}\n\n`;
  
  if (table.rows.length === 0) {
    output += `${table.rawText.substring(0, 500)}...\n`;
  } else {
    // Format as markdown table
    output += '| ' + table.headers.join(' | ') + ' |\n';
    output += '|' + table.headers.map(() => '---').join('|') + '|\n';
    
    for (const row of table.rows.slice(0, 20)) { // Limit to 20 rows
      output += '| ' + row.join(' | ') + ' |\n';
    }
    
    if (table.rows.length > 20) {
      output += `\n... și încă ${table.rows.length - 20} rânduri\n`;
    }
  }
  
  return output;
}

/**
 * Get table by number
 */
export function getTableByNumber(
  tables: NormativeTable[],
  tableNumber: string
): NormativeTable | null {
  const normalized = tableNumber.toLowerCase().replace(/\s+/g, ' ').trim();
  
  return tables.find(t => 
    t.tableNumber.toLowerCase() === normalized ||
    t.tableNumber.toLowerCase().replace(/\s+/g, '') === normalized.replace(/\s+/g, '')
  ) || null;
}

/**
 * Extract specific value from table by row/column criteria
 */
export function extractTableValue(
  table: NormativeTable,
  rowCriteria: string,
  colCriteria?: string
): string | null {
  const rowCritLower = rowCriteria.toLowerCase();
  const colCritLower = colCriteria?.toLowerCase();
  
  // Find target column index
  let targetCol = -1;
  if (colCritLower) {
    targetCol = table.headers.findIndex(h => 
      h.toLowerCase().includes(colCritLower)
    );
    if (targetCol === -1) return null;
  }
  
  // Find matching row
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    
    // Check if any cell in row matches criteria
    const rowMatches = row.some(cell => 
      cell.toLowerCase().includes(rowCritLower)
    );
    
    if (rowMatches) {
      if (targetCol >= 0 && targetCol < row.length) {
        return row[targetCol];
      }
      // Return first non-matching cell
      for (const cell of row) {
        if (!cell.toLowerCase().includes(rowCritLower)) {
          return cell;
        }
      }
    }
  }
  
  return null;
}
