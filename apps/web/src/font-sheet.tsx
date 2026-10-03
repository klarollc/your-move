import { useEffect, useState } from "react";

import "./fonts.css";
import "./font-sheet.css";

/**
 * Phase 7 Task 1 (spec F-5, plan Q-4). Every face the office would use, at the sizes it uses, set
 * in the words it shows, for the owner to judge in Windows Chromium before any token changes. The
 * readout counts loaded faces itself, so a capture of fallback text says so.
 */
export const FONT_SHEET_FACES = [
  ["Fira Sans", 400],
  ["Fira Sans", 500],
  ["Fira Sans", 600],
  ["Fira Sans", 700],
  ["Fira Mono", 400],
  ["Fira Mono", 500],
  ["Fira Mono", 700],
] as const;

// The office's smallest, its two commonest and its largest sizes; the sheet must fit one screen at
// 1280×800, because the office's global stylesheet does not let the page scroll.
const SIZES = [12, 13, 16, 19] as const;

// One line per size, in the words the office shows; the last Mono line checks the glyphs a
// monospace face exists to keep apart.
const SANS_SAMPLES = [
  "Test Engineer · Blocked · Needs you",
  "1 blocked · 1 review — Redirect the request or decline it.",
  "Nothing needs you. Implementation Engineer can resolve it.",
  "Deliver the approved graybox slice",
];
const MONO_SAMPLES = [
  "event_office_default_042 · 2026-10-03T09:00:00.000Z",
  "sha256 0f1e2d3c4b5a6978 · v2 · decision-notice.tsx",
  "work_browser_evidence · rev 4",
  "Il1| O0o rn m {}[] => !== 0x7f",
];

export function FontSheet() {
  const [loaded, setLoaded] = useState<readonly string[] | null>(null);
  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => {
      if (!live) return;
      const faces = [...document.fonts]
        .filter((face) => face.status === "loaded")
        .map((face) => `${face.family.replaceAll('"', "")} ${face.weight}`);
      setLoaded(faces);
    });
    return () => {
      live = false;
    };
  }, []);

  const missing = loaded
    ? FONT_SHEET_FACES.map(([family, weight]) => `${family} ${weight}`).filter(
        (face) => !loaded.includes(face),
      )
    : [];

  return (
    <main className="font-sheet" aria-label="Font sheet">
      <h1>Phase 7 font sheet: Fira Sans 5.3.0 and Fira Mono 5.3.0</h1>
      <p className="font-sheet-readout" data-testid="font-readout">
        {loaded === null
          ? "Waiting for fonts…"
          : missing.length === 0
            ? `All ${FONT_SHEET_FACES.length} faces loaded from this origin.`
            : `${FONT_SHEET_FACES.length - missing.length} of ${FONT_SHEET_FACES.length} faces loaded; missing: ${missing.join(", ")}.`}
      </p>
      <div className="font-sheet-columns">
        {(["Fira Sans", "Fira Mono"] as const).map((column) => (
          <div key={column}>
            {FONT_SHEET_FACES.filter(([family]) => family === column).map(([family, weight]) => (
              <section key={`${family} ${weight}`}>
                <h2>
                  {family} {weight}
                </h2>
                {SIZES.map((size, index) => (
                  <p
                    key={size}
                    data-face={`${family} ${weight}`}
                    style={{ fontFamily: `"${family}"`, fontWeight: weight, fontSize: size }}
                  >
                    <span className="font-sheet-size">{size}px</span>
                    {(family === "Fira Mono" ? MONO_SAMPLES : SANS_SAMPLES)[index]}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
