// Reference solution, kept OUT of the scratch repo. It exists only to show the pre-written test is
// satisfiable, and is never shown to the role. It deliberately sets no length limit.
export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
