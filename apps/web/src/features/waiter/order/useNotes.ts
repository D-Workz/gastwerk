/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { useRef, useState } from "react";
import type { Line } from "../../../../../../packages/contracts/src/index";
import type { Mutate } from "../../../shared/api/api";

/* --- Public API --- */


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
  /**
   * publish - brief description
   * @param ) -
   * @returns
   */
  const publish = () => render((v) => v + 1);

  /**

   * edit - brief description

   * @param line -

   * @param text -

   * @returns

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

   * save - brief description

   * @param id -

   * @returns

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

   * flush - brief description

   * @returns

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

   * review - brief description

   * @param line -

   * @returns

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

   * discard - brief description

   * @param id -

   * @returns

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
