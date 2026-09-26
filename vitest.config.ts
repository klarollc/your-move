import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["**/*.unit.test.ts", "**/*.unit.test.tsx"],
          environment: "node",
          exclude: ["**/.restore/**", "**/.worktrees/**", "**/dist/**", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "component",
          include: ["**/*.component.test.tsx"],
          environment: "jsdom",
          exclude: ["**/.restore/**", "**/.worktrees/**", "**/dist/**", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["**/*.integration.test.ts"],
          environment: "node",
          exclude: ["**/.restore/**", "**/.worktrees/**", "**/dist/**", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "contract",
          include: ["**/*.contract.test.ts"],
          environment: "node",
          exclude: ["**/.restore/**", "**/.worktrees/**", "**/dist/**", "**/node_modules/**"],
        },
      },
    ],
  },
});
