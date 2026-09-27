import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import ts from "typescript";

/**
 * Phase 7-O Task 7 (R-3, spec §5): find office records written as literals in `apps/web`.
 *
 * The guarded types are not hand-listed. They are every named object type reachable from the return
 * types of the exported functions that produce office records:
 *
 * - `projectOfficeReadModel` (`@cuckcode/application`): the read model, its entities and views;
 * - `projectManagerAttention` (`@cuckcode/domain`): the manager's attention items;
 * - `projectOfficeLibraryEvidence` (`@cuckcode/application`): the library's evidence records;
 * - `attentionItemsFrom` (`apps/web/src/office-model.ts`): the rail's records.
 *
 * An object literal is an office record when its contextual type is guarded, or, with no contextual
 * type, when its keys cover every required property of a guarded type. It is an offender when it is
 * written at module scope, or when every value in it is a literal. A record built inside a function
 * from its inputs is allowed: that is what a projection is.
 */
const ROOT = resolve(import.meta.dirname, "..");
const WEB_SRC = join(ROOT, "apps", "web", "src");
const PRODUCERS = [
  { file: "packages/application/src/office-read-model.ts", fn: "projectOfficeReadModel" },
  { file: "packages/domain/src/attention.ts", fn: "projectManagerAttention" },
  { file: "packages/application/src/evidence-library.ts", fn: "projectOfficeLibraryEvidence" },
  { file: "apps/web/src/office-model.ts", fn: "attentionItemsFrom" },
];
const isTestFile = (path) => /\.(test|spec)\.tsx?$/u.test(path);
const posix = (path) => relative(ROOT, path).split(sep).join("/");

function webSources(dir = WEB_SRC) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return webSources(path);
    return /\.tsx?$/u.test(name) && !isTestFile(name) ? [path] : [];
  });
}

function createProgram(extraFiles) {
  const extras = new Map(
    Object.entries(extraFiles).map(([file, text]) => [join(ROOT, file), text]),
  );
  const options = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
    baseUrl: ROOT,
    // Workspace links are resolved to package sources directly, so the guard reads the same
    // exports on any checkout, symlinked or not.
    paths: { "@cuckcode/*": ["packages/*/src/index.ts"] },
  };
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = host;
  host.fileExists = (file) => extras.has(resolve(file)) || fileExists.call(host, file);
  host.readFile = (file) => extras.get(resolve(file)) ?? readFile.call(host, file);
  host.getSourceFile = (file, language, ...rest) => {
    const text = extras.get(resolve(file));
    return text === undefined
      ? getSourceFile.call(host, file, language, ...rest)
      : ts.createSourceFile(file, text, language, true);
  };
  const rootNames = [
    ...webSources(),
    ...[...extras.keys()],
    ...PRODUCERS.map(({ file }) => join(ROOT, file)),
  ];
  return ts.createProgram({ rootNames, options, host });
}

const BUILTIN = new Set(["Array", "ReadonlyArray", "Readonly", "Record", "Object", "Partial"]);

/**
 * Names for exported types. `type OfficeReadModel = Readonly<{...}>` reaches the checker as a
 * `Readonly` instantiation, so its own name is recovered from the export's declared type.
 */
function exportedTypeNames(program, checker, files) {
  const names = new Map();
  for (const file of files) {
    const source = program.getSourceFile(file);
    const moduleSymbol = source && checker.getSymbolAtLocation(source);
    if (!moduleSymbol) continue;
    for (let symbol of checker.getExportsOfModule(moduleSymbol)) {
      if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      if (!(symbol.flags & (ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface))) continue;
      const type = checker.getDeclaredTypeOfSymbol(symbol);
      if (!names.has(type)) names.set(type, symbol.getName());
    }
  }
  return names;
}

function nameOf(names, type) {
  const exported = names.get(type);
  if (exported) return exported;
  const name = type.aliasSymbol?.getName() ?? type.getSymbol()?.getName();
  return name && !name.startsWith("__") && !BUILTIN.has(name) ? name : undefined;
}

function isObjectLike(type) {
  const parts = type.isUnionOrIntersection() ? type.types : [type];
  return parts.some((part) => (part.flags & ts.TypeFlags.Object) !== 0);
}

/**
 * Contract types are the event vocabulary: the input to replay, which the fixture logs are allowed
 * to write (spec §5). The guard covers what projection produces, not what events carry.
 */
function isEventVocabulary(type) {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  return (symbol?.declarations ?? []).every((declaration) =>
    posix(declaration.getSourceFile().fileName).startsWith("packages/contracts/"),
  );
}

/** Every named object type reachable from the producers' return types. */
function guardedTypes(program, checker, names) {
  const guarded = new Map();
  const seen = new Set();
  const visit = (type) => {
    if (seen.has(type)) return;
    seen.add(type);
    const name = nameOf(names, type);
    if (name && isObjectLike(type) && !isEventVocabulary(type) && !guarded.has(name)) {
      guarded.set(name, type);
    }
    if (type.isUnionOrIntersection()) type.types.forEach(visit);
    if (checker.isArrayType(type) || checker.isTupleType(type)) {
      checker.getTypeArguments(type).forEach(visit);
      return;
    }
    if (type.flags & ts.TypeFlags.Object) {
      for (const property of checker.getPropertiesOfType(type)) {
        visit(checker.getTypeOfSymbol(property));
      }
    }
  };
  for (const { file, fn } of PRODUCERS) {
    const source = program.getSourceFile(join(ROOT, file));
    if (!source) throw new Error(`guard: producer source missing: ${file}`);
    const symbol = checker
      .getExportsOfModule(checker.getSymbolAtLocation(source))
      .find((candidate) => candidate.getName() === fn);
    if (!symbol) throw new Error(`guard: ${file} no longer exports ${fn}`);
    for (const signature of checker.getTypeOfSymbol(symbol).getCallSignatures()) {
      visit(checker.getReturnTypeOfSignature(signature));
    }
  }
  return guarded;
}

function requiredKeys(checker, type) {
  const parts = type.isUnion() ? type.types : [type];
  return parts.map((part) =>
    checker
      .getPropertiesOfType(part)
      .filter((property) => (property.flags & ts.SymbolFlags.Optional) === 0)
      .map((property) => property.getName()),
  );
}

function isLiteralValue(node) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(node) && node.text === "undefined")
  ) {
    return true;
  }
  if (ts.isPrefixUnaryExpression(node)) return isLiteralValue(node.operand);
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
  ) {
    return isLiteralValue(node.expression);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.every(isLiteralValue);
  if (ts.isObjectLiteralExpression(node)) return allValuesLiteral(node);
  return false;
}

function allValuesLiteral(node) {
  return node.properties.every(
    (property) => ts.isPropertyAssignment(property) && isLiteralValue(property.initializer),
  );
}

function atModuleScope(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionLike(parent)) return false;
  }
  return true;
}

export function analyzeOfficeLiterals({ extraFiles = {} } = {}) {
  const program = createProgram(extraFiles);
  const checker = program.getTypeChecker();
  const names = exportedTypeNames(program, checker, [
    join(ROOT, "packages/application/src/index.ts"),
    join(ROOT, "packages/domain/src/index.ts"),
    ...webSources(),
  ]);
  const guarded = guardedTypes(program, checker, names);
  const shapes = [...guarded].flatMap(([name, type]) =>
    requiredKeys(checker, type)
      .filter((keys) => keys.length >= 3)
      .map((keys) => ({ name, keys })),
  );
  const guardedName = (type) => {
    if (!type) return undefined;
    const parts = type.isUnion() ? [type, ...type.types] : [type];
    for (const part of parts) {
      const name = nameOf(names, part);
      if (name && guarded.has(name)) return name;
    }
    return undefined;
  };

  const offenders = [];
  const scanned = [...webSources(), ...Object.keys(extraFiles).map((file) => join(ROOT, file))];
  for (const path of scanned) {
    const source = program.getSourceFile(path);
    if (!source) throw new Error(`guard: could not load ${posix(path)}`);
    const visit = (node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const keys = new Set(
          node.properties.flatMap((property) =>
            property.name ? [property.name.getText(source)] : [],
          ),
        );
        const name =
          guardedName(checker.getContextualType(node)) ??
          shapes.find((shape) => shape.keys.every((key) => keys.has(key)))?.name;
        if (name && (atModuleScope(node) || allValuesLiteral(node))) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          offenders.push({ file: posix(path), line: line + 1, type: name });
          return; // One record, one finding: its nested views are part of it.
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { guardedNames: [...guarded.keys()].sort(), offenders };
}
