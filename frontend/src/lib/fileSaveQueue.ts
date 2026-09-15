export type SaveState = "pending" | "saving" | "saved" | "error";
/** Serial writes per file prevent an older response from overwriting a newer edit. */
export class FileSaveQueue {
  private entries = new Map<
    string,
    {
      content: string;
      revision: number;
      saved: number;
      running: boolean;
      timer?: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(
    private write: (path: string, content: string) => Promise<void>,
    private notify: (path: string, state: SaveState) => void,
    private delay = 400,
  ) {}
  schedule(path: string, content: string) {
    const entry = this.entries.get(path) ?? {
      content,
      revision: 0,
      saved: 0,
      running: false,
    };
    entry.content = content;
    entry.revision++;
    clearTimeout(entry.timer);
    this.entries.set(path, entry);
    this.notify(path, "pending");
    entry.timer = setTimeout(() => void this.flush(path), this.delay);
  }
  async flush(path: string): Promise<void> {
    const entry = this.entries.get(path);
    if (!entry || entry.running || entry.saved === entry.revision) return;
    clearTimeout(entry.timer);
    entry.running = true;
    while (entry.saved !== entry.revision) {
      const revision = entry.revision;
      const content = entry.content;
      this.notify(path, "saving");
      try {
        await this.write(path, content);
        entry.saved = revision;
      } catch {
        this.notify(path, "error");
        entry.running = false;
        return;
      }
    }
    clearTimeout(entry.timer);
    entry.running = false;
    this.notify(path, "saved");
  }
  hasUnsaved() {
    return [...this.entries.values()].some(
      (entry) => entry.saved !== entry.revision,
    );
  }
  flushAll() {
    return Promise.all(
      [...this.entries.keys()].map((path) => this.flush(path)),
    );
  }
}
