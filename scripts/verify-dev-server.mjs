import { createServer } from "vite";

async function main() {
  console.log("=== PLINTH Dev Server SSR Verification ===");
  const t0 = Date.now();

  console.log("Creating dev server from project configuration (vite.config.ts)...");
  const server = await createServer();
  await server.listen();
  console.log(`Server started in ${Date.now() - t0}ms`);

  console.log("Loading virtual:tanstack-start-server-entry via SSR module runner...");
  const tImport = Date.now();
  const entry = await server.environments.ssr.runner.import("virtual:tanstack-start-server-entry");
  console.log(`SSR entry loaded in ${Date.now() - tImport}ms!`);

  console.log("\n>>> Executing SSR render for homepage: GET / ...");
  const tFetch1 = Date.now();
  const req1 = new Request("http://localhost:8081/", {
    headers: { accept: "text/html" },
  });
  const res1 = await entry.default.fetch(req1);
  const html1 = await res1.text();
  console.log(`>>> Status: ${res1.status} (rendered in ${Date.now() - tFetch1}ms)`);
  console.log(`>>> HTML length: ${html1.length} bytes`);
  console.log(">>> HTML sample:");
  console.log(html1.slice(0, 300));

  if (res1.status !== 200) {
    throw new Error(`Expected HTTP 200 on / but received ${res1.status}`);
  }
  if (!html1.includes("<html") || !html1.includes("PLINTH")) {
    throw new Error("Rendered HTML does not contain expected SSR root markup");
  }

  console.log("\n>>> Executing SSR render for Floor Planner: GET /app/floor-planner ...");
  const tFetchFp = Date.now();
  const reqFp = new Request("http://localhost:8081/app/floor-planner", {
    headers: { accept: "text/html" },
  });
  const resFp = await entry.default.fetch(reqFp);
  const htmlFp = await resFp.text();
  console.log(`>>> Status: ${resFp.status} (rendered in ${Date.now() - tFetchFp}ms)`);
  console.log(`>>> Floor Planner HTML length: ${htmlFp.length} bytes`);

  if (resFp.status !== 200) {
    throw new Error(`Expected HTTP 200 on /app/floor-planner but received ${resFp.status}`);
  }

  console.log("\n>>> Executing second render for homepage: GET / (cached in-memory) ...");
  const tFetch2 = Date.now();
  const res2 = await entry.default.fetch(req1);
  const html2 = await res2.text();
  console.log(`>>> Status: ${res2.status} (rendered in ${Date.now() - tFetch2}ms)`);

  await server.close();
  console.log("\n=== ALL DEV SSR VERIFICATIONS PASSED 100%! ===");
  process.exit(0);
}

main().catch(err => {
  console.error("\n*** VERIFICATION FAILED ***", err);
  process.exit(1);
});
