export type ApprovedRoleExercise = Readonly<{
  roleId: string;
  model: string;
  reasoningEffort: string;
}>;

type PlanResult =
  | Readonly<{ ok: true; plan: readonly ApprovedRoleExercise[] }>
  | Readonly<{
      ok: false;
      code: "ROLE_EXERCISE_PLAN_HEADER_MISSING" | "ROLE_EXERCISE_PLAN_INCOMPLETE";
      missingRoleIds?: readonly string[];
    }>;

const ROLE_NAMES: ReadonlyArray<Readonly<{ name: string; roleId: string }>> = [
  { name: "Delivery Lead", roleId: "delivery-lead" },
  { name: "Product Designer", roleId: "product-designer" },
  { name: "Implementation Engineer", roleId: "implementation-engineer" },
  { name: "Test Engineer", roleId: "test-engineer" },
  { name: "Visual QA Reviewer", roleId: "visual-qa-reviewer" },
  { name: "Release Reviewer", roleId: "release-reviewer" },
];

/**
 * Reads the sole approved model/effort matrix from the Task 16 packet. The executable path does
 * not carry a second copy of those choices: a changed packet becomes a reviewable plan change,
 * while a missing row fails before any role session starts.
 */
export function parseApprovedRoleExercisePlan(packet: string): PlanResult {
  const lines = packet.split(/\r?\n/u);
  const header = lines.findIndex((line) => {
    const cells = tableCells(line);
    return cells?.[0] === "Role" && cells[1] === "Model" && cells[2] === "Reasoning effort";
  });
  if (header < 0) return { ok: false, code: "ROLE_EXERCISE_PLAN_HEADER_MISSING" };

  const rows = new Map<string, Readonly<{ model: string; reasoningEffort: string }>>();
  for (const line of lines.slice(header + 1)) {
    const cells = tableCells(line);
    if (!cells) break;
    if (cells.every((cell) => /^-+$/u.test(cell))) continue;
    const role = ROLE_NAMES.find(({ name }) => name === cells[0]);
    if (!role || rows.has(role.roleId) || !cells[1] || !cells[2]) continue;
    rows.set(role.roleId, { model: cells[1], reasoningEffort: cells[2] });
  }

  const missingRoleIds = ROLE_NAMES.filter(({ roleId }) => !rows.has(roleId)).map(
    ({ roleId }) => roleId,
  );
  if (missingRoleIds.length > 0) {
    return { ok: false, code: "ROLE_EXERCISE_PLAN_INCOMPLETE", missingRoleIds };
  }

  return {
    ok: true,
    plan: ROLE_NAMES.map(({ roleId }) => {
      const row = rows.get(roleId);
      if (!row) throw new Error("ROLE_EXERCISE_PLAN_ROW_MISSING");
      return { roleId, ...row };
    }),
  };
}

function tableCells(line: string): string[] | undefined {
  const raw = line.trim();
  if (!raw.startsWith("|") || !raw.endsWith("|")) return undefined;
  return raw
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.replace(new RegExp("[\\x60*_]", "gu"), "").trim());
}
