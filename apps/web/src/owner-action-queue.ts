export type OwnerActionKind = "proposal" | "reply" | "close" | "restart";
export type OwnerActionFilter = OwnerActionKind | "all";

export type OwnerActionCandidate = {
  id: string;
  title: string;
  execution?: {
    id: string;
    status: string;
    turnCount: number;
    maxTurns: number;
    updatedAt?: string | null;
    proposals?: readonly { status: string; createdAt?: string | null }[];
  } | null;
};

export type OwnerAction = {
  kind: OwnerActionKind;
  label: string;
  requestedAt?: string;
};

export type StreetPage<T> = {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  houses: T[][];
};

export type QueuePage<T> = {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  items: T[];
};

export const WINDOWS_PER_HOUSE = 5;
export const HOUSES_PER_STREET_PAGE = 3;
export const STREET_PAGE_SIZE = WINDOWS_PER_HOUSE * HOUSES_PER_STREET_PAGE;
export const QUEUE_PAGE_SIZE = 10;

function parseRequestTime(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function earliestKnownTime(
  values: readonly ({ createdAt?: string | null } | undefined)[],
): string | undefined {
  return values
    .map((value) => value?.createdAt)
    .filter((value): value is string => Boolean(value) && parseRequestTime(value) !== undefined)
    .sort((left, right) => parseRequestTime(left)! - parseRequestTime(right)!)[0];
}

export function getOwnerAction(item: OwnerActionCandidate): OwnerAction | undefined {
  const execution = item.execution;
  if (!execution) return undefined;

  const pending = (execution.proposals ?? []).filter(({ status }) => status === "pending");
  if (pending.length > 0) {
    const requestedAt = earliestKnownTime(pending);
    return {
      kind: "proposal",
      label:
        pending.length === 1
          ? "Review a proposed change"
          : `Review ${pending.length} proposed changes`,
      ...(requestedAt ? { requestedAt } : {}),
    };
  }

  if (execution.status === "waiting-on-you") {
    if (execution.turnCount < execution.maxTurns) {
      return {
        kind: "reply",
        label: "Reply to the agent",
        ...(execution.updatedAt ? { requestedAt: execution.updatedAt } : {}),
      };
    }
    return {
      kind: "close",
      label: "Close finished work",
      ...(execution.updatedAt ? { requestedAt: execution.updatedAt } : {}),
    };
  }

  if (execution.status === "failed" || execution.status === "interrupted") {
    return {
      kind: "restart",
      label: "Restart or close this work",
      ...(execution.updatedAt ? { requestedAt: execution.updatedAt } : {}),
    };
  }

  return undefined;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortOwnerActionItems<T extends OwnerActionCandidate>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = parseRequestTime(getOwnerAction(left)?.requestedAt);
    const rightTime = parseRequestTime(getOwnerAction(right)?.requestedAt);
    if (leftTime !== undefined && rightTime !== undefined && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if (leftTime !== undefined && rightTime === undefined) return -1;
    if (leftTime === undefined && rightTime !== undefined) return 1;
    return compareIds(left.id, right.id);
  });
}

export function filterOwnerActionItems<T extends OwnerActionCandidate>(
  items: readonly T[],
  filter: { query?: string; kind?: OwnerActionFilter } = {},
): T[] {
  const query = filter.query?.trim().toLocaleLowerCase() ?? "";
  const kind = filter.kind ?? "all";
  return sortOwnerActionItems(items).filter((item) => {
    const action = getOwnerAction(item);
    return (
      action !== undefined &&
      (kind === "all" || action.kind === kind) &&
      (!query || item.title.toLocaleLowerCase().includes(query))
    );
  });
}

function clampPage(page: number, pageCount: number): number {
  return pageCount === 0 ? 0 : Math.max(0, Math.min(Math.floor(page), pageCount - 1));
}

export function buildStreetPage<T extends OwnerActionCandidate>(
  items: readonly T[],
  requestedPage: number,
): StreetPage<T> {
  const ordered = sortOwnerActionItems(items);
  const total = ordered.length;
  const pageCount = Math.max(1, Math.ceil(total / STREET_PAGE_SIZE));
  const page = clampPage(requestedPage, pageCount);
  const offset = page * STREET_PAGE_SIZE;
  const visible = ordered.slice(offset, offset + STREET_PAGE_SIZE);
  const houseCount = Math.max(1, Math.ceil(visible.length / WINDOWS_PER_HOUSE));
  const houses = Array.from({ length: houseCount }, (_, index) =>
    visible.slice(index * WINDOWS_PER_HOUSE, (index + 1) * WINDOWS_PER_HOUSE),
  );

  return {
    page,
    pageCount,
    total,
    start: total === 0 ? 0 : offset + 1,
    end: Math.min(offset + visible.length, total),
    houses,
  };
}

export function buildQueuePage<T extends OwnerActionCandidate>(
  items: readonly T[],
  requestedPage: number,
): QueuePage<T> {
  const ordered = sortOwnerActionItems(items);
  const total = ordered.length;
  const pageCount = Math.ceil(total / QUEUE_PAGE_SIZE);
  const page = clampPage(requestedPage, pageCount);
  const offset = page * QUEUE_PAGE_SIZE;
  const visible = ordered.slice(offset, offset + QUEUE_PAGE_SIZE);

  return {
    page,
    pageCount,
    total,
    start: total === 0 ? 0 : offset + 1,
    end: Math.min(offset + visible.length, total),
    items: visible,
  };
}
