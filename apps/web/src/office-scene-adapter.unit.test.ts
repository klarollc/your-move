import { describe, expect, it } from "vitest";

import {
  createOfficeSceneAdapter,
  type SceneDescriptor,
  type SceneRendererPort,
} from "./office-scene-adapter.js";

class MemoryRenderer implements SceneRendererPort {
  mounted = false;
  destroyed = false;
  width = 0;
  height = 0;
  nodes = new Map<string, SceneDescriptor>();
  order: string[] = [];

  mount() {
    this.mounted = true;
  }

  upsert(descriptor: SceneDescriptor) {
    this.nodes.set(descriptor.entityId, descriptor);
  }

  remove(entityId: string) {
    this.nodes.delete(entityId);
  }

  sort(entityIds: string[]) {
    this.order = entityIds;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  clear() {
    this.nodes.clear();
    this.order = [];
  }

  destroy() {
    this.destroyed = true;
    this.mounted = false;
  }
}

class DeferredMountRenderer extends MemoryRenderer {
  resolveMount: (() => void) | undefined;

  override mount() {
    return new Promise<void>((resolve) => {
      this.resolveMount = () => {
        this.mounted = true;
        resolve();
      };
    });
  }
}
const node = (entityId: string, depth: number): SceneDescriptor => ({
  entityId,
  entityType: "agent",
  x: depth * 10,
  y: depth * 20,
  width: 44,
  height: 44,
  depth,
  visible: true,
});

describe("office scene adapter", () => {
  it("reconciles immutable descriptors in deterministic depth and entity order", async () => {
    const renderer = new MemoryRenderer();
    const fallbackStates: boolean[] = [];
    const adapter = createOfficeSceneAdapter(renderer, (unavailable) =>
      fallbackStates.push(unavailable),
    );

    await adapter.mount({} as HTMLElement);
    adapter.update([node("agent_z", 2), node("agent_b", 1), node("agent_a", 1)]);

    expect(renderer.order).toEqual(["agent_a", "agent_b", "agent_z"]);
    expect(renderer.nodes.size).toBe(3);
    expect(fallbackStates).toEqual([false]);
  });

  it("removes stale nodes and preserves the caller's descriptors", async () => {
    const renderer = new MemoryRenderer();
    const adapter = createOfficeSceneAdapter(renderer, () => undefined);
    const descriptors = [node("agent_a", 1), node("agent_b", 2)] as const;
    const before = JSON.stringify(descriptors);

    await adapter.mount({} as HTMLElement);
    adapter.update(descriptors);
    adapter.update([node("agent_b", 3)]);

    expect([...renderer.nodes]).toEqual([["agent_b", node("agent_b", 3)]]);
    expect(JSON.stringify(descriptors)).toBe(before);
  });

  it("propagates resize, exposes context loss, and releases every resource on unmount", async () => {
    const renderer = new MemoryRenderer();
    const fallbackStates: boolean[] = [];
    const adapter = createOfficeSceneAdapter(renderer, (unavailable) =>
      fallbackStates.push(unavailable),
    );

    await adapter.mount({} as HTMLElement);
    adapter.update([node("agent_a", 1)]);
    adapter.resize(840, 744);
    adapter.contextLost();
    adapter.unmount();

    expect({ width: renderer.width, height: renderer.height }).toEqual({ width: 840, height: 744 });
    expect(fallbackStates).toEqual([false, true]);
    expect(renderer.nodes.size).toBe(0);
    expect(renderer.destroyed).toBe(true);
  });

  it("releases a renderer when unmounted during asynchronous initialization", async () => {
    const renderer = new DeferredMountRenderer();
    const adapter = createOfficeSceneAdapter(renderer, () => undefined);

    const mounting = adapter.mount({} as HTMLElement);
    adapter.unmount();
    renderer.resolveMount?.();
    await mounting;

    expect(renderer.destroyed).toBe(true);
    expect(renderer.mounted).toBe(false);
  });
});
