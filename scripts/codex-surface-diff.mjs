import { join } from "node:path";

/**
 * The part of the Codex app-server protocol CuckCode consumes (spec §5), and the diff between two
 * versions of it. The upgrade command writes this diff beside a new bundle so that moving the pin
 * is a ruling on a generated report, never on a hand-written summary (lesson 2).
 *
 * Only the consumed surface is compared. A change elsewhere in the protocol is not CuckCode's
 * concern until something starts reading it, at which point it joins `CONSUMED_FILES`.
 */
export const CONSUMED_FILES = [
  "ClientRequest.json",
  "ServerRequest.json",
  "ServerNotification.json",
  "v1/InitializeParams.json",
  "v1/InitializeResponse.json",
  "v2/GetAccountParams.json",
  "v2/GetAccountResponse.json",
  "v2/ThreadStartParams.json",
  "v2/ThreadStartResponse.json",
  "v2/ThreadReadParams.json",
  "v2/ThreadReadResponse.json",
  "v2/TurnStartParams.json",
  "v2/TurnStartResponse.json",
  "v2/TurnInterruptParams.json",
  "v2/TurnInterruptResponse.json",
  "v2/TurnCompletedNotification.json",
  "v2/ErrorNotification.json",
  "v2/ListMcpServerStatusParams.json",
  "v2/ListMcpServerStatusResponse.json",
];

/** Client methods the supervisor sends. Losing one is breaking. */
const CALLED_METHODS = [
  "initialize",
  "account/read",
  "thread/start",
  "thread/read",
  "turn/start",
  "turn/interrupt",
  "mcpServerStatus/list",
];
/** Server notifications the harness depends on by name. */
const READ_NOTIFICATIONS = ["turn/completed", "error"];
/** Types CuckCode sends: a new required field is one it does not supply. */
const SENT_TYPES = new Set([
  "v1/InitializeParams.json",
  "v2/GetAccountParams.json",
  "v2/ThreadStartParams.json",
  "v2/ThreadReadParams.json",
  "v2/TurnStartParams.json",
  "v2/TurnInterruptParams.json",
  "v2/ListMcpServerStatusParams.json",
]);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function topLevelMethods(schema) {
  const methods = [];
  for (const entry of schema.oneOf ?? []) {
    for (const method of entry?.properties?.method?.enum ?? []) methods.push(method);
  }
  return methods.sort();
}

function shape(schema) {
  const shapeOf = (record) =>
    Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [key, canonical(value)]));
  return {
    required: [...(schema.required ?? [])].sort(),
    properties: shapeOf(schema.properties),
    definitions: shapeOf(schema.definitions),
  };
}

/** `read(name)` returns the parsed schema file at `name`, relative to the bundle's schema root. */
export function extractSurface(read) {
  const files = {};
  const missing = [];
  for (const name of CONSUMED_FILES) {
    try {
      files[name] = read(name);
    } catch {
      missing.push(name);
    }
  }
  const completion = files["v2/TurnCompletedNotification.json"]?.definitions ?? {};
  const threadItemTypes = (completion.ThreadItem?.oneOf ?? [])
    .flatMap((entry) => entry?.properties?.type?.enum ?? [])
    .sort();
  const codexErrorInfo = (completion.CodexErrorInfo?.oneOf ?? [])
    .flatMap((entry) => (Array.isArray(entry.enum) ? entry.enum : (entry.required ?? [])))
    .sort();
  return {
    missing,
    clientMethods: topLevelMethods(files["ClientRequest.json"] ?? {}),
    serverRequests: topLevelMethods(files["ServerRequest.json"] ?? {}),
    serverNotifications: topLevelMethods(files["ServerNotification.json"] ?? {}),
    threadItemTypes,
    codexErrorInfo,
    turnStatus: [...(completion.TurnStatus?.enum ?? [])].sort(),
    shapes: Object.fromEntries(
      Object.entries(files)
        .filter(([name]) => name.includes("/"))
        .map(([name, schema]) => [name, shape(schema)]),
    ),
  };
}

const added = (from, to) => to.filter((value) => !from.includes(value));
const removed = (from, to) => from.filter((value) => !to.includes(value));
const entry = (kind, name, detail) => (detail ? { kind, name, detail } : { kind, name });
const byKindAndName = (left, right) =>
  `${left.kind}:${left.name}`.localeCompare(`${right.kind}:${right.name}`);

export function diffSurface(from, to) {
  const breaking = [];
  const needsRuling = [];
  const additions = [];
  const changes = [];

  for (const name of added(from.missing, to.missing)) breaking.push(entry("fileMissing", name));
  for (const method of removed(from.clientMethods, to.clientMethods)) {
    (CALLED_METHODS.includes(method) ? breaking : changes).push(
      entry("clientMethodRemoved", method),
    );
  }
  for (const method of added(from.clientMethods, to.clientMethods))
    additions.push(entry("clientMethodAdded", method));

  for (const method of added(from.serverRequests, to.serverRequests))
    needsRuling.push(entry("serverRequestAdded", method, "the supervisor refuses it; confirm"));
  for (const method of removed(from.serverRequests, to.serverRequests))
    needsRuling.push(entry("serverRequestRemoved", method));

  for (const method of removed(from.serverNotifications, to.serverNotifications)) {
    (READ_NOTIFICATIONS.includes(method) ? breaking : changes).push(
      entry("notificationRemoved", method),
    );
  }
  for (const method of added(from.serverNotifications, to.serverNotifications))
    additions.push(entry("notificationAdded", method));

  for (const type of added(from.threadItemTypes, to.threadItemTypes))
    needsRuling.push(entry("threadItemType", type, "classify as text or effect (R5)"));
  for (const type of removed(from.threadItemTypes, to.threadItemTypes))
    needsRuling.push(entry("threadItemTypeRemoved", type));
  for (const variant of added(from.codexErrorInfo, to.codexErrorInfo))
    needsRuling.push(entry("codexErrorInfo", variant, "transport class or not (R6.6)"));
  for (const variant of removed(from.codexErrorInfo, to.codexErrorInfo))
    needsRuling.push(entry("codexErrorInfoRemoved", variant));
  for (const status of removed(from.turnStatus, to.turnStatus))
    breaking.push(entry("turnStatusRemoved", status));
  for (const status of added(from.turnStatus, to.turnStatus))
    needsRuling.push(entry("turnStatusAdded", status));

  for (const [file, before] of Object.entries(from.shapes)) {
    const after = to.shapes[file];
    if (!after) continue;
    const sent = SENT_TYPES.has(file);
    for (const field of added(before.required, after.required)) {
      (sent ? breaking : changes).push(entry("requiredAdded", `${file}#${field}`));
    }
    for (const field of removed(before.required, after.required)) {
      (sent ? changes : breaking).push(entry("requiredRemoved", `${file}#${field}`));
    }
    const beforeProps = Object.keys(before.properties);
    const afterProps = Object.keys(after.properties);
    for (const field of added(beforeProps, afterProps))
      additions.push(entry("propertyAdded", `${file}#${field}`));
    for (const field of removed(beforeProps, afterProps))
      (sent ? changes : breaking).push(entry("propertyRemoved", `${file}#${field}`));
    for (const field of beforeProps.filter((name) => afterProps.includes(name))) {
      if (before.properties[field] !== after.properties[field])
        changes.push(entry("propertyChanged", `${file}#${field}`));
    }
    const beforeDefs = Object.keys(before.definitions);
    const afterDefs = Object.keys(after.definitions);
    for (const name of added(beforeDefs, afterDefs))
      additions.push(entry("definitionAdded", `${file}#${name}`));
    for (const name of removed(beforeDefs, afterDefs))
      changes.push(entry("definitionRemoved", `${file}#${name}`));
    for (const name of beforeDefs.filter((key) => afterDefs.includes(key))) {
      if (before.definitions[name] !== after.definitions[name])
        changes.push(entry("definitionChanged", `${file}#${name}`));
    }
  }

  return {
    breaking: breaking.sort(byKindAndName),
    needsRuling: needsRuling.sort(byKindAndName),
    additions: additions.sort(byKindAndName),
    changes: changes.sort(byKindAndName),
  };
}

function section(title, entries, empty) {
  const lines = [`## ${title}`, ""];
  if (entries.length === 0) lines.push(empty);
  for (const item of entries) {
    lines.push(`- ${item.kind}: \`${item.name}\`${item.detail ? ` — ${item.detail}` : ""}`);
  }
  lines.push("");
  return lines;
}

export function renderSurfaceDiff(diff, versions) {
  return [
    `# Codex surface diff: ${versions.from} → ${versions.to}`,
    "",
    "Generated by `npm run protocol:codex:upgrade`. Compares only the surface CuckCode consumes",
    "(`CONSUMED_FILES` in `scripts/codex-surface-diff.mjs`) and the default-on features the binary",
    "reports (`features.json`). The pin does not move until the owner rules on every entry under",
    "Needs a ruling and Breaking.",
    "",
    ...section("Needs a ruling", diff.needsRuling, "None."),
    ...section("Breaking", diff.breaking, "None."),
    ...section("Changed", diff.changes, "None."),
    ...section("Added", diff.additions, "None."),
  ].join("\n");
}

/**
 * `codex features list` output: one feature per line, `<name> <stage> <true|false>` in padded
 * columns, where the stage may contain a space ("under development"). The last column is the
 * state under the config the binary ran with, so the upgrade runs it with an empty `CODEX_HOME`
 * and records that state as the default (F1.2). An unreadable line is refused, never skipped: a
 * skipped line would be a feature nobody classified.
 */
const FEATURE_LINE = /^(\S+)\s+(\S(?:.*\S)?)\s+(true|false)$/u;

export function parseFeaturesList(text) {
  const features = [];
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    const match = FEATURE_LINE.exec(line.trim());
    if (!match) throw new Error(`FEATURES_LIST_UNPARSED: ${line}`);
    features.push({ name: match[1], stage: match[2], default: match[3] === "true" });
  }
  if (features.length === 0) throw new Error("FEATURES_LIST_EMPTY");
  return features.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Feature changes between two pinned binaries. Anything that adds to what is on by default needs
 * a ruling before the pin moves, because `FEATURE_POLICY` must name it keep or disable (F1.1).
 * With no baseline list (a bundle from before F1.2), every default-on feature needs one.
 */
export function diffFeatures(from, to) {
  const needsRuling = [];
  const additions = [];
  const changes = [];
  const before = new Map((from ?? []).map((feature) => [feature.name, feature]));
  const after = new Map(to.map((feature) => [feature.name, feature]));
  for (const feature of to) {
    const previous = before.get(feature.name);
    if (!previous) {
      if (feature.default) {
        needsRuling.push(
          entry(
            "featureDefaultOn",
            feature.name,
            from
              ? "new default-on feature; keep or disable (F1.1)"
              : "no baseline feature list; keep or disable (F1.1)",
          ),
        );
      } else if (from) {
        additions.push(entry("featureAdded", feature.name));
      }
      continue;
    }
    if (feature.default && !previous.default) {
      needsRuling.push(entry("featureNowDefaultOn", feature.name, "keep or disable (F1.1)"));
    } else if (!feature.default && previous.default) {
      changes.push(entry("featureNoLongerDefaultOn", feature.name));
    } else if (feature.stage !== previous.stage) {
      (feature.default ? needsRuling : changes).push(
        entry("featureStageChanged", feature.name, `${previous.stage} → ${feature.stage}`),
      );
    }
  }
  for (const name of before.keys()) {
    if (!after.has(name)) changes.push(entry("featureRemoved", name));
  }
  return {
    breaking: [],
    needsRuling: needsRuling.sort(byKindAndName),
    additions: additions.sort(byKindAndName),
    changes: changes.sort(byKindAndName),
  };
}

/**
 * The `features.json` record. Defaults differ by platform (the pinned binary turns
 * `secret_auth_storage` on for win32-x64 and off for linux-x64), so the record names the binary it
 * describes.
 */
export function buildFeaturesRecord({ version, platform, arch, features }) {
  return {
    schema: "cuckcode.codex-features.v1",
    version,
    platform: `${platform}-${arch}`,
    command: "features list",
    config: "empty CODEX_HOME",
    features,
  };
}

/** One report from several diffs, each section sorted as `diffSurface` sorts its own. */
export function mergeDiffs(...diffs) {
  const merged = {};
  for (const key of ["breaking", "needsRuling", "additions", "changes"]) {
    merged[key] = diffs.flatMap((diff) => diff[key]).sort(byKindAndName);
  }
  return merged;
}

const EXACT_VERSION = /^\d+\.\d+\.\d+$/u;

export function parseUpgradeArgs(argv) {
  const [version, ...rest] = argv;
  if (!version)
    throw new Error("UPGRADE_VERSION_REQUIRED: npm run protocol:codex:upgrade -- <x.y.z>");
  if (!EXACT_VERSION.test(version)) throw new Error(`UPGRADE_VERSION_NOT_EXACT: ${version}`);
  let from;
  if (rest[0] === "--from") {
    from = rest[1];
    if (!from || !EXACT_VERSION.test(from)) throw new Error(`UPGRADE_FROM_NOT_EXACT: ${from}`);
  } else if (rest.length > 0) {
    throw new Error(`UPGRADE_ARGUMENT_UNKNOWN: ${rest[0]}`);
  }
  return { version, from };
}

/** Every path the upgrade may write. Nothing outside the new bundle, and never the pin. */
export function upgradeWritePaths(protocolRoot, version) {
  const bundle = join(protocolRoot, version);
  return [
    join(bundle, "schemas"),
    join(bundle, "manifest.json"),
    join(bundle, "surface-diff.md"),
    join(bundle, "features.json"),
  ];
}
