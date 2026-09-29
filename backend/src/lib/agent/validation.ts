import ts from "typescript";
import { createHash } from "crypto";

export function isWorkspacePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.startsWith("/") &&
    !/[\\\0:]/.test(value) &&
    !value
      .split("/")
      .some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          ["__proto__", "prototype", "constructor"].includes(part),
      )
  );
}

export function revision(files: Record<string, string>): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
    .digest("hex");
}

export function validateFile(path: string, content: string): string[] {
  if (!isWorkspacePath(path)) return ["Invalid workspace path"];
  if (content.length > 2_000_000) return ["File exceeds size limit"];
  if (path.endsWith(".json")) {
    try {
      JSON.parse(content);
      return [];
    } catch (error) {
      return [String(error)];
    }
  }
  if (/\.[cm]?[jt]sx?$/.test(path)) {
    const kind = /\.tsx$/.test(path)
      ? ts.ScriptKind.TSX
      : /\.jsx$/.test(path)
        ? ts.ScriptKind.JSX
        : /\.[cm]?js$/.test(path)
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
    const source = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      true,
      kind,
    );
    const diagnostics = (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics;
    return diagnostics.map(
      (d) =>
        `${path}:${source.getLineAndCharacterOfPosition(d.start || 0).line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`,
    );
  }
  return [];
}
