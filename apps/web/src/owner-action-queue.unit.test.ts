import { describe, expect, it } from "vitest";

import {
  buildQueuePage,
  buildStreetPage,
  filterOwnerActionItems,
  getOwnerAction,
  sortOwnerActionItems,
  type OwnerActionCandidate,
} from "./owner-action-queue.js";

function workItem(
  id: string,
  options: {
    status?: string;
    updatedAt?: string;
    turnCount?: number;
    maxTurns?: number;
    proposals?: Array<{ status: string; createdAt?: string }>;
  } = {},
): OwnerActionCandidate {
  return {
    id,
    title: `Example work ${id}`,
    execution: options.status
      ? {
          id: `execution_${id}`,
          status: options.status,
          turnCount: options.turnCount ?? 1,
          maxTurns: options.maxTurns ?? 3,
          ...(options.updatedAt ? { updatedAt: options.updatedAt } : {}),
          proposals: options.proposals ?? [],
        }
      : null,
  };
}

function waitingItems(count: number): OwnerActionCandidate[] {
  return Array.from({ length: count }, (_, index) =>
    workItem(String(index + 1).padStart(2, "0"), {
      status: "waiting-on-you",
      updatedAt: `2026-10-19T00:${String(index).padStart(2, "0")}:00.000Z`,
    }),
  );
}

describe("recorded owner-action queue", () => {
  it("does not light work that has no recorded owner action", () => {
    expect(getOwnerAction(workItem("not-started"))).toBeUndefined();
    for (const status of ["queued", "working", "done", "cancelled"]) {
      expect(getOwnerAction(workItem(status, { status }))).toBeUndefined();
    }
  });

  it("uses a recorded waiting state as one reply action with its state timestamp", () => {
    expect(
      getOwnerAction(
        workItem("reply", {
          status: "waiting-on-you",
          updatedAt: "2026-10-18T12:00:00.000Z",
          turnCount: 1,
          maxTurns: 3,
        }),
      ),
    ).toMatchObject({ kind: "reply", requestedAt: "2026-10-18T12:00:00.000Z" });
  });

  it("keeps an exhausted waiting item actionable as a close request", () => {
    expect(
      getOwnerAction(
        workItem("exhausted", {
          status: "waiting-on-you",
          updatedAt: "2026-10-18T12:00:00.000Z",
          turnCount: 3,
          maxTurns: 3,
        }),
      ),
    ).toMatchObject({ kind: "close", requestedAt: "2026-10-18T12:00:00.000Z" });
  });

  it.each(["failed", "interrupted"])("exposes an explicit restart action for %s work", (status) => {
    expect(
      getOwnerAction(workItem(status, { status, updatedAt: "2026-10-18T12:00:00.000Z" })),
    ).toMatchObject({ kind: "restart", requestedAt: "2026-10-18T12:00:00.000Z" });
  });

  it("maps multiple pending proposals on one work item to one review light", () => {
    expect(
      getOwnerAction(
        workItem("review", {
          status: "waiting-on-you",
          updatedAt: "2026-10-18T13:00:00.000Z",
          proposals: [
            { status: "pending", createdAt: "2026-10-18T12:00:00.000Z" },
            { status: "pending", createdAt: "2026-10-18T12:05:00.000Z" },
            { status: "approved", createdAt: "2026-10-18T11:00:00.000Z" },
          ],
        }),
      ),
    ).toMatchObject({
      kind: "proposal",
      label: "Review 2 proposed changes",
      requestedAt: "2026-10-18T12:00:00.000Z",
    });
  });

  it("sorts oldest recorded requests first, breaks ties by work ID, and puts unknown times last", () => {
    const items = [
      workItem("b", { status: "waiting-on-you", updatedAt: "2026-10-18T12:00:00.000Z" }),
      workItem("undated", { status: "failed" }),
      workItem("a", { status: "waiting-on-you", updatedAt: "2026-10-18T12:00:00.000Z" }),
      workItem("older", { status: "interrupted", updatedAt: "2026-10-17T12:00:00.000Z" }),
    ];

    expect(sortOwnerActionItems(items).map(({ id }) => id)).toEqual(["older", "a", "b", "undated"]);
  });

  it("shows one empty house at zero and five windows per detailed house", () => {
    const empty = buildStreetPage([], 0);
    expect(empty).toMatchObject({ page: 0, pageCount: 1, total: 0, houses: [[]] });

    const five = buildStreetPage(waitingItems(5), 0);
    expect(five).toMatchObject({ page: 0, pageCount: 1, total: 5 });
    expect(five.houses).toHaveLength(1);
    expect(five.houses[0]).toHaveLength(5);
  });

  it("keeps street pages to fifteen items and paginates thirty across two pages", () => {
    const items = waitingItems(30);
    const firstStreet = buildStreetPage(items, 0);
    const secondStreet = buildStreetPage(items, 1);

    expect(firstStreet).toMatchObject({ page: 0, pageCount: 2, total: 30, start: 1, end: 15 });
    expect(firstStreet.houses).toHaveLength(3);
    expect(firstStreet.houses.every((house) => house.length === 5)).toBe(true);
    expect(secondStreet).toMatchObject({ page: 1, pageCount: 2, start: 16, end: 30 });
    expect(secondStreet.houses).toHaveLength(3);
    expect(
      [...firstStreet.houses.flat(), ...secondStreet.houses.flat()].map(({ id }) => id),
    ).toEqual(items.map(({ id }) => id));
  });

  it("paginates the paper queue independently at ten rows and searches across all thirty", () => {
    const items = waitingItems(30);
    const queue = buildQueuePage(items, 0);
    const street = buildStreetPage(items, 0);
    const matches = filterOwnerActionItems(items, {
      query: "Example work 29",
      kind: "all",
    });

    expect(queue).toMatchObject({ page: 0, pageCount: 3, total: 30, start: 1, end: 10 });
    expect(queue.items).toHaveLength(10);
    expect(street.pageCount).toBe(2);
    expect(matches.map(({ id }) => id)).toEqual(["29"]);
  });
});
