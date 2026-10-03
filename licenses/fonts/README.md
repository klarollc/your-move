# Font licences

Phase 7 Task 1 (spec F-5): the office's two typefaces, vendored as exact-pinned npm packages and
bundled from the app's own origin. These files are the packages' `LICENSE` texts, copied verbatim;
`scripts/font-licences.unit.test.ts` fails if either drifts from the installed package or the pin.

| Package | Version | Licence | Text | Lockfile integrity |
| --- | --- | --- | --- | --- |
| `@fontsource/fira-sans` | 5.3.0 | OFL-1.1 | `fira-sans-5.3.0-OFL.txt` | `sha512-z1SKSG7eRhm3srlb7rQ3j77QP4TP7OFxCZ4wUWhCdt+3hOF9K0AyvybpAsz6+JWNcCVV7AqC7dbOT3e67P2r5A==` |
| `@fontsource/fira-mono` | 5.3.0 | OFL-1.1 | `fira-mono-5.3.0-OFL.txt` | `sha512-FZzRwKhpoXQU1uhEGKUg5AHUUdfiaTXxGCdBBeGHUmcZaqEDEmndSVvpXHkSViH25f/UiWfhcWTib+6A8o4qeQ==` |

**Recorded discrepancy.** Both `LICENSE` files open with the copyright line "Google Inc." The
upstream Fira project credits, as far as is known here, the Mozilla Foundation and Telefónica.
The text is kept as shipped, not edited; the OFL-1.1 terms that follow it are the standard ones.
