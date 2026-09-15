import React, { useState, useRef, useEffect } from "react";
import type { Blueprint } from "../lib/types";
import {
  methodClass,
  complexityColor,
  resolveFlowSteps,
  flowStepRole,
} from "../lib/utils";
import { CodeStudio } from "./CodeStudio";
import { SpotlightCard } from "./SpotlightCard";
import {
  Lock,
  Database,
  Sliders,
  ShieldCheck,
  Sparkles,
  Calendar,
  Zap,
  DollarSign,
  Users,
  Terminal,
  User,
  ShoppingCart,
  Key,
  CreditCard,
  BarChart2,
  Settings,
  MessageSquare,
  Bell,
  Folder,
  Mail,
  Home,
  Search,
  TrendingUp,
  Package,
  Shield,
  FileText,
  Wrench,
  Layout,
  Send,
} from "./ui/icons";

// ─── Shared ─────────────────────────────────────────────────

// Map of section titles to Norvin numbered monospace prefixes
const SECTION_NUMBER_MAP: Record<string, string> = {
  "feature breakdown": "01",
  "database schema": "02",
  "api endpoints": "03",
  "ui screens": "04",
  architecture: "05",
  "effort estimation": "07",
  diagrams: "06",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  const raw = React.Children.toArray(children)
    .join("")
    .replace(/^\/\/\s*/, "")
    .trim();
  const number = Object.entries(SECTION_NUMBER_MAP).find(([key]) =>
    raw.toLowerCase().startsWith(key),
  )?.[1];
  return (
    <div className="panel-section-label">
      <span aria-hidden="true">{number || "↳"}</span>
      <h2>{raw}</h2>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SpotlightCard
      className={`panel-card ${className}`}
      spotlightColor="rgba(124, 124, 244, 0.10)"
    >
      {children}
    </SpotlightCard>
  );
}

// ─── emojiToIcon dynamic resolver ────────────────────────────

function emojiToIcon(emoji: string, size = 16) {
  const cleanEmoji = emoji?.trim();
  switch (cleanEmoji) {
    case "👤":
      return <User size={size} />;
    case "🛒":
      return <ShoppingCart size={size} />;
    case "🔑":
      return <Key size={size} />;
    case "💳":
      return <CreditCard size={size} />;
    case "📊":
      return <BarChart2 size={size} />;
    case "⚙️":
      return <Settings size={size} />;
    case "💬":
      return <MessageSquare size={size} />;
    case "📅":
      return <Calendar size={size} />;
    case "🗓️":
      return <Calendar size={size} />;
    case "🔔":
      return <Bell size={size} />;
    case "📁":
      return <Folder size={size} />;
    case "✉️":
    case "📧":
      return <Mail size={size} />;
    case "🏠":
      return <Home size={size} />;
    case "🔍":
      return <Search size={size} />;
    case "📈":
      return <TrendingUp size={size} />;
    case "📦":
      return <Package size={size} />;
    case "🔒":
      return <Lock size={size} />;
    case "🛡️":
      return <Shield size={size} />;
    case "💰":
      return <DollarSign size={size} />;
    case "📄":
      return <FileText size={size} />;
    case "🛠️":
      return <Wrench size={size} />;
    case "⚡":
      return <Zap size={size} />;
    default:
      return <Layout size={size} />;
  }
}

// ─── Features ───────────────────────────────────────────────

const FEATURE_CATS = [
  {
    key: "authentication" as const,
    label: "Authentication",
    icon: Lock,
    iconColor: "text-indigo-400",
    iconBg: "bg-indigo-500/10 border border-indigo-500/20",
    labelColor: "text-indigo-300",
  },
  {
    key: "core" as const,
    label: "Core Features",
    icon: Sliders,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border border-emerald-500/20",
    labelColor: "text-emerald-300",
  },
  {
    key: "admin" as const,
    label: "Admin Features",
    icon: ShieldCheck,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border border-amber-500/20",
    labelColor: "text-amber-300",
  },
  {
    key: "optional" as const,
    label: "Enhancements",
    icon: Sparkles,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10 border border-purple-500/20",
    labelColor: "text-purple-300",
  },
] as const;

export function FeaturesPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div>
      <SectionLabel>// feature breakdown</SectionLabel>
      {!FEATURE_CATS.some((cat) => blueprint.features?.[cat.key]?.length) && (
        <p className="panel-empty">No features defined in this blueprint.</p>
      )}
      <div className="blueprint-card-grid feature-grid">
        {FEATURE_CATS.map((cat) => {
          const items = blueprint.features?.[cat.key];
          if (!items?.length) return null;
          const Icon = cat.icon;
          return (
            <Card key={cat.key} className="feature-category">
              <div className="feature-category-heading">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cat.iconBg} ${cat.iconColor}`}
                >
                  <Icon size={14} />
                </div>
                <span
                  className={`font-sans text-xs font-semibold ${cat.labelColor}`}
                >
                  {cat.label}
                </span>
              </div>
              <div className="flex flex-col">
                {items.map((item, i) => (
                  <div key={i} className="feature-item">
                    <span
                      className={`font-bold select-none mr-1 opacity-60 group-hover:opacity-100 ${cat.iconColor}`}
                    >
                      +
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Schema ─────────────────────────────────────────────────

export function SchemaPanel({ blueprint }: { blueprint: Blueprint }) {
  const [activeTab, setActiveTab] = useState<
    "visual" | "sql" | "prisma" | "mongoose"
  >("visual");
  const [copied, setCopied] = useState(false);

  const isMongo = (blueprint.architecture?.database || "")
    .toLowerCase()
    .includes("mongo");
  const schemaItems = blueprint.schema || [];
  const entityLabel = isMongo ? "collections" : "tables";

  const getSqlSchema = () => {
    if (blueprint.code?.sql && blueprint.code.sql.trim())
      return blueprint.code.sql.trim();
    let sql = "";
    for (const table of schemaItems) {
      sql += `CREATE TABLE ${table.table} (\n`;
      const cols = table.columns || [];
      const colLines = cols.map((col) => {
        return `  ${col.name} ${col.type}${col.note ? ` /* ${col.note} */` : ""}`;
      });
      sql += colLines.join(",\n");
      sql += `\n);\n\n`;
    }
    return sql || "-- No SQL schema defined";
  };

  const getPrismaSchema = () => {
    const provider = isMongo ? "mongodb" : "postgresql";
    let schema = `// Prisma schema generated by BuildX\n\ngenerator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}\n`;

    for (const table of schemaItems) {
      const modelName = toPascalCase(table.table);
      schema += `\nmodel ${modelName} {\n`;

      const cols = table.columns || [];
      for (const col of cols) {
        const fieldName = toCamelCase(col.name);
        let prismaType = sqlTypeToPrisma(col.type, isMongo);

        const isPk =
          (col.type + " " + (col.note || ""))
            .toUpperCase()
            .includes("PRIMARY KEY") ||
          (col.type + " " + (col.note || "")).toUpperCase().includes("PK");
        if (isPk) {
          if (isMongo) {
            prismaType = 'String @id @default(auto()) @map("_id") @db.ObjectId';
          } else {
            prismaType = prismaType.includes("@default")
              ? prismaType + " @id"
              : prismaType + " @id @default(autoincrement())";
          }
        }

        if (col.type.toUpperCase().includes("UNIQUE")) {
          prismaType += " @unique";
        }

        const isRequired = col.type.toUpperCase().includes("NOT NULL") || isPk;
        const typeStr = isRequired ? prismaType : prismaType + "?";

        if (
          col.type.toUpperCase().includes("DEFAULT NOW()") ||
          col.type.toUpperCase().includes("DEFAULT CURRENT_TIMESTAMP")
        ) {
          schema += `  ${fieldName.padEnd(20)} DateTime  @default(now())\n`;
        } else {
          schema += `  ${fieldName.padEnd(20)} ${typeStr}\n`;
        }
      }
      schema += "}\n";
    }
    return schema;
  };

  const getMongooseSchema = () => {
    let out = `// Mongoose models generated by BuildX\nconst mongoose = require('mongoose');\nconst { Schema } = mongoose;\n`;

    for (const table of schemaItems) {
      const modelName = toPascalCase(table.table);
      out += `\nconst ${toCamelCase(table.table)}Schema = new Schema({\n`;
      const cols = table.columns || [];
      const fields = cols
        .filter(
          (col) =>
            col.name.toLowerCase() !== "id" && col.name.toLowerCase() !== "_id",
        )
        .map((col) => {
          const fieldName = toCamelCase(col.name);
          const mType = sqlTypeToMongoose(col.type);
          const required = col.type.toUpperCase().includes("NOT NULL");
          const unique = col.type.toUpperCase().includes("UNIQUE");
          const opts: string[] = [`type: ${mType}`];
          if (required) opts.push("required: true");
          if (unique) opts.push("unique: true");
          return `  ${fieldName}: { ${opts.join(", ")} }`;
        });
      out += fields.join(",\n");
      out += `\n}, { timestamps: true });\n`;
      out += `const ${modelName} = mongoose.model('${modelName}', ${toCamelCase(table.table)}Schema);\n`;
    }

    if (schemaItems.length > 0) {
      const exportNames = schemaItems.map((t) => toPascalCase(t.table));
      out += `\nmodule.exports = { ${exportNames.join(", ")} };\n`;
    }
    return out;
  };

  const activeContent =
    activeTab === "sql"
      ? getSqlSchema()
      : activeTab === "prisma"
        ? getPrismaSchema()
        : activeTab === "mongoose"
          ? getMongooseSchema()
          : "";

  const handleCopy = () => {
    void navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext =
      activeTab === "sql" ? "sql" : activeTab === "prisma" ? "prisma" : "js";
    const blob = new Blob([activeContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `schema.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="schema-panel-heading">
        <SectionLabel>
          // database schema · {schemaItems.length} {entityLabel}
        </SectionLabel>

        {/* Tab switcher */}
        <div
          className="flex rounded-xl p-0.5 overflow-x-auto"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {(
            [
              { id: "visual", label: "Visual Cards" },
              { id: "sql", label: "SQL" },
              { id: "prisma", label: "Prisma" },
              { id: "mongoose", label: "Mongoose" },
            ] as const
          ).map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setActiveTab(tabItem.id)}
              aria-pressed={activeTab === tabItem.id}
              className="px-3 py-1.5 rounded-lg font-sans text-[10px] font-medium transition-all duration-150 tracking-tight"
              style={{
                background:
                  activeTab === tabItem.id
                    ? "var(--accent-glow)"
                    : "transparent",
                color:
                  activeTab === tabItem.id ? "var(--accent2)" : "var(--text3)",
              }}
            >
              {tabItem.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "visual" && !schemaItems.length && (
        <p className="panel-empty">No data model defined in this blueprint.</p>
      )}
      {activeTab === "visual" ? (
        <div className="blueprint-card-grid schema-grid">
          {schemaItems.map((table) => {
            const cols = table.columns || [];
            return (
              <SpotlightCard
                key={table.table}
                className="schema-definition"
                spotlightColor="rgba(124, 124, 244, 0.10)"
              >
                <div className="schema-definition-heading">
                  <Database size={16} aria-hidden="true" />
                  <h3>{table.table}</h3>
                  <span>{cols.length} {isMongo ? "fields" : "columns"}</span>
                </div>

                {/* Columns */}
                <div style={{ background: "var(--surface)" }}>
                  {cols.length === 0 ? (
                    <div
                      className="px-5 py-4 text-xs font-sans tracking-tight"
                      style={{ color: "var(--text3)" }}
                    >
                      No fields defined
                    </div>
                  ) : (
                    cols.map((col) => (
                      <div key={col.name} className="schema-definition-row">
                        <span className="schema-field-label">{col.name}</span>
                        <span className="schema-field-type">{col.type}</span>
                        {col.note && <span className="schema-field-note">{col.note}</span>}
                      </div>
                    ))
                  )}
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-4 py-2 border-b"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface2)",
            }}
          >
            <span
              className="font-mono text-[10px] tracking-tight"
              style={{ color: "var(--text3)" }}
            >
              schema.
              {activeTab === "sql"
                ? "sql"
                : activeTab === "prisma"
                  ? "prisma"
                  : "js"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 rounded-md text-[10px] font-sans border transition-colors animate-fade-in tracking-tight"
                style={{
                  borderColor: "var(--border2)",
                  background: "var(--surface)",
                  color: "var(--text2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border2)";
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                className="px-2.5 py-1 rounded-md text-[10px] font-sans border transition-colors tracking-tight"
                style={{
                  borderColor: "var(--border2)",
                  background: "var(--surface)",
                  color: "var(--text2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border2)";
                }}
              >
                Download
              </button>
            </div>
          </div>

          {/* Code Viewer */}
          <pre
            className="p-5 font-mono text-xs overflow-x-auto text-[var(--text2)] max-h-[500px] leading-relaxed select-text"
            style={{ background: "var(--surface)" }}
          >
            <code>{activeContent}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── API Endpoints ───────────────────────────────────────────

export function ApiPanel({ blueprint }: { blueprint: Blueprint }) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("ALL");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResponse, setSandboxResponse] = useState<string | null>(null);
  const [consoleTab, setConsoleTab] = useState<"headers" | "body">("headers");

  const requestTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    setSandboxLoading(false);
    setSandboxResponse(null);
    return () => clearTimeout(requestTimer.current);
  }, [selectedIdx]);

  const triggerSandboxTest = (method: string, path: string) => {
    setSandboxLoading(true);
    setSandboxResponse(null);

    // Simulate endpoint request delay. Changing routes cancels the prior result.
    clearTimeout(requestTimer.current);
    requestTimer.current = setTimeout(() => {
      setSandboxLoading(false);

      // Generate realistic mock response payloads
      const lowerPath = path.toLowerCase();
      let payload: any = { success: true };

      if (lowerPath.includes("login") || lowerPath.includes("signup")) {
        payload = {
          success: true,
          token:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjMmI4ZDNhNC1mNTlhLTRmMDItYmVmMC0xNmZkNDBlNTVjOGEiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE3MTU5Nzg4MDB9.s7zD_...",
          user: {
            id: "c2b8d3a4-f59a-4f02-bef0-16fd40e55c8a",
            email: "user@example.com",
            role: "user",
            created_at: new Date().toISOString(),
          },
        };
      } else if (lowerPath.includes("profile") || lowerPath.includes("me")) {
        payload = {
          id: "c2b8d3a4-f59a-4f02-bef0-16fd40e55c8a",
          email: "user@example.com",
          profile: {
            first_name: "John",
            last_name: "Doe",
            avatar_url:
              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80",
          },
        };
      } else if (
        lowerPath.includes("product") ||
        lowerPath.includes("item") ||
        lowerPath.includes("list")
      ) {
        payload = {
          items: [
            {
              id: "p1",
              title: "Premium Leather Jacket",
              price: 129.99,
              rating: 4.8,
              in_stock: true,
            },
            {
              id: "p2",
              title: "Vintage Leather Boots",
              price: 89.5,
              rating: 4.5,
              in_stock: true,
            },
            {
              id: "p3",
              title: "Minimalist Leather Belt",
              price: 34.0,
              rating: 4.2,
              in_stock: false,
            },
          ],
          total_count: 3,
        };
      } else if (method === "POST") {
        payload = {
          success: true,
          message: "Resource successfully created in workspace",
          id: Math.random().toString(36).substring(2, 11),
          timestamp: new Date().toISOString(),
        };
      } else if (method === "DELETE") {
        payload = {
          success: true,
          message: "Resource successfully deleted from workspace",
        };
      } else {
        payload = {
          success: true,
          data: {
            status: "ready",
            updated_at: new Date().toISOString(),
          },
        };
      }

      setSandboxResponse(JSON.stringify(payload, null, 2));
    }, 600);
  };

  const getMockRequestBody = (method: string, path: string) => {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes("login") || lowerPath.includes("signin")) {
      return JSON.stringify(
        { email: "user@example.com", password: "••••••••" },
        null,
        2,
      );
    }
    if (lowerPath.includes("signup") || lowerPath.includes("register")) {
      return JSON.stringify(
        { name: "John Doe", email: "user@example.com", password: "••••••••" },
        null,
        2,
      );
    }
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      return JSON.stringify(
        {
          name: "Premium Leather Jacket",
          price: 129.99,
          rating: 4.8,
          in_stock: true,
        },
        null,
        2,
      );
    }
    return JSON.stringify({}, null, 2);
  };

  const selectedEndpoint =
    selectedIdx !== null ? (blueprint.endpoints || [])[selectedIdx] : null;

  return (
    <div className="api-explorer">
      {/* Endpoints List */}
      <div className="api-routes">
        <SectionLabel>
          // api endpoints · {(blueprint.endpoints || []).length} routes
        </SectionLabel>
        <div className="api-filter-bar">
          <label>
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Search endpoints"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search routes or descriptions"
            />
          </label>
          <select
            aria-label="Filter by HTTP method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="ALL">All methods</option>
            {Array.from(
              new Set((blueprint.endpoints || []).map((ep) => ep.method)),
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="api-endpoint-list" aria-label="Endpoint routes">
          {(blueprint.endpoints || []).map((ep, i) => {
            if (
              (method !== "ALL" && ep.method !== method) ||
              !`${ep.path} ${ep.description}`
                .toLowerCase()
                .includes(query.toLowerCase())
            )
              return null;
            const isSelected = selectedIdx === i;
            return (
              <button
                key={`${ep.method}-${ep.path}-${i}`}
                type="button"
                onClick={() => {
                  setSelectedIdx(i);
                  setSandboxResponse(null);
                }}
                aria-pressed={isSelected}
                className={`api-endpoint-card ${isSelected ? "api-endpoint-card--selected" : ""}`}
              >
                <span
                  className={`api-endpoint-card__method ${methodClass(ep.method)}`}
                >
                  {ep.method}
                </span>
                <div className="api-endpoint-card__body">
                  <span className="api-endpoint-card__path">{ep.path}</span>
                  <span className="api-endpoint-card__desc">
                    {ep.description}
                    {ep.auth && (
                      <span className="api-endpoint-card__auth">
                        auth required
                      </span>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
          {!(blueprint.endpoints || []).some(
            (ep) =>
              (method === "ALL" || ep.method === method) &&
              `${ep.path} ${ep.description}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          ) && (
            <p className="panel-empty">
              {blueprint.endpoints?.length
                ? "No routes match your filters."
                : "No endpoints defined in this blueprint."}
            </p>
          )}
        </div>
      </div>

      {/* Sandbox console */}
      <div className="api-inspector">
        <SectionLabel>// endpoint inspector</SectionLabel>
        {selectedEndpoint ? (
          <SpotlightCard
            fillHeight
            className="api-sandbox-card api-sandbox-card--active"
            spotlightColor="rgba(20, 184, 166, 0.1)"
          >
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/10">
              <span
                className="font-mono text-xs font-semibold flex items-center gap-1.5"
                style={{ color: "var(--text)" }}
              >
                <Terminal size={13} className="text-purple-400" />
                Mock request console
              </span>
              <span className="text-[9px] font-sans text-green-400 bg-green-500/10 border border-green-500/25 px-1.5 py-0.5 rounded tracking-tight">
                SIMULATED
              </span>
            </div>

            {/* Request input bar */}
            <div
              className="flex items-center gap-2 p-2.5 rounded-lg bg-bg-surface2 border border-white/10 mb-3 text-xs font-mono"
              style={{ color: "var(--text)" }}
            >
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${methodClass(selectedEndpoint.method)}`}
              >
                {selectedEndpoint.method}
              </span>
              <span className="break-all font-mono leading-snug">
                {selectedEndpoint.path}
              </span>
            </div>

            {/* Parameter Selection Tabs */}
            <div className="flex border-b border-white/10 mb-3 text-[10px] font-sans">
              <button
                type="button"
                onClick={() => setConsoleTab("headers")}
                aria-pressed={consoleTab === "headers"}
                className={`pb-1.5 px-3 border-b-2 transition-all ${
                  consoleTab === "headers"
                    ? "border-purple-500 text-purple-300"
                    : "border-transparent"
                }`}
                style={
                  consoleTab !== "headers"
                    ? { color: "var(--text2)" }
                    : undefined
                }
              >
                Headers
              </button>
              <button
                type="button"
                onClick={() => setConsoleTab("body")}
                aria-pressed={consoleTab === "body"}
                className={`pb-1.5 px-3 border-b-2 transition-all ${
                  consoleTab === "body"
                    ? "border-purple-500 text-purple-300"
                    : "border-transparent"
                }`}
                style={
                  consoleTab !== "body" ? { color: "var(--text2)" } : undefined
                }
              >
                Body Params
              </button>
            </div>

            {/* Parameter panels */}
            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-1 min-h-0">
              {consoleTab === "headers" ? (
                <div
                  className="p-2.5 rounded-lg bg-bg-surface2 border border-white/10 space-y-1.5 font-mono text-xs"
                  style={{ color: "var(--text2)" }}
                >
                  <div className="flex justify-between gap-3">
                    <span style={{ color: "var(--text)" }}>Content-Type</span>
                    <span>application/json</span>
                  </div>
                  {selectedEndpoint.auth && (
                    <div className="flex justify-between gap-3">
                      <span style={{ color: "var(--text)" }}>
                        Authorization
                      </span>
                      <span className="text-amber-300 break-all">
                        Bearer eyJhbGciOiJIUzI1NiIsInR5c...
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="p-2.5 rounded-lg bg-black/50 border border-white/10 text-purple-200 overflow-x-auto text-[11px] font-mono leading-normal max-h-[120px] scrollbar-none">
                  {getMockRequestBody(
                    selectedEndpoint.method,
                    selectedEndpoint.path,
                  )}
                </pre>
              )}

              {/* Action Trigger Button */}
              <button
                onClick={() =>
                  triggerSandboxTest(
                    selectedEndpoint.method,
                    selectedEndpoint.path,
                  )
                }
                disabled={sandboxLoading}
                className="ui-button ui-button--primary api-send-button"
              >
                {sandboxLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin-slow" />
                    Executing Request...
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    Send Mock Request
                  </>
                )}
              </button>

              {/* Response window with full metadata badges */}
              {(sandboxResponse || sandboxLoading) && (
                <div className="space-y-1.5">
                  <div
                    className="flex items-center justify-between text-[10px] uppercase tracking-wider font-sans"
                    style={{ color: "var(--text2)" }}
                  >
                    <span>Response Payload</span>
                    {!sandboxLoading && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-bold bg-green-500/5 px-1 py-0.5 rounded border border-green-500/10">
                          200 OK
                        </span>
                        <span className="text-blue-400 bg-blue-500/5 px-1 py-0.5 rounded border border-blue-500/10">
                          14ms
                        </span>
                      </div>
                    )}
                  </div>
                  <pre className="p-2.5 rounded-lg bg-black/60 border border-white/10 text-green-400 text-[11px] font-mono overflow-auto max-h-[140px] scrollbar-thin leading-relaxed">
                    {sandboxLoading ? (
                      <span style={{ color: "var(--text2)" }}>
                        Waiting for response from simulator...
                      </span>
                    ) : (
                      sandboxResponse
                    )}
                  </pre>
                </div>
              )}
            </div>
          </SpotlightCard>
        ) : (
          <SpotlightCard
            fillHeight
            className="api-sandbox-card api-sandbox-card--empty"
            spotlightColor="rgba(20, 184, 166, 0.05)"
          >
            <Terminal size={28} className="mb-3 text-purple-400/80" />
            <p
              className="text-sm leading-relaxed max-w-[16rem] font-sans"
              style={{ color: "var(--text2)" }}
            >
              Select a route to inspect its contract, run a simulated request,
              and explore response JSON objects.
            </p>
          </SpotlightCard>
        )}
      </div>
    </div>
  );
}

// ─── UI Screens ──────────────────────────────────────────────

export function UiPanel({ blueprint }: { blueprint: Blueprint }) {
  return (
    <div>
      <SectionLabel>
        // ui screens · {(blueprint.screens || []).length} screens
      </SectionLabel>
      <div className="screen-definition-grid">
        {(blueprint.screens || []).map((screen, index) => (
          <Card key={`${screen.name}-${index}`} className="screen-definition">
            <div className="screen-definition-heading">
              <span className="panel-icon">{emojiToIcon(screen.icon, 18)}</span>
              <span>Screen {String(index + 1).padStart(2, "0")}</span>
            </div>
            <h3>{screen.name}</h3>
            <p>Interface components</p>
            <ul>
              {screen.components
                .split(",")
                .filter((c) => c.trim())
                .map((c, i) => (
                  <li key={i}>{c.trim()}</li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
      {!blueprint.screens?.length && (
        <p className="panel-empty">No screen definitions in this blueprint.</p>
      )}
    </div>
  );
}

// ─── Architecture ────────────────────────────────────────────

export function ArchPanel({ blueprint }: { blueprint: Blueprint }) {
  const architecture = blueprint.architecture || {};
  if (!Object.values(architecture).some(Boolean))
    return (
      <div>
        <SectionLabel>// architecture</SectionLabel>
        <p className="panel-empty">
          No architecture defined in this blueprint.
        </p>
      </div>
    );
  const layers = [
    { label: "Frontend", value: architecture.frontend || "Not specified" },
    { label: "Backend", value: architecture.backend || "Not specified" },
    { label: "Database", value: architecture.database || "Not specified" },
    { label: "Auth", value: architecture.auth || "Not specified" },
    { label: "Hosting", value: architecture.hosting || "Not specified" },
  ];
  const flowSteps = resolveFlowSteps(architecture.flow || "", {
    frontend: architecture.frontend || "",
    backend: architecture.backend || "",
    database: architecture.database || "",
  });

  return (
    <div>
      <SectionLabel>// architecture</SectionLabel>

      {/* Tech stack grid */}
      <div className="architecture-layers">
        {layers.map(({ label, value }) => (
          <SpotlightCard
            key={label}
            className="p-4"
            spotlightColor="rgba(15, 118, 110, 0.12)"
          >
            <div
              className="font-sans text-[10px] uppercase tracking-widest mb-2"
              style={{ color: "var(--text2)" }}
            >
              {label}
            </div>
            <div
              className="text-sm font-medium leading-snug font-sans"
              style={{ color: "var(--text)" }}
            >
              {value}
            </div>
          </SpotlightCard>
        ))}
      </div>

      {/* Request flow */}
      <Card>
        <SectionLabel>// request flow</SectionLabel>

        <div className="arch-flow-track">
          <div className="arch-flow-row">
            {flowSteps.map((step, i) => (
              <React.Fragment key={`${step}-${i}`}>
                <div className="arch-flow-step">
                  <div className="arch-flow-step__index">0{i + 1}</div>
                  <div className="arch-flow-step__role">
                    {flowStepRole(i, flowSteps.length)}
                  </div>
                  <div className="arch-flow-step__title">{step}</div>
                </div>

                {i < flowSteps.length - 1 && (
                  <div className="arch-flow-connector" aria-hidden>
                    <svg
                      width="48"
                      height="24"
                      viewBox="0 0 48 24"
                      fill="none"
                      className="arch-flow-connector__svg"
                    >
                      <path
                        d="M0 12h40"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0 12h40"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="arch-flow-signal"
                      />
                      <polygon points="38,8 48,12 38,16" fill="currentColor" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Starter Code ────────────────────────────────────────────

export function CodePanel({
  blueprint,
  blueprintId,
  blueprintContentKey,
  onRefineMessage,
  isRefining,
  codegen,
}: {
  blueprint: Blueprint;
  blueprintId: string | null;
  blueprintContentKey?: string;
  onRefineMessage?: (msg: string) => void;
  isRefining?: boolean;
  codegen: any;
}) {
  return (
    <div>
      <CodeStudio
        blueprint={blueprint}
        blueprintId={blueprintId}
        blueprintContentKey={blueprintContentKey}
        onRefineMessage={onRefineMessage}
        isRefining={isRefining}
        codegen={codegen}
      />
    </div>
  );
}

// ─── Effort ──────────────────────────────────────────────────

export function EffortPanel({ blueprint }: { blueprint: Blueprint }) {
  const effort = blueprint.effort || {};
  const complexity = blueprint.complexity || "Not estimated";
  const complexityText = effort.complexity || blueprint.complexity || "Not estimated";
  const complexityDetail = complexityText.length > 48 ? complexityText : null;
  const cards = [
    {
      label: "Timeline",
      value: effort.time || "Not estimated",
      icon: Calendar,
      color: "text-purple-400",
    },
    {
      label: "Complexity",
      value: complexityDetail ? (blueprint.complexity || "See details") : complexityText,
      icon: Zap,
      color: "text-amber-400",
    },
    {
      label: "Est. Cost",
      value: effort.cost || "N/A",
      icon: DollarSign,
      color: "text-green-400",
    },
    {
      label: "Team Size",
      value: effort.team || "Not estimated",
      icon: Users,
      color: "text-blue-400",
    },
  ];

  const milestones = [
    {
      phase: "Define the foundations",
      desc: "Review the architecture, data model, and environment requirements.",
    },
    {
      phase: "Build the core behaviour",
      desc: "Implement authentication and the project’s essential API contracts.",
    },
    {
      phase: "Connect the interface",
      desc: "Develop the screen definitions and connect them to the application data.",
    },
    {
      phase: "Validate and release",
      desc: "Test critical workflows, accessibility, and deployment configuration.",
    },
  ];

  return (
    <div className="space-y-6">
      <SectionLabel>// effort estimation & timeline planning</SectionLabel>

      {/* Complexity badge */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-full border font-medium ${complexityColor(complexity)}`}
        >
          <span>System Complexity:</span>
          <strong>{complexity}</strong>
        </span>
      </div>

      {/* Effort metrics grid */}
      <div className="blueprint-card-grid effort-metrics">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <SpotlightCard
            key={label}
            className="effort-metric"
            spotlightColor="rgba(124, 124, 244, 0.10)"
          >
            <div className="font-sans text-[10px] uppercase tracking-widest mb-2.5 flex items-center gap-1.5 text-muted-foreground">
              <Icon size={14} className={color} />
              <span>{label}</span>
            </div>
            <div
              className={`effort-metric-value${value.length > 48 ? " effort-metric-value--long" : ""}`}
            >
              {value}
            </div>
          </SpotlightCard>
        ))}
      </div>

      {complexityDetail && (
        <p className="effort-complexity-detail"><strong>Complexity notes</strong>{complexityDetail}</p>
      )}

      <Card>
        <SectionLabel>// suggested implementation sequence</SectionLabel>
        <p className="panel-description">
          A planning guide, not tracked project progress. Use the estimates
          above to scope each phase.
        </p>
        <ol className="effort-sequence">
          {milestones.map((item, index) => (
            <li key={item.phase}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{item.phase}</h3>
                <p>{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

// ─── Helpers for Schema Code Generation ─────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[\s_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function sqlTypeToPrisma(sqlType: string, isMongo: boolean): string {
  const t = sqlType.toUpperCase();
  if (t.includes("UUID")) return isMongo ? "String" : "String @default(uuid())";
  if (t.includes("SERIAL") || t.includes("BIGSERIAL"))
    return isMongo ? "Int" : "Int @default(autoincrement())";
  if (t.includes("INT")) return "Int";
  if (
    t.includes("FLOAT") ||
    t.includes("DOUBLE") ||
    t.includes("DECIMAL") ||
    t.includes("NUMERIC")
  )
    return "Float";
  if (t.includes("BOOL")) return "Boolean";
  if (t.includes("TIMESTAMP") || t.includes("DATE")) return "DateTime";
  if (t.includes("JSON")) return "Json";
  return "String";
}

function sqlTypeToMongoose(sqlType: string): string {
  const t = sqlType.toUpperCase();
  if (
    t.includes("INT") ||
    t.includes("SERIAL") ||
    t.includes("FLOAT") ||
    t.includes("DOUBLE") ||
    t.includes("DECIMAL") ||
    t.includes("NUMERIC")
  )
    return "Number";
  if (t.includes("BOOL")) return "Boolean";
  if (t.includes("TIMESTAMP") || t.includes("DATE")) return "Date";
  if (t.includes("JSON")) return "Object";
  return "String";
}
