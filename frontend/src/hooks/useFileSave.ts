import { useEffect, useMemo, useRef, useState } from "react";
import { FileSaveQueue, type SaveState } from "../lib/fileSaveQueue";
export function useFileSave(
  projectId: string | undefined,
  write: (id: string, path: string, content: string) => Promise<void>,
) {
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const writer = useRef(write);
  writer.current = write;
  const queue = useMemo(
    () =>
      new FileSaveQueue(
        async (path, content) => {
          if (!projectId) throw new Error("No project selected");
          await writer.current(projectId, path, content);
        },
        (path, state) => setStates((prev) => ({ ...prev, [path]: state })),
      ),
    [projectId],
  );
  useEffect(() => {
    setStates({});
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.hasUnsaved()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      void queue.flushAll();
    };
  }, [queue]);
  return {
    states,
    schedule: (path: string, content: string) => queue.schedule(path, content),
    retry: (path: string) => void queue.flush(path),
  };
}
