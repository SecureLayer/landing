import { createServer } from "node:http";
import sirv from "sirv";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const DIST = new URL("../dist/", import.meta.url).pathname;
const PORT = 4173;
const PAGES = [
  "/",
  "/security/",
  "/sustainability/",
  "/legal/",
  "/ai-agent/",
  "/ai-security/",
];

function startServer() {
  const server = createServer(sirv(DIST, { single: false }));
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const server = await startServer();
const browser = await chromium.launch();
let failures = [];

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const route of PAGES) {
    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: "networkidle",
    });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    if (serious.length > 0) {
      failures.push({ route, violations: serious });
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error("Accessibility regressions found (serious/critical):\n");
  for (const { route, violations } of failures) {
    console.error(`  ${route}`);
    for (const v of violations) {
      console.error(
        `    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`,
      );
      console.error(`      ${v.helpUrl}`);
      for (const node of v.nodes) {
        console.error(`      - ${node.target.join(" ")}`);
        console.error(
          `        ${node.failureSummary?.replace(/\n/g, "\n        ")}`,
        );
      }
    }
  }
  process.exit(1);
} else {
  console.log(
    `Accessibility check passed — no serious/critical violations across ${PAGES.length} pages.`,
  );
}
