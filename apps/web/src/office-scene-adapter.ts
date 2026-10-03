export type SceneDescriptor = Readonly<{
  entityId: string;
  entityType: "agent" | "zone" | "work" | "artifact" | "collaboration";
  /** The projected outline to hit-test, in world coordinates (Task 3b; required since Task 4, R-3). */
  points: readonly Readonly<{ x: number; y: number }>[];
  depth: number;
  visible: boolean;
}>;

export type SceneTransform = Readonly<{
  zoom: number;
  translation: Readonly<{ x: number; y: number }>;
}>;

export type SceneRendererPort = {
  mount(host: HTMLElement): void | Promise<void>;
  upsert(descriptor: SceneDescriptor): void;
  remove(entityId: string): void;
  sort(entityIds: string[]): void;
  transform(zoom: number, translation: SceneTransform["translation"]): void;
  resize(width: number, height: number): void;
  clear(): void;
  destroy(): void;
};

export type OfficeSceneAdapter = {
  mount(host: HTMLElement): Promise<void>;
  update(descriptors: readonly SceneDescriptor[]): void;
  resize(width: number, height: number): void;
  setCamera(transform: SceneTransform): void;
  contextLost(): void;
  unmount(): void;
};

export function createOfficeSceneAdapter(
  renderer: SceneRendererPort,
  setCanvasUnavailable: (unavailable: boolean) => void,
): OfficeSceneAdapter {
  let state: "idle" | "mounting" | "mounted" = "idle";
  let cancelMount = false;
  let entityIds = new Set<string>();

  return {
    async mount(host) {
      if (state !== "idle") throw new Error("OFFICE_SCENE_ALREADY_MOUNTED");
      state = "mounting";
      cancelMount = false;
      try {
        await renderer.mount(host);
      } catch (error) {
        state = "idle";
        throw error;
      }
      if (cancelMount) {
        renderer.clear();
        renderer.destroy();
        state = "idle";
        return;
      }
      state = "mounted";
      setCanvasUnavailable(false);
    },

    update(descriptors) {
      requireMounted(state === "mounted");
      const ordered = [...descriptors].sort(
        (left, right) => left.depth - right.depth || left.entityId.localeCompare(right.entityId),
      );
      const nextIds = new Set(ordered.map(({ entityId }) => entityId));
      for (const entityId of entityIds) {
        if (!nextIds.has(entityId)) renderer.remove(entityId);
      }
      for (const descriptor of ordered) renderer.upsert({ ...descriptor });
      renderer.sort(ordered.map(({ entityId }) => entityId));
      entityIds = nextIds;
    },

    resize(width, height) {
      requireMounted(state === "mounted");
      if (width <= 0 || height <= 0) throw new RangeError("OFFICE_SCENE_SIZE_INVALID");
      renderer.resize(width, height);
    },

    setCamera(transform) {
      requireMounted(state === "mounted");
      if (
        !Number.isFinite(transform.zoom) ||
        transform.zoom <= 0 ||
        !Number.isFinite(transform.translation.x) ||
        !Number.isFinite(transform.translation.y)
      ) {
        throw new RangeError("OFFICE_SCENE_TRANSFORM_INVALID");
      }
      renderer.transform(transform.zoom, { ...transform.translation });
    },

    contextLost() {
      requireMounted(state === "mounted");
      setCanvasUnavailable(true);
    },

    unmount() {
      if (state === "idle") return;
      if (state === "mounting") {
        cancelMount = true;
        return;
      }
      renderer.clear();
      renderer.destroy();
      entityIds = new Set();
      state = "idle";
    },
  };
}

function requireMounted(mounted: boolean): void {
  if (!mounted) throw new Error("OFFICE_SCENE_NOT_MOUNTED");
}
