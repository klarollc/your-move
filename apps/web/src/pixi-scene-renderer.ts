import { Application, Container, Graphics } from "pixi.js";

import type { SceneRendererPort } from "./office-scene-adapter.js";

export type SceneIntent = Readonly<{ type: "scene.entity.select"; entityId: string }>;

export function createPixiSceneRenderer(
  onContextLost: () => void,
  onIntent: (intent: SceneIntent) => void,
): SceneRendererPort {
  let app: Application | undefined;
  let scene: Container | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const nodes = new Map<string, Graphics>();

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    onContextLost();
  };

  return {
    async mount(host) {
      if (app) throw new Error("PIXI_SCENE_ALREADY_MOUNTED");
      const nextApp = new Application();
      await nextApp.init({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
        backgroundAlpha: 0,
        antialias: false,
        autoStart: false,
        preference: "webgl",
        resolution: 1,
      });
      const nextScene = new Container();
      nextApp.stage.addChild(nextScene);
      const nextCanvas = nextApp.canvas;
      nextCanvas.dataset.sceneRenderer = "pixi";
      nextCanvas.addEventListener("webglcontextlost", handleContextLost);
      host.appendChild(nextCanvas);
      app = nextApp;
      scene = nextScene;
      canvas = nextCanvas;
    },

    upsert(descriptor) {
      const target = requireScene(scene);
      let node = nodes.get(descriptor.entityId);
      if (!node) {
        node = new Graphics();
        node.label = descriptor.entityId;
        node.eventMode = "static";
        node.on("pointertap", () => {
          onIntent({ type: "scene.entity.select", entityId: node?.label ?? descriptor.entityId });
        });
        nodes.set(descriptor.entityId, node);
        target.addChild(node);
      }
      const palette = descriptor.entityType === "zone" ? zonePalette : agentPalette;
      node
        .clear()
        .rect(0, 0, descriptor.width, descriptor.height)
        .fill({ color: palette.fill, alpha: palette.alpha })
        .stroke({ color: palette.stroke, width: 2 });
      node.position.set(descriptor.x, descriptor.y);
      node.visible = descriptor.visible;
    },

    remove(entityId) {
      const node = nodes.get(entityId);
      if (!node) return;
      node.removeFromParent();
      node.destroy();
      nodes.delete(entityId);
    },

    sort(entityIds) {
      const target = requireScene(scene);
      entityIds.forEach((entityId, index) => {
        const node = nodes.get(entityId);
        if (node) target.setChildIndex(node, index);
      });
      app?.render();
    },

    resize(width, height) {
      const target = requireApp(app);
      target.renderer.resize(width, height);
      target.render();
    },

    clear() {
      for (const node of nodes.values()) {
        node.removeFromParent();
        node.destroy();
      }
      nodes.clear();
    },

    destroy() {
      canvas?.removeEventListener("webglcontextlost", handleContextLost);
      app?.destroy({ removeView: true }, { children: true, context: true });
      app = undefined;
      scene = undefined;
      canvas = undefined;
    },
  };
}

const zonePalette = { fill: 0xcfd2cf, stroke: 0x676b68, alpha: 0.72 } as const;
const agentPalette = { fill: 0xf2f1eb, stroke: 0x292c2a, alpha: 1 } as const;

function requireScene(scene: Container | undefined): Container {
  if (!scene) throw new Error("PIXI_SCENE_NOT_MOUNTED");
  return scene;
}

function requireApp(app: Application | undefined): Application {
  if (!app) throw new Error("PIXI_SCENE_NOT_MOUNTED");
  return app;
}
