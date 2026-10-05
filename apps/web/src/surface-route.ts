export type AppSurface = "work-list" | "office" | "layout-trial" | "font-sheet";

const officeFixtureParameters = ["state", "kickoff", "fixture", "motion", "checkpoint"] as const;

/** Keep the historical office fixture URLs addressable while Surface B owns the default route. */
export function selectAppSurface(parameters: URLSearchParams): AppSurface {
  const surface = parameters.get("surface");
  if (surface === "layout-trial" || surface === "font-sheet") return surface;
  if (surface === "office") return "office";
  if (surface === null && officeFixtureParameters.some((key) => parameters.has(key)))
    return "office";
  return "work-list";
}
