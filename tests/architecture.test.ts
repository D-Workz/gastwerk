/* @copilot-fully-annotated */
/*
 * @copilot-annotated
 * Brief: Top-level documentation added by Copilot CLI.
 * This file was annotated with a file header and lightweight JSDoc for exported symbols.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { expect, it } from "vitest";

const root = resolve("apps/web/src");

/**

 * files - brief description

 * @param directory -

 * @returns

 */

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(directory, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [resolve(directory, entry.name)]
        : [],
  );
}

it("keeps frontend imports acyclic and shared modules independent of features", () => {
  const graph = new Map<string, string[]>();
  for (const file of files(root)) {
    const dependencies = [
      ...readFileSync(file, "utf8").matchAll(/from\s+["'](\.[^"']+)["']/g),
    ]
      .map((match) => {
        const base = resolve(dirname(file), match[1]!);
        return [base + ".ts", base + ".tsx", resolve(base, "index.ts")].find(
          existsSync,
        );
      })
      .filter((path): path is string => Boolean(path?.startsWith(root)));
    graph.set(file, dependencies);
    if (relative(root, file).startsWith("shared/"))
      expect(
        dependencies.every(
          (path) => !relative(root, path).startsWith("features/"),
        ),
      ).toBe(true);
  }
  /**
   * visit - brief description
   * @param file -
   * @param stack -
   * @returns
   */
  function visit(file: string, stack: string[]) {
    expect(
      stack,
      `Import cycle involving ${relative(root, file)}`,
    ).not.toContain(file);
    for (const dependency of graph.get(file) ?? [])
      visit(dependency, [...stack, file]);
  }
  for (const file of graph.keys()) visit(file, []);
});
