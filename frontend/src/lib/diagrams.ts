import type { SchemaTable, ApiEndpoint, Architecture } from './types';

/**
 * Generate a Mermaid ER diagram from schema tables.
 * Detects foreign key relationships from column names ending in _id.
 */
export function generateERDiagram(schema: SchemaTable[]): string {
  if (!schema.length) return 'erDiagram\n  NO_TABLES["No tables defined"]';

  let diagram = 'erDiagram\n';

  // Sanitize table name for Mermaid (no spaces/special chars)
  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Collect all table names for FK detection
  const tableNames = new Set(schema.map((t) => sanitize(t.table)));

  // Track relationships to avoid duplicates
  const relationships = new Set<string>();

  for (const table of schema) {
    const tName = sanitize(table.table);

    // Add columns
    for (const col of table.columns) {
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
      const isFK = col.name.endsWith('_id') || (col.note || '').toUpperCase().includes('FK');

      const constraint = isPK ? 'PK' : isFK ? 'FK' : '';

      diagram += `  ${tName} {\n    ${colType} ${colName}${constraint ? ' ' + constraint : ''}\n  }\n`;

      // Detect FK relationships
      if (isFK && col.name.endsWith('_id')) {
        const refTable = sanitize(col.name.replace(/_id$/, ''));
        // Try singular → plural matching
        const candidates = [refTable, refTable + 's', refTable + 'es'];
        for (const candidate of candidates) {
          if (tableNames.has(candidate)) {
            const relKey = `${candidate}-${tName}`;
            if (!relationships.has(relKey)) {
              relationships.add(relKey);
              diagram += `  ${candidate} ||--o{ ${tName} : "has"\n`;
            }
            break;
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
  subgraph Client["🌐 Client Layer"]
    FE["${escapeMermaid(arch.frontend)}"]
  end

  subgraph Server["⚙️ Server Layer"]
    BE["${escapeMermaid(arch.backend)}"]
    AUTH["${escapeMermaid(arch.auth)}"]
  end

  subgraph Data["💾 Data Layer"]
    DB["${escapeMermaid(arch.database)}"]
  end

  subgraph Infra["☁️ Infrastructure"]
    HOST["${escapeMermaid(arch.hosting)}"]
  end

  FE -->|"API Requests"| BE
  BE -->|"Auth Check"| AUTH
  BE -->|"Query/Mutate"| DB
  FE -.->|"Deployed on"| HOST
  BE -.->|"Deployed on"| HOST
  DB -.->|"Hosted on"| HOST

  style Client fill:#1a1a2e,stroke:#7c6aff,color:#f0f0f8
  style Server fill:#1a1a2e,stroke:#22d3a5,color:#f0f0f8
  style Data fill:#1a1a2e,stroke:#f59e0b,color:#f0f0f8
  style Infra fill:#1a1a2e,stroke:#60a5fa,color:#f0f0f8
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
  return str
    .replace(/"/g, "'")
    .replace(/[[\]{}()#&]/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}
