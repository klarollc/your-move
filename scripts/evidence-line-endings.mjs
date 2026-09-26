import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * DF-026's guard. The provenance ledger digests the bytes on disk, and `.gitattributes` commits text
 * as LF, so an evidence file holding a CR byte has a digest no clean checkout can reproduce. Twelve
 * Phases 0–3 artifacts were in that state, verifiable only from the owner's working copy.
 *
 * Binary files are skipped: the types `.gitattributes` declares binary, and any file with a NUL byte.
 */
const BINARY_EXTENSIONS = new Set([".png", ".webm", ".zip", ".sqlite"]);

const extension = (path) => {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
};

export function crViolations(files) {
  return files
    .filter(({ path, bytes }) => !BINARY_EXTENSIONS.has(extension(path)) && !bytes.includes(0))
    .filter(({ bytes }) => bytes.includes(0x0d))
    .map(({ path }) => path)
    .sort();
}

export function listEvidenceFiles(root) {
  const found = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) found.push(relative(root, absolute).split(sep).join("/"));
    }
  };
  visit(join(root, "docs", "evidence"));
  return found.sort();
}
