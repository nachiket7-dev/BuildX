import type { SchemaTable, ApiEndpoint, Architecture } from './types';

/**
 * Generate a Mermaid ER diagram from schema tables.
 * Detects foreign key relationships from column names ending in _id.
 */
export function generateERDiagram(schema: SchemaTable[]): string {
  if (!schema || !schema.length) return 'erDiagram\n  NO_TABLES["No tables defined"]';

  let diagram = 'erDiagram\n';

  // Sanitize table name for Mermaid (no spaces/special chars)
  const sanitize = (name: string) => (name || 'collection').replace(/[^a-zA-Z0-9_]/g, '_');

  // Collect all table names for FK detection (both sanitized and lowercase for matching)
  const tableNames = new Set(schema.map((t) => sanitize(t.table || '')));
  const tableNamesLower = new Map<string, string>();
  for (const t of schema) {
    const sName = sanitize(t.table || '');
    tableNamesLower.set(sName.toLowerCase(), sName);
  }

  // Track relationships to avoid duplicates
  const relationships = new Set<string>();

  // 1. Declare all table columns in structured single-block styles
  for (const table of schema) {
    const tName = sanitize(table.table || '');
    diagram += `  ${tName} {\n`;

    for (const col of (table.columns || [])) {
      const colName = col.name.replace(/[^a-zA-Z0-9_]/g, '_');
      let colType = 'string';

      const t = col.type.toUpperCase();
      if (t.includes('INT') || t.includes('SERIAL')) colType = 'int';
      else if (t.includes('UUID')) colType = 'uuid';
      else if (t.includes('BOOL')) colType = 'bool';
      else if (t.includes('TIMESTAMP') || t.includes('DATE')) colType = 'datetime';
      else if (t.includes('JSON')) colType = 'json';
      else if (t.includes('TEXT') || t.includes('VARCHAR')) colType = 'string';
      else if (t.includes('FLOAT') || t.includes('DECIMAL') || t.includes('NUMERIC')) colType = 'float';

      const isPK = (col.type + ' ' + (col.note || '')).toUpperCase().includes('PRIMARY KEY') ||
                   (col.note || '').toUpperCase().includes('PK');
      const isFK = col.name.endsWith('_id') || 
                   col.name.endsWith('Id') || 
                   col.name.endsWith('ID') || 
                   (col.note || '').toUpperCase().includes('FK') ||
                   (col.type + ' ' + (col.note || '')).toLowerCase().includes('references');

      const constraint = isPK ? 'PK' : isFK ? 'FK' : '';
      diagram += `    ${colType} ${colName}${constraint ? ' ' + constraint : ''}\n`;
    }
    diagram += `  }\n`;
  }

  // 2. Generate relationship connections with improved detection
  // Helper: extract base name from FK column name
  const extractBaseName = (colName: string): string => {
    // Handle snake_case: user_id → user, category_id → category
    if (colName.toLowerCase().endsWith('_id')) {
      return colName.slice(0, -3);
    }
    // Handle camelCase: userId → user, categoryId → category
    if (colName.endsWith('Id') && colName.length > 2) {
      const base = colName.slice(0, -2);
      // Convert camelCase to snake_case for matching
      return base.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }
    if (colName.endsWith('ID') && colName.length > 2) {
      return colName.slice(0, -2).toLowerCase();
    }
    return '';
  };

  // Helper: generate pluralization candidates
  const generateCandidates = (base: string): string[] => {
    const lower = base.toLowerCase();
    const candidates = [
      lower,
      lower + 's',
      lower + 'es',
    ];
    // user → users, category → categories
    if (lower.endsWith('y')) {
      candidates.push(lower.slice(0, -1) + 'ies');
    }
    // users → user, categories → category
    if (lower.endsWith('ies')) {
      candidates.push(lower.slice(0, -3) + 'y');
    }
    if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes')) {
      candidates.push(lower.slice(0, -2));
    }
    if (lower.endsWith('s') && !lower.endsWith('ss')) {
      candidates.push(lower.slice(0, -1));
    }
    // Handle underscored names: order_item → order_items
    if (lower.includes('_')) {
      const parts = lower.split('_');
      const lastPart = parts[parts.length - 1];
      const prefix = parts.slice(0, -1).join('_');
      candidates.push(prefix + '_' + lastPart + 's');
      if (lastPart.endsWith('s')) {
        candidates.push(prefix + '_' + lastPart.slice(0, -1));
      }
    }
    return candidates;
  };

  // Helper: find matching table name (case-insensitive)
  const findMatchingTable = (candidates: string[]): string | null => {
    for (const candidate of candidates) {
      const match = tableNamesLower.get(candidate);
      if (match) return match;
    }
    return null;
  };

  for (const table of schema) {
    const tName = sanitize(table.table || '');

    for (const col of (table.columns || [])) {
      const colName = col.name.replace(/[^a-zA-Z0-9_]/g, '_');
      const isFK = col.name.endsWith('_id') || 
                   col.name.endsWith('Id') || 
                   col.name.endsWith('ID') || 
                   (col.note || '').toUpperCase().includes('FK') ||
                   (col.type + ' ' + (col.note || '')).toLowerCase().includes('references');

      if (isFK) {
        // Try explicit REFERENCES clause first
        const noteStr = ((col.type || '') + ' ' + (col.note || '')).toLowerCase();
        const refMatch = noteStr.match(/references\s+([a-zA-Z0-9_]+)/);
        let matchedTable = '';

        if (refMatch) {
          const refName = sanitize(refMatch[1]);
          if (tableNames.has(refName)) {
            matchedTable = refName;
          } else {
            // Try case-insensitive match
            const found = tableNamesLower.get(refName.toLowerCase());
            if (found) matchedTable = found;
          }
        }

        // Try column name-based detection if REFERENCES didn't work
        if (!matchedTable) {
          const baseName = extractBaseName(colName);
          if (baseName) {
            const candidates = generateCandidates(baseName);
            const found = findMatchingTable(candidates);
            if (found && found !== tName) {
              matchedTable = found;
            }
          }
        }

        if (matchedTable && matchedTable !== tName) {
          // Use a canonical key to avoid duplicate relationships
          const simpleKey = `${matchedTable}-${tName}`;
          if (!relationships.has(simpleKey)) {
            relationships.add(simpleKey);
            diagram += `  ${matchedTable} ||--o{ ${tName} : "has"\n`;
          }
        }
      }
    }
  }

  // 3. If no relationships were detected at all, try to infer from table names
  if (relationships.size === 0 && schema.length > 1) {
    // Look for tables whose names suggest they're junction/child tables
    for (const table of schema) {
      const tName = sanitize(table.table || '');
      const tLower = tName.toLowerCase();
      
      // Check if this table name contains another table's name (e.g., "order_items" contains "order")
      for (const otherTable of schema) {
        const otherName = sanitize(otherTable.table || '');
        if (otherName === tName) continue;
        const otherLower = otherName.toLowerCase();
        
        if (tLower.includes(otherLower) || tLower.includes(otherLower.replace(/s$/, ''))) {
          const relKey = `${otherName}-${tName}`;
          if (!relationships.has(relKey)) {
            relationships.add(relKey);
            diagram += `  ${otherName} ||--o{ ${tName} : "has"\n`;
          }
        }
      }
    }
  }

  return diagram;
}

/**
 * Generate a Mermaid flowchart showing the system architecture.
 */
export function generateArchDiagram(arch: Architecture): string {
  return `flowchart TD
  subgraph Client["Client Layer"]
    FE["${escapeMermaid(arch.frontend)}"]
  end

  subgraph Server["Server Layer"]
    BE["${escapeMermaid(arch.backend)}"]
    AUTH["${escapeMermaid(arch.auth)}"]
  end

  subgraph Data["Data Layer"]
    DB["${escapeMermaid(arch.database)}"]
  end

  subgraph Infra["Infrastructure"]
    HOST["${escapeMermaid(arch.hosting)}"]
  end

  FE -->|"API Requests"| BE
  BE -->|"Auth Check"| AUTH
  BE -->|"Query/Mutate"| DB
  FE -.->|"Deployed on"| HOST
  BE -.->|"Deployed on"| HOST
  DB -.->|"Hosted on"| HOST

  style Client fill:#18181B,stroke:#14b8a6,color:#f4f4f5
  style Server fill:#18181B,stroke:#2dd4bf,color:#f4f4f5
  style Data fill:#18181B,stroke:#f59e0b,color:#f0f0f8
  style Infra fill:#18181B,stroke:#60a5fa,color:#f0f0f8
`;
}

/**
 * Generate a Mermaid sequence diagram showing typical API request flow.
 */
export function generateAPIFlow(endpoints: ApiEndpoint[]): string {
  // Pick a representative set of endpoints (max 8) covering different methods
  const selected: ApiEndpoint[] = [];
  const methodsSeen = new Set<string>();

  // First pass: one of each method
  for (const ep of endpoints) {
    if (!methodsSeen.has(ep.method) && selected.length < 8) {
      selected.push(ep);
      methodsSeen.add(ep.method);
    }
  }

  // Second pass: fill up to 8 with auth-required endpoints
  for (const ep of endpoints) {
    if (selected.length >= 8) break;
    if (ep.auth && !selected.includes(ep)) {
      selected.push(ep);
    }
  }

  let diagram = `sequenceDiagram
  participant U as User/Browser
  participant FE as Frontend
  participant API as Backend API
  participant DB as Database
`;

  for (const ep of selected) {
    const desc = escapeMermaid(ep.description);
    diagram += `\n  Note over U,FE: ${ep.method} ${escapeMermaid(ep.path)}\n`;
    diagram += `  U->>FE: ${desc}\n`;
    diagram += `  FE->>API: ${ep.method} ${escapeMermaid(ep.path)}\n`;

    if (ep.auth) {
      diagram += `  API->>API: Verify Auth Token\n`;
    }

    diagram += `  API->>DB: Query\n`;
    diagram += `  DB-->>API: Result\n`;
    diagram += `  API-->>FE: JSON Response\n`;
    diagram += `  FE-->>U: Update UI\n`;
  }

  return diagram;
}

/** Escape special characters that break Mermaid syntax */
function escapeMermaid(str: string): string {
  if (!str) return '';
  return str
    .replace(/"/g, "'")
    .replace(/[[\]{}()#&]/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}
