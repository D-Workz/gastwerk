/**
 * Note state shared across the waiter workspace. Service owns this hook and
 * passes it to Order/InlineNote; it retains edits outside the line renderer and
 * coordinates revision-bearing saves and explicit flushes through Mutate.
 */
import { useRef, useState } from "react";
import type { Line } from "../../../../../../packages/contracts/src/index";
import type { Mutate } from "../../../shared/api/api";

type Note = {
  text: string;
  version: number;
  input: Line["input"];
  status: "dirty" | "saving" | "error";
  state: Line["state"];
};

/** Keep failed text outside the line view. Flush explicitly before sending or leaving. */
export function useNotes(mutate: Mutate) {
  const entries = useRef<Record<string, Note>>({});
  const inFlight = useRef<Record<string, Promise<boolean>>>({});
  const [, render] = useState(0);

  const publish = () => render((v) => v + 1);

  /**
   * Keep the revision and input from the first edit until save or explicit review.
   */
  function edit(line: Line, text: string) {
    const previous = entries.current[line.id];
    entries.current[line.id] = {
      ...(previous ?? {
        version: line.version,
        input: line.input,
        state: line.state,
      }),
      text,
      status: "dirty",
    };
    publish();
  }

  /**
   * Share in-flight work for this line. On success, remove only the text that was
   * sent; retain later edits with the next expected revision.
   */
  function save(id: string): Promise<boolean> {
    if (inFlight.current[id]) return inFlight.current[id];
    const entry = entries.current[id];
    if (!entry) return Promise.resolve(true);
    entry.status = "saving";
    publish();
    const text = entry.text;
    const work = mutate(`/lines/${id}/edit`, {
      version: entry.version,
      input: { ...entry.input, note: text },
    })
      .then((ok) => {
        if (ok && entries.current[id]?.text === text)
          delete entries.current[id];
        else if (ok)
          entries.current[id] = {
            ...entries.current[id]!,
            version: entry.version + 1,
            status: "dirty",
          };
        else entries.current[id]!.status = "error";
        return ok;
      })
      .finally(() => {
        delete inFlight.current[id];
        publish();
      });
    inFlight.current[id] = work;
    return work;
  }

  /**
   * Save pending drafts before navigation or sending. Return false for a submitted
   * note or failed save so the caller can keep the workspace open.
   */
  async function flush(): Promise<boolean> {
    for (const id of Object.keys(entries.current)) {
      // Submitted notes require the explicit amendment button, never navigation.
      if (entries.current[id]?.state !== "draft") return false;
      if (!(await save(id))) return false;
      if (entries.current[id] && !(await save(id))) return false;
    }
    return true;
  }

  /**
   * Rebase a failed note onto the displayed line after the user requests review.
   */
  function review(line: Line) {
    const entry = entries.current[line.id];
    if (entry && entry.status === "error") {
      entries.current[line.id] = {
        ...entry,
        version: line.version,
        input: line.input,
        state: line.state,
        status: "dirty",
      };
      publish();
    }
  }

  /**
   * Discard retained text only when no save for this line is in flight.
   */
  function discard(id: string) {
    if (inFlight.current[id]) return;
    delete entries.current[id];
    publish();
  }

  return {
    discard,
    review,
    entries: entries.current,
    edit,
    save,
    flush,
    hasPending: () => Object.keys(entries.current).length > 0,
  };
}

export type Notes = ReturnType<typeof useNotes>;
