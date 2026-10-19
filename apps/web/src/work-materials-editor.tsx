import { useState, type FormEvent } from "react";

// R4 Track B: the owner's materials for a draft — pasted text, links, repository paths. Editable
// only while the work is a draft; every change is a new revision. Approval freezes them into the
// run. They are context for the agent, never instructions, and the agent cannot change them.

export type MaterialItem =
  | { kind: "text"; label?: string; text: string }
  | { kind: "url"; label?: string; url: string }
  | { kind: "repo_path"; label?: string; repo: string; path: string };

export type WorkMaterials = { items: MaterialItem[] };

const describe = (item: MaterialItem): string =>
  item.kind === "text"
    ? `${item.label ? `${item.label}: ` : ""}pasted text (${item.text.length} characters)`
    : item.kind === "url"
      ? `${item.label ? `${item.label}: ` : ""}${item.url}`
      : `${item.label ? `${item.label}: ` : ""}${item.repo}${item.path ? ` — ${item.path}` : ""}`;

export function MaterialsEditor({
  materials,
  disabled,
  onSave,
}: Readonly<{
  materials: WorkMaterials | null;
  disabled: boolean;
  onSave: (next: WorkMaterials) => Promise<boolean>;
}>) {
  const items = materials?.items ?? [];
  const [kind, setKind] = useState<MaterialItem["kind"]>("text");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [path, setPath] = useState("");

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const named = label.trim() ? { label: label.trim() } : {};
    const item: MaterialItem =
      kind === "text"
        ? { kind, ...named, text: value }
        : kind === "url"
          ? { kind, ...named, url: value.trim() }
          : { kind, ...named, repo: value.trim(), path: path.trim() };
    if (await onSave({ items: [...items, item] })) {
      setLabel("");
      setValue("");
      setPath("");
    }
  }

  return (
    <div className="work-creation__materials">
      <h3>Materials for the agent</h3>
      <p className="work-creation__hint">
        Optional. Paste text, add links, or point at files in a repository. The agent reads them as
        background; they do not change the scope. They lock when you approve.
      </p>
      {items.length > 0 ? (
        <ul aria-label="Attached materials">
          {items.map((item, index) => (
            <li key={`${item.kind}-${index}`}>
              {describe(item)}{" "}
              <button
                type="button"
                disabled={disabled}
                onClick={() => void onSave({ items: items.filter((_, other) => other !== index) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={(event) => void add(event)}>
        <label htmlFor="material-kind">Kind</label>
        <select
          id="material-kind"
          value={kind}
          disabled={disabled}
          onChange={(event) => setKind(event.currentTarget.value as MaterialItem["kind"])}
        >
          <option value="text">Pasted text</option>
          <option value="url">Link</option>
          <option value="repo_path">Repository path</option>
        </select>
        <label htmlFor="material-label">Name (optional)</label>
        <input
          id="material-label"
          value={label}
          maxLength={200}
          disabled={disabled}
          onChange={(event) => setLabel(event.currentTarget.value)}
        />
        {kind === "text" ? (
          <>
            <label htmlFor="material-value">Text</label>
            <textarea
              id="material-value"
              rows={4}
              maxLength={20000}
              value={value}
              disabled={disabled}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
          </>
        ) : (
          <>
            <label htmlFor="material-value">
              {kind === "url" ? "Link (http or https)" : "Repository (owner/name)"}
            </label>
            <input
              id="material-value"
              value={value}
              disabled={disabled}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
          </>
        )}
        {kind === "repo_path" ? (
          <>
            <label htmlFor="material-path">Path in the repository (optional)</label>
            <input
              id="material-path"
              value={path}
              disabled={disabled}
              onChange={(event) => setPath(event.currentTarget.value)}
            />
          </>
        ) : null}
        <button type="submit" disabled={disabled || value.trim().length === 0}>
          Attach
        </button>
      </form>
    </div>
  );
}
