import type { Blueprint } from "../../lib/types";

/** Illustrative fixture using the same artifact schema as the working product. */
export const demoBlueprint = {
  appName: "Linkspace",
  description: "Short links. A clearer picture.",
  targetUsers: "Creators and small teams sharing links",
  complexity: "Low",
  features: {
    authentication: ["Sign in securely", "Keep links private to their owner"],
    core: [
      "Create a short link",
      "Organize saved links",
      "Explore click analytics",
    ],
    admin: [],
    optional: ["Custom link aliases"],
  },
  schema: [
    {
      table: "users",
      columns: [
        { name: "id", type: "uuid", note: "Primary key" },
        { name: "email", type: "text" },
        { name: "created_at", type: "timestamp" },
      ],
    },
    {
      table: "links",
      columns: [
        { name: "id", type: "uuid", note: "Primary key" },
        { name: "user_id", type: "uuid", note: "users.id" },
        { name: "slug", type: "text" },
        { name: "target_url", type: "text" },
      ],
    },
    {
      table: "clicks",
      columns: [
        { name: "id", type: "uuid", note: "Primary key" },
        { name: "link_id", type: "uuid", note: "links.id" },
        { name: "created_at", type: "timestamp" },
      ],
    },
  ],
  endpoints: [
    { method: "POST", path: "/api/auth/login", description: "Start a session" },
    {
      method: "GET",
      path: "/api/links",
      description: "List your saved links",
      auth: true,
    },
    {
      method: "POST",
      path: "/api/links",
      description: "Create a short link",
      auth: true,
    },
    {
      method: "DELETE",
      path: "/api/links/:id",
      description: "Remove a saved link",
      auth: true,
    },
    {
      method: "GET",
      path: "/api/links/:id/clicks",
      description: "Read click analytics",
      auth: true,
    },
    { method: "GET", path: "/:slug", description: "Resolve a short link" },
  ],
  screens: [
    {
      name: "Sign in",
      icon: "lock",
      components: "Email field, password field, session feedback",
    },
    {
      name: "Your links",
      icon: "link",
      components: "Link composer, saved links, copy action",
    },
    {
      name: "Link analytics",
      icon: "chart",
      components: "Click totals, daily activity, link details",
    },
  ],
  architecture: {
    frontend: "React",
    backend: "Express",
    database: "PostgreSQL",
    auth: "JWT",
    hosting: "Your infrastructure",
    flow: "React → Express API → PostgreSQL",
  },
  code: {
    frontend: "",
    backend: "",
    sql: "",
    files: {
      "src/pages/Links.tsx":
        "export function Links() {\n  const { links, createLink } = useLinks();\n\n  return (\n    <main>\n      <LinkComposer onCreate={createLink} />\n      <LinkList links={links} />\n    </main>\n  );\n}",
      "server/routes/links.ts":
        "router.get('/api/links', requireAuth, async (req, res) => {\n  const links = await db.links.findMany({\n    where: { userId: req.user.id },\n  });\n  res.json(links);\n});",
      "db/schema.sql":
        "CREATE TABLE links (\n  id UUID PRIMARY KEY,\n  user_id UUID REFERENCES users(id),\n  slug TEXT UNIQUE NOT NULL,\n  target_url TEXT NOT NULL\n);",
    },
  },
  effort: {
    time: "Scope dependent",
    complexity: "Low",
    cost: "Provider dependent",
    team: "One developer",
  },
} satisfies Blueprint;
export const demoIdea =
  "A URL shortener with sign-in, saved links, and click analytics.";
export const DEMO_DURATIONS = [2600, 3200, 3200, 3000, 3200, 2800, 2200, 0];
