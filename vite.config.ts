// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRunnableDevEnvironment, createServerModuleRunnerTransport } from "vite";
import { ModuleRunner } from "vite/module-runner";

// Expand Node libuv thread pool so Windows NTFS file I/O does not bottleneck
// concurrent module resolution during dev-mode SSR compilation.
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "64";

const isBuild = process.argv.includes("build");

export default defineConfig({
  // Disable dev-mode error logger wrapper plugins to streamline SSR transform pipeline
  serverFnErrorLogger: false,
  ssrErrorLogger: false,

  tanstackStart: {
    // Redirect TanStack Start's server entry to src/server.prod.ts ONLY during production builds.
    // In dev mode (vite dev), TanStack Start uses its native dev-server runner entry.
    // Forcing server.prod into dev mode causes the module runner to attempt dynamic import
    // of pre-bundled server artifacts, resulting in 60s RPC timeouts.
    ...(isBuild ? { server: { entry: "server.prod" } } : {}),
  },
  vite: {
    server: {
      port: 8081,
    },
    // ─── Permanent Fix for Vite SSR Module Runner Timeout ────────────────────
    // In Vite 8 / Environment API, dev-mode SSR module imports communicate via
    // an internal RPC bridge (`transport.invoke("fetchModule", ...)`).
    // By default, `transport.timeout` defaults to 60,000ms. On Windows cold starts
    // with extensive route trees, module resolution can exceed 60s, triggering:
    //   "transport invoke timed out after 60000ms"
    // Setting `transport.timeout = 0` completely disables the timeout abort,
    // allowing Vite's ModuleRunner to finish compiling without failure.
    environments: {
      ssr: {
        dev: {
          createEnvironment(name, config, context) {
            return createRunnableDevEnvironment(name, config, {
              ...context,
              runner(environment, runnerOptions) {
                const transport = createServerModuleRunnerTransport({ channel: environment.hot });
                transport.timeout = 0; // 0 disables the timeout check in Vite ModuleRunner
                return new ModuleRunner({
                  ...runnerOptions,
                  transport,
                });
              },
            });
          },
        },
      },
    },

    // ─── SSR module-runner externalization ────────────────────────────────────
    // Externalizing heavy runtime and utility packages tells the runner to let Node
    // require/import them directly from disk without transforming hundreds of sub-files
    // over the dev module-runner bridge.
    ssr: {
      external: [
        "gsap",
        "gsap/ScrollTrigger",
        "lenis",
        "split-type",
        "motion",
        "lucide-react",
        "recharts",
        "zod",
        "date-fns",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
      ],
    },

    // Pre-bundle commonly-imported client packages into single cached chunks
    // so Vite serves them instantaneously to the browser without waterfall requests.
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-router",
        "@tanstack/react-query",
        "motion",
        "clsx",
        "tailwind-merge",
        "class-variance-authority",
      ],
      exclude: ["@tanstack/react-start", "gsap", "lenis", "split-type"],
    },

    plugins: [
      // ─── Background SSR Warmup ─────────────────────────────────────────────
      // Immediately compiles the server entry graph upon server startup so that
      // the first incoming browser request is served immediately from memory.
      {
        name: "plinth:ssr-warmup",
        configureServer(server) {
          server.httpServer?.once("listening", () => {
            const runner = server.environments?.ssr?.runner;
            if (runner) {
              runner.import("virtual:tanstack-start-server-entry").catch(() => {});
            }
          });
        },
      },
    ],
  },
});
