import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import sirv from "sirv";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const DIST = new URL("../dist/", import.meta.url).pathname;
const DATA = JSON.parse(
  readFileSync(new URL("../src/data/what-we-do.json", import.meta.url), "utf8"),
);
const PORT = 4175;
const PAGE_URL = `http://localhost:${PORT}/what-we-do/`;
const HASHES = [
  "helpinvestors",
  "raisecompanyvalue",
  "helpsecurityteams",
  "secureaiagents",
  "helpafterincident",
  "checkcompliance",
];

const server = await new Promise((resolve) => {
  const s = createServer(sirv(DIST, { single: false }));
  s.listen(PORT, () => resolve(s));
});
const browser = await chromium.launch();
let failed = false;
const pageErrors = [];

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed = true;
  } else {
    console.log(`PASS: ${message}`);
  }
}

async function open(options, hash = "") {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(PAGE_URL + hash, { waitUntil: "networkidle" });
  return { context, page };
}

const activePath = (page) =>
  page.evaluate(
    () => document.querySelector(".wdwd-path.is-active")?.id ?? null,
  );
const activeSlide = (page) =>
  page.evaluate(() => {
    const s = document.querySelector(
      ".wdwd-path.is-active .wdwd-slide.is-active",
    );
    return s ? Number(s.getAttribute("data-index")) : null;
  });
const chooserActive = (page) =>
  page.evaluate(
    () =>
      document
        .getElementById("wdwd-chooser")
        ?.classList.contains("is-active") &&
      !document.querySelector(".wdwd-path.is-active"),
  );
// hashchange is asynchronous, so after any click/back/keypress that changes
// the hash, wait for the state instead of reading it immediately.
const waitFor = (page, fn, arg) =>
  page
    .waitForFunction(fn, arg, { timeout: 2000 })
    .then(() => true)
    .catch(() => false);
const waitChooser = (page) =>
  waitFor(
    page,
    () =>
      document
        .getElementById("wdwd-chooser")
        ?.classList.contains("is-active") &&
      !document.querySelector(".wdwd-path.is-active"),
  );
const waitPath = (page, id) =>
  waitFor(
    page,
    (want) => document.querySelector(".wdwd-path.is-active")?.id === want,
    id,
  );
const overflowX = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

try {
  // --- data shape -------------------------------------------------------
  assert(DATA.doors.length === 6, "data has six doors");
  assert(
    JSON.stringify(DATA.doors.map((d) => d.id).sort()) ===
      JSON.stringify([...HASHES].sort()),
    "door ids are exactly the six agreed deep-link hashes",
  );
  assert(
    DATA.doors.every((d) => d.slides.length === 3),
    "every door has exactly three slides",
  );
  assert(
    DATA.doors.every((d) => /^[a-z]+$/.test(d.id)),
    "door ids are lowercase letters only",
  );

  assert(
    DATA.doors.every(
      (d) =>
        Array.isArray(d.proposals) &&
        d.proposals.length === 3 &&
        d.proposals.every((x) => typeof x === "string" && x.trim().length > 0),
    ),
    "every door has exactly three non-empty proposals",
  );

  // --- the old URL is deliberately NOT redirected (owner decision 2026-10-07)
  {
    const file = new URL("../dist/_redirects", import.meta.url);
    const redirects = existsSync(file) ? readFileSync(file, "utf8") : "";
    assert(
      !/what-do-we-do/.test(redirects),
      "no redirect for the old /what-do-we-do URL ships",
    );
    assert(
      !existsSync(new URL("../dist/what-do-we-do/", import.meta.url)),
      "no page is built at the old /what-do-we-do path",
    );
  }

  // --- first-slide label: owner wording, not "WHAT YOU SEE" ----------------
  {
    const kickers = DATA.doors.map((d) => d.slides[0].kicker);
    assert(
      !kickers.includes("WHAT YOU SEE"),
      'no first slide is labelled "WHAT YOU SEE" any more',
    );
    assert(
      DATA.doors.every(
        (d) =>
          d.slides[0].kicker ===
          (d.id === "helpafterincident" ? "FIRST" : "WHAT YOU NEED TO ADDRESS"),
      ),
      'first slides read "WHAT YOU NEED TO ADDRESS" (the incident path keeps "FIRST")',
    );
  }

  // --- first-slide headings answer the question (owner wording, 2026-10-07) -
  {
    const OLD = [
      "A balance sheet can't show a cyber loss until it happens.",
      "The first time someone asks you to prove your cybersecurity level.",
      "Too many alerts, too few hands.",
      "An agent can be talked into almost anything.",
      "Stop. Don't wipe anything.",
      "New rules turn gaps into liabilities.",
    ];
    const headings = DATA.doors.map((d) => d.slides[0].heading);
    assert(
      OLD.every((h) => !headings.includes(h)),
      "the six old first-slide headings are gone",
    );
    assert(
      DATA.doors.find((d) => d.id === "helpinvestors").slides[0].heading ===
        "Identify risks and prevent cybersecurity-related losses before they happen.",
      "the investor path uses the owner's heading verbatim",
    );
    assert(
      DATA.doors.every((d) => d.slides.every((sl) => /[.]$/.test(sl.heading))),
      "every slide heading ends with a full stop (house style, slides 1-3)",
    );
  }

  // --- second slide: concrete-work example; the "why us" block moved to /why-us/ ---
  assert(
    DATA.whyUs === undefined,
    "the 'why us' sentence is no longer in this page's data (it has its own page)",
  );
  assert(
    DATA.doors.every(
      (d) =>
        typeof d.slides[1].example === "string" &&
        d.slides[1].example.trim().length > 0 &&
        d.slides[1].body === undefined &&
        d.slides[0].example === undefined &&
        d.slides[2].example === undefined,
    ),
    'every path has its "example of concrete work" on the second slide only (it replaces that slide\'s body)',
  );
  assert(
    DATA.proofLine === undefined && DATA.seenBefore === undefined,
    'the "10+ years as a security expert" line and the "Seen before" row are gone from the data',
  );
  assert(
    DATA.doors.find((d) => d.id === "helpsecurityteams").slides[1].example ===
      "We improve detection and response playbooks, based on real incident work.",
    "the security-team example is the owner's sentence verbatim",
  );
  assert(
    DATA.doors.every((d) => d.slides[2].kicker === "WHAT IT CHANGES FOR YOU"),
    'every third slide is labelled "WHAT IT CHANGES FOR YOU"',
  );

  // --- investor path wording (owner, 2026-10-07) ---------------------------
  {
    const investors = DATA.doors.find((d) => d.id === "helpinvestors");
    assert(
      investors.slides[0].body ===
        "A data leak, a critical vulnerability not fixed: each one lands on the buyer after closing.",
      "investor first slide body uses the owner's wording",
    );
    assert(
      investors.slides[1].example ===
        "We test how the company responds to an incident, not just which policies exist.",
      "investor second slide example uses the owner's wording",
    );
    assert(
      !/ransomware|fraudulent transfer/i.test(investors.slides[0].body),
      "the old risk list (ransomware, fraudulent transfer) is gone from the investor body",
    );
  }

  // --- owner wording round of 2026-10-07 (exact strings) --------------------
  {
    const door = (id) => DATA.doors.find((d) => d.id === id);
    const want = [
      [
        door("raisecompanyvalue").slides[1].example,
        "We perform a practical review of what attackers and due-diligence teams would find, then we provide a short fix list in priority order.",
        "founders: second slide example",
      ],
      [
        door("helpsecurityteams").slides[2].body,
        "Clear owners, tested runbooks and fewer surprises.",
        "security teams: third slide body",
      ],
      [
        door("secureaiagents").slides[1].example,
        "Test input path, permissions to understand what an attacker can gain.",
        "AI agents: second slide example",
      ],
      [
        door("helpafterincident").slides[0].body,
        "Act quickly and efficiently.",
        "incident: first slide body",
      ],
      [
        door("helpafterincident").slides[1].example,
        "Isolate the affected machines from the network, keep them powered and write down what you saw and when.",
        "incident: second slide example",
      ],
      [
        door("checkcompliance").slides[1].example,
        "We identify what applies to your business, what is already done and what to do first.",
        "compliance: second slide example",
      ],
    ];
    for (const [got, exp, label] of want)
      assert(got === exp, `${label} uses the owner's wording`);
  }

  // --- no JavaScript: everything stacked and readable --------------------
  {
    const { context, page } = await open({ javaScriptEnabled: false });
    const paths = page.locator(".wdwd-path");
    assert((await paths.count()) === 6, "no-JS: six paths in the page");
    let allVisible = true;
    for (let i = 0; i < 6; i++)
      allVisible = allVisible && (await paths.nth(i).isVisible());
    assert(allVisible, "no-JS: every path is visible");
    assert(
      (await page.locator(".wdwd-slide").count()) === 18,
      "no-JS: 18 slides rendered",
    );
    assert(
      (await page
        .locator('a.wdwd-cta[href="https://cal.com/securelayer"]')
        .count()) === 6,
      "no-JS: one call button per path",
    );
    assert(
      (await page.locator("a.wdwd-door").count()) === 6,
      "no-JS: six chooser links",
    );
    const bodyText = await page.evaluate(() => document.body.innerText);
    assert(
      !/10\+ years as a security expert/i.test(bodyText) &&
        !/seen before/i.test(bodyText),
      'the page no longer shows the "security expert" line or "Seen before"',
    );
    assert(
      (await page.evaluate(() =>
        document.documentElement.classList.contains("wdwd-js"),
      )) === false,
      "no-JS: wdwd-js class is absent",
    );
    await context.close();
  }

  // --- no JavaScript + deep link lands on that section (Review Focus 5) ---
  {
    const { context, page } = await open(
      { javaScriptEnabled: false },
      "#helpafterincident",
    );
    const measure = () =>
      page.evaluate(() => {
        const r = document
          .getElementById("helpafterincident")
          .getBoundingClientRect();
        return {
          top: Math.round(r.top),
          scrollY: Math.round(window.scrollY),
          docHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        };
      });
    const first = await measure();
    // diagnostics only (does not change the result): did the section move after
    // the first measurement, e.g. a late font swap shifting the content above it?
    await page.waitForTimeout(1500);
    const later = await measure();
    // The browser scrolls to the anchor while the page still uses fallback fonts; when
    // the web fonts arrive the content above shrinks and the section ends up a little
    // above the viewport top (CI/Linux measured -55px). Landing within DRIFT px of the
    // section's top edge, with the section on screen, still counts as "scrolled to it".
    const DRIFT = 150;
    const inView = first.top >= -DRIFT && first.top < first.innerHeight;
    assert(
      inView,
      `no-JS: deep link scrolls to its path section (top ${first.top}, scrollY ${first.scrollY}, page ${first.docHeight}px, viewport ${first.viewport}; 1.5s later: top ${later.top}, scrollY ${later.scrollY}, page ${later.docHeight}px)`,
    );
    await context.close();
  }

  // --- chooser is the default; unknown/empty/malformed hashes ------------
  for (const hash of ["", "#nonsense", "#wdwd-chooser", "#%E0%A4%A"]) {
    const { context, page } = await open({}, hash);
    assert(
      (await chooserActive(page)) === true,
      `hash "${hash}" shows the chooser`,
    );
    assert(
      await page.evaluate(() =>
        document.documentElement.classList.contains("wdwd-js"),
      ),
      `hash "${hash}": deck is enhanced`,
    );
    await context.close();
  }

  // --- each box answers the question with its three proposals -----------
  {
    const { context, page } = await open({});
    for (const door of DATA.doors) {
      const link = page.locator(`a.wdwd-door[href="#${door.id}"]`);
      const items = await link.locator("li").allTextContents();
      assert(
        JSON.stringify(items.map((t) => t.trim())) ===
          JSON.stringify(door.proposals),
        `#${door.id}: the box lists its three proposals in order`,
      );
      // The name comes from the visible content (tag, label, proposals), so
      // every visible word is in it (WCAG 2.5.3, axe label-content-name-mismatch).
      const name = await link.evaluate((el) =>
        el.textContent.replace(/\s+/g, " ").trim(),
      );
      assert(
        name.includes(door.label) &&
          door.proposals.every((x) => name.includes(x)),
        `#${door.id}: the link's accessible name holds its label and proposals`,
      );
      assert(
        (await page.getByRole("link", { name: door.label }).count()) === 1,
        `#${door.id}: the link is found by its label`,
      );
    }
    await context.close();
  }

  // --- the longer boxes fit on any phone, with JavaScript on and off -----
  for (const width of [360, 390, 430]) {
    for (const js of [true, false]) {
      const { context, page } = await open({
        viewport: { width, height: 844 },
        javaScriptEnabled: js,
      });
      const clipped = await page.$$eval(
        "a.wdwd-door",
        (as) => as.filter((a) => a.scrollWidth > a.clientWidth + 1).length,
      );
      assert(
        (await overflowX(page)) <= 0 && clipped === 0,
        `${width}px${js ? "" : " (no JS)"}: chooser boxes fit, nothing overflows or is clipped`,
      );
      await context.close();
    }
  }

  // --- with a path open, the card is as tall as that path, not as the chooser
  //     (the hidden chooser is the tallest section on phones)
  for (const width of [360, 390, 430]) {
    const { context, page } = await open(
      { viewport: { width, height: 844 }, hasTouch: true, isMobile: true },
      "#helpinvestors",
    );
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => ({
      stage: document.getElementById("wdwd-stage").getBoundingClientRect()
        .height,
      nextBottom: document.querySelector(".wdwd-next").getBoundingClientRect()
        .bottom,
      vh: window.innerHeight,
    }));
    assert(
      m.stage <= 760 && m.nextBottom <= m.vh,
      `${width}px: with a path open the card stays compact and the arrows are on screen (card ${Math.round(m.stage)}px, arrows end at ${Math.round(m.nextBottom)}px of ${m.vh}px)`,
    );
    await context.close();
  }

  // --- navigating must never scroll the card sideways (text stays inside its
  //     padding): scrolling the new heading into view runs while the slide is
  //     still sliding in from the right
  for (const width of [360, 390, 430, 1280]) {
    const { context, page } = await open({
      viewport: { width, height: width > 700 ? 760 : 780 },
      hasTouch: width < 700,
      isMobile: width < 700,
    });
    await page.locator('a.wdwd-door[href="#raisecompanyvalue"]').click();
    await page.waitForTimeout(900);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const stage = document.getElementById("wdwd-stage");
      const h = document
        .querySelector(".wdwd-path.is-active .wdwd-slide.is-active h3")
        .getBoundingClientRect();
      return {
        scrollLeft: stage.scrollLeft,
        inset: h.left - stage.getBoundingClientRect().left,
      };
    });
    assert(
      m.scrollLeft === 0 && m.inset >= 15,
      `${width}px: after a door click and Next the card is not scrolled sideways (scrollLeft ${m.scrollLeft}, text ${Math.round(m.inset)}px from the card edge)`,
    );
    // "Change my answer" is an anchor jump to the chooser, which is still sliding in
    // from the right: it used to scroll the card ~17px sideways (chooser off-centre)
    await page.locator(".wdwd-path.is-active .wdwd-again").click();
    await page.waitForTimeout(900);
    const back = await page.evaluate(() => {
      const stage = document.getElementById("wdwd-stage");
      const chooser = document.getElementById("wdwd-chooser");
      return {
        scrollLeft: stage.scrollLeft,
        offset: Math.round(
          chooser.getBoundingClientRect().left -
            stage.getBoundingClientRect().left,
        ),
      };
    });
    assert(
      back.scrollLeft === 0 && back.offset === 0,
      `${width}px: back on the chooser via "Change my answer" it is centred, not scrolled sideways (scrollLeft ${back.scrollLeft}, offset ${back.offset}px)`,
    );
    await context.close();
  }

  // --- the new blocks are on screen, second slide only ----------------------
  {
    const { context, page } = await open({ javaScriptEnabled: false });
    for (const door of DATA.doors) {
      const second = page.locator(`#${door.id} .wdwd-slide[data-index="1"]`);
      const blocks = await second
        .locator(".wdwd-extra")
        .evaluateAll((els) => els.map((e) => e.innerText));
      // the labels are upper-cased by CSS, so compare case-insensitively
      const flat = blocks.map((t) =>
        t.replace(/\s+/g, " ").trim().toLowerCase(),
      );
      assert(
        flat.length === 1 &&
          flat[0] ===
            `Example of concrete work ${door.slides[1].example}`.toLowerCase(),
        `#${door.id}: second slide shows only "Example of concrete work" with the data text`,
      );
      assert(
        (await page
          .locator(`#${door.id} .wdwd-slide:not([data-index="1"]) .wdwd-extra`)
          .count()) === 0,
        `#${door.id}: the example block appears on the second slide only`,
      );
      assert(
        (await second.locator(".wdwd-body").count()) === 0,
        `#${door.id}: the second slide has no separate body line (the example replaces it)`,
      );
      assert(
        (
          await page
            .locator(`#${door.id} .wdwd-slide[data-index="2"] .wdwd-k`)
            .first()
            .textContent()
        ).trim() === "WHAT IT CHANGES FOR YOU",
        `#${door.id}: third slide label reads "WHAT IT CHANGES FOR YOU"`,
      );
    }
    await context.close();
  }

  // --- first slides stay inside the card on every phone, all six paths -----
  for (const width of [360, 390, 430]) {
    for (const door of DATA.doors) {
      const { context, page } = await open(
        { viewport: { width, height: 844 }, hasTouch: true, isMobile: true },
        `#${door.id}`,
      );
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => ({
        over: document.documentElement.scrollWidth - window.innerWidth,
        stage: document.getElementById("wdwd-stage").getBoundingClientRect()
          .height,
        nextBottom: document.querySelector(".wdwd-next").getBoundingClientRect()
          .bottom,
        vh: window.innerHeight,
      }));
      assert(
        m.over <= 0 && m.stage <= 800 && m.nextBottom <= m.vh,
        `${width}px #${door.id}: first slide fits (card ${Math.round(m.stage)}px, arrows end ${Math.round(m.nextBottom)}/${m.vh}px)`,
      );
      await context.close();
    }
  }

  // --- second slides stay inside the card on every phone, all six paths -----
  for (const width of [360, 390, 430]) {
    for (const door of DATA.doors) {
      const { context, page } = await open(
        { viewport: { width, height: 844 }, hasTouch: true, isMobile: true },
        `#${door.id}`,
      );
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => ({
        over: document.documentElement.scrollWidth - window.innerWidth,
        stage: document.getElementById("wdwd-stage").getBoundingClientRect()
          .height,
        nextBottom: document.querySelector(".wdwd-next").getBoundingClientRect()
          .bottom,
        vh: window.innerHeight,
      }));
      assert(
        m.over <= 0 && m.stage <= 800 && m.nextBottom <= m.vh,
        `${width}px #${door.id}: second slide fits (card ${Math.round(m.stage)}px, arrows end ${Math.round(m.nextBottom)}/${m.vh}px)`,
      );
      await context.close();
    }
  }

  // --- phones: readable text, and every slide fits one screen (no scrolling) -
  //     sizes are the visible page area of real phones (browser bars removed)
  for (const [width, height] of [
    [360, 640],
    [360, 732],
    [390, 780],
    [412, 820],
    [430, 860],
  ]) {
    const { context, page } = await open({
      viewport: { width, height },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });
    const problems = [];
    let worst = { heading: 999, body: 999 };
    for (const door of DATA.doors) {
      await page.goto(`${PAGE_URL}#${door.id}`, { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      for (let slide = 0; slide < 3; slide++) {
        if (slide > 0) await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(650);
        const m = await page.evaluate(() => {
          const sl = document.querySelector(
            ".wdwd-path.is-active .wdwd-slide.is-active",
          );
          const fs = (sel) => {
            const e = sl.querySelector(sel);
            return e ? parseFloat(getComputedStyle(e).fontSize) : null;
          };
          return {
            scrollH: document.documentElement.scrollHeight,
            vh: window.innerHeight,
            over: document.documentElement.scrollWidth - window.innerWidth,
            nextBottom: document
              .querySelector(".wdwd-next")
              .getBoundingClientRect().bottom,
            heading: fs("h3"),
            body: fs(".wdwd-body") ?? fs(".wdwd-extra p:last-child"),
            kicker: fs(".wdwd-k"),
            clipped: [...sl.querySelectorAll("h3, p")].some(
              (e) =>
                e.getBoundingClientRect().bottom >
                document.getElementById("wdwd-stage").getBoundingClientRect()
                  .bottom,
            ),
          };
        });
        const tag = `${door.id}#${slide + 1}`;
        if (m.scrollH > m.vh + 1)
          problems.push(`${tag} needs scrolling (${m.scrollH}>${m.vh})`);
        if (m.over > 0) problems.push(`${tag} overflows sideways`);
        if (m.nextBottom > m.vh) problems.push(`${tag} arrows off screen`);
        if (m.clipped) problems.push(`${tag} text clipped by the card`);
        worst.heading = Math.min(worst.heading, m.heading);
        worst.body = Math.min(worst.body, m.body);
        if (width === 360 && height >= 700) {
          if (m.heading < 28)
            problems.push(`${tag} heading ${m.heading}px < 28px`);
          if (m.body < 16) problems.push(`${tag} body ${m.body}px < 16px`);
          if (m.kicker < 12) problems.push(`${tag} label ${m.kicker}px < 12px`);
        }
      }
    }
    assert(
      problems.length === 0,
      `${width}x${height}: all 18 slides fit one screen with readable text (smallest heading ${worst.heading}px, body ${worst.body}px)${problems.length ? " — " + problems.slice(0, 4).join("; ") : ""}`,
    );
    await context.close();
  }

  // --- every deep link opens its path at slide 0 -------------------------
  for (const id of HASHES) {
    const { context, page } = await open({}, `#${id}`);
    assert((await activePath(page)) === id, `#${id} opens its path`);
    assert((await activeSlide(page)) === 0, `#${id} starts on slide 1`);
    await context.close();
  }

  // --- case-insensitive hash (Review Focus 1) ----------------------------
  {
    const { context, page } = await open({}, "#HelpInvestors");
    assert(
      (await activePath(page)) === "helpinvestors",
      "#HelpInvestors opens the investor path",
    );
    await context.close();
  }

  // --- click, keyboard, clamp, live region, focus ------------------------
  {
    const { context, page } = await open({});
    await page.locator('a.wdwd-door[href="#helpinvestors"]').click();
    assert(await waitPath(page, "helpinvestors"), "click opens the path");
    await page.keyboard.press("ArrowRight");
    assert((await activeSlide(page)) === 1, "ArrowRight goes to slide 2");
    assert(
      /Slide 3 of 4/.test(await page.locator("#wdwd-live").textContent()),
      "live region announces the new slide",
    );
    assert(
      (await page.evaluate(() => document.activeElement?.tagName)) === "H3",
      "focus moves to the new slide heading",
    );
    assert(
      (await page.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle,
      )) === "none",
      "programmatically focused heading shows no focus box",
    );
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    assert(
      (await activeSlide(page)) === 2,
      "extra ArrowRight presses clamp at the last slide",
    );
    assert(
      await page.locator(".wdwd-path.is-active a.wdwd-cta").isVisible(),
      "call button is visible on the last slide",
    );
    await page.keyboard.press("ArrowLeft");
    assert((await activeSlide(page)) === 1, "ArrowLeft goes back one slide");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    assert(
      await waitChooser(page),
      "ArrowLeft from the first slide returns to the chooser",
    );
    await context.close();
  }

  // --- Back button (Review Focus 2) and "Change my answer" ---------------
  {
    const { context, page } = await open({});
    await page.locator('a.wdwd-door[href="#helpafterincident"]').click();
    assert(await waitPath(page, "helpafterincident"), "door opens");
    await page.goBack();
    assert(await waitChooser(page), "browser Back returns to the chooser");
    await page.waitForTimeout(700);
    assert(
      (await page.locator(".wdwd-slide:visible").count()) === 0,
      "after Back no slide of the previous path stays visible",
    );
    await page.locator('a.wdwd-door[href="#checkcompliance"]').click();
    assert(await waitPath(page, "checkcompliance"), "second door opens");
    await page.locator(".wdwd-path.is-active .wdwd-again").click();
    assert(
      await waitChooser(page),
      '"Change my answer" returns to the chooser',
    );
    await context.close();
  }

  // --- keyboard-only door selection --------------------------------------
  {
    const { context, page } = await open({});
    await page.locator("a.wdwd-door").first().focus();
    await page.keyboard.press("Enter");
    assert(
      await waitPath(page, DATA.doors[0].id),
      "Enter on a focused door opens its path",
    );
    await context.close();
  }

  // --- reduced motion ----------------------------------------------------
  {
    const { context, page } = await open({ reducedMotion: "reduce" });
    await page.locator("a.wdwd-door").first().click();
    await waitPath(page, DATA.doors[0].id);
    const duration = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".wdwd-path.is-active"))
          .transitionDuration,
    );
    assert(duration === "0s", "reduced motion removes slide transitions");
    await context.close();
  }

  // --- mobile: no horizontal overflow on any path's last slide -----------
  {
    const { context, page } = await open({
      viewport: { width: 390, height: 844 },
    });
    assert(
      (await overflowX(page)) <= 0,
      "390px: chooser has no horizontal overflow",
    );
    for (const id of HASHES) {
      await page.goto(`${PAGE_URL}#${id}`, { waitUntil: "networkidle" });
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      const ok = (await overflowX(page)) <= 0;
      const ctaRight = await page.evaluate(
        () =>
          document
            .querySelector(".wdwd-path.is-active a.wdwd-cta")
            ?.getBoundingClientRect().right ?? 0,
      );
      assert(ok && ctaRight <= 390, `390px: #${id} last slide fits the screen`);
    }
    await context.close();
  }

  // --- resize mid-deck (Review Focus 4) ----------------------------------
  {
    const { context, page } = await open(
      { viewport: { width: 1280, height: 760 } },
      "#helpinvestors",
    );
    await page.keyboard.press("ArrowRight");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert(
      await page
        .locator(".wdwd-path.is-active .wdwd-slide.is-active")
        .isVisible(),
      "resize: active slide stays visible",
    );
    assert((await overflowX(page)) <= 0, "resize: no horizontal overflow");
    await context.close();
  }

  // --- short screen: Next must leave the new heading on screen ----------
  {
    const { context, page } = await open(
      { viewport: { width: 844, height: 390 } },
      "#helpinvestors",
    );
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator(".wdwd-next").click();
    await page.waitForTimeout(600);
    const box = await page.evaluate(() => {
      const r = document
        .querySelector(".wdwd-path.is-active .wdwd-slide.is-active h3")
        .getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    assert(
      box.top >= -1 && box.bottom <= box.vh + 1,
      "short screen: heading is on screen after pressing Next",
    );
    await context.close();
  }

  // --- every page's footer has two links: Home and Legal -------------------
  for (const [label, js] of [
    ["deck", true],
    ["stacked", false],
  ]) {
    const { context, page } = await open({ javaScriptEnabled: js });
    assert(
      JSON.stringify(
        (await page.locator("footer nav a").allInnerTexts()).map((x) =>
          x.trim(),
        ),
      ) === JSON.stringify(["Home", "Legal"]),
      `${label} view: the footer has two links, Home and Legal`,
    );
    assert(
      await page
        .locator('footer a[href="/sustainability/"] img[src="/gwf-badge.png"]')
        .isVisible(),
      `${label} view: the green-hosting badge sits under the Home link`,
    );
    await context.close();
  }
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    for (const route of [
      "/why-us/",
      "/security/",
      "/sustainability/",
      "/ai-security/",
      "/ai-agent/",
    ]) {
      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: "networkidle",
      });
      const texts = await page
        .locator("footer .footer-links a, footer.wdwd-foot nav a")
        .allInnerTexts();
      assert(
        JSON.stringify(texts.map((x) => x.trim())) ===
          JSON.stringify(["Home", "Legal"]),
        `${route}: the footer text links are Home and Legal`,
      );
      assert(
        (await page
          .locator('a[href^="/sustainability"] img[src="/gwf-badge.png"]')
          .count()) === 1,
        `${route}: the green-hosting badge is there`,
      );
    }
    {
      // /ai-agent collects the ticket text, so the privacy notice is next to the input
      await page.goto(`http://localhost:${PORT}/ai-agent/`, {
        waitUntil: "networkidle",
      });
      const line = page.locator("#ab-form .ab-privacy");
      assert(
        (await line.isVisible()) &&
          (await line.locator('a[href="/privacy"]').isVisible()) &&
          /sent to an AI service/.test(await line.innerText()) &&
          /personal data/.test(await line.innerText()),
        "/ai-agent: a short privacy line with a link to /privacy sits under the ticket box",
      );
    }
    for (const route of ["/legal/", "/privacy/"]) {
      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: "networkidle",
      });
      assert(
        (await page.locator("footer a").count()) === 0,
        `${route}: no footer links (it has its own back-home line)`,
      );
      assert(
        await page
          .locator('a[href^="/sustainability"] img[src="/gwf-badge.png"]')
          .isVisible(),
        `${route}: the green-hosting badge is there`,
      );
    }
    await context.close();
  }

  // --- homepage: two shortcuts on desktop, one card on mobile -------------
  {
    const home = async (options) => {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(`http://localhost:${PORT}/`, {
        waitUntil: "networkidle",
      });
      return { context, page };
    };

    const d = await home({ viewport: { width: 1440, height: 900 } });
    await d.page.locator(".d-lock-input").focus();
    await d.page.keyboard.press("Enter");
    await d.page.waitForTimeout(2200);
    assert(
      (await d.page.locator("a.widget-file").count()) === 3,
      "desktop: exactly three file shortcuts",
    );
    for (const [href, label] of [
      ["/what-we-do/", "What do you need?"],
      ["/why-us/", "Why choose us?"],
      ["/ai-agent/", "Can you break our AI agent?"],
    ]) {
      const icon = d.page.locator(`a.widget-file[href="${href}"]`);
      assert((await icon.count()) === 1, `desktop: one shortcut to ${href}`);
      assert(
        (await icon.getAttribute("target")) === null,
        `desktop: the ${href} shortcut opens in the same tab`,
      );
      assert(
        (await icon.locator("span").textContent())?.trim() === label,
        `desktop: the ${href} shortcut is labelled "${label}"`,
      );
      assert(
        await icon.isVisible(),
        `desktop: the ${href} shortcut is visible`,
      );
    }
    {
      const a = await d.page
        .locator('a.widget-file[href="/what-we-do/"]')
        .boundingBox();
      const b = await d.page
        .locator('a.widget-file[href="/why-us/"]')
        .boundingBox();
      assert(
        b.x + b.width < a.x && a.y === b.y,
        "desktop: the two shortcuts sit side by side, Why choose us? on the left",
      );
      const c = await d.page
        .locator('a.widget-file[href="/ai-agent/"]')
        .boundingBox();
      const note = await d.page.locator(".widget-note").boundingBox();
      const cx = c.x + c.width / 2;
      assert(
        c.y >= note.y + note.height &&
          cx > note.x &&
          cx < note.x + note.width &&
          c.x + c.width < a.x,
        "desktop: the AI agent shortcut sits just under the yellow note, clear of the other two files",
      );
    }
    assert(
      (await d.page.locator('a[href$=".pdf"]').count()) === 0,
      "desktop: nothing on the homepage links to a PDF",
    );
    // the cleanup of the old PDF icons must not take other widgets' CSS with it
    assert(
      (await d.page.evaluate(
        () => getComputedStyle(document.querySelector(".widget-note")).width,
      )) === "265px",
      "desktop: the sticky note keeps its styling",
    );
    assert(
      (await d.page.evaluate(
        () =>
          getComputedStyle(document.querySelector(".widget-todo-item")).display,
      )) === "flex",
      "desktop: the Reminders list keeps its styling",
    );
    assert(
      (await d.page.locator(".d-links").count()) === 0,
      "desktop: no link wording on the homepage scene (the visitor finds the pages through the icons)",
    );
    await d.context.close();

    const m = await home({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    await m.page.locator("#mStand").click();
    await m.page.waitForTimeout(1800);
    const card = m.page.locator("a.m-card-file");
    assert((await card.count()) === 1, "mobile: exactly one file card");
    assert(
      (await card.first().getAttribute("href")) === "/what-we-do/",
      "mobile: the card points to /what-we-do/",
    );
    assert(
      (await card.first().getAttribute("target")) === null,
      "mobile: the card opens in the same tab",
    );
    assert(
      (await m.page.locator(".m-card-file-bar").count()) === 0,
      "mobile: the card has no bar under the label",
    );
    {
      const title = (await card.first().locator("h3").textContent())?.trim();
      const text = (await card.first().locator("p").innerText())
        .replace(/\s+/g, " ")
        .trim();
      assert(
        title === "What do you need from cybersecurity?" &&
          text === "A review, a recommendation, a solution, a plan...?",
        'mobile: the card asks "What do you need from cybersecurity?" and lists review, recommendation, solution, plan',
      );
    }
    assert(await card.first().isVisible(), "mobile: the card is visible");
    assert(
      (await m.page.locator('a[href$=".pdf"]').count()) === 0,
      "mobile: nothing on the homepage links to a PDF",
    );
    await m.context.close();

    // the four tiles sit in two rows of equal halves (12px gap), all the same height
    // (212px, set by the text of the tallest tile), on any phone
    for (const width of [360, 390, 430]) {
      const phone = await home({
        viewport: { width, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      await phone.page.locator("#mStand").click();
      await phone.page.waitForTimeout(1800);
      assert(
        (await phone.page.locator(".m-row2").count()) === 3,
        `${width}px: three rows of tiles (the last one holds the AI agent tile and the social box)`,
      );
      for (const r of [0, 1]) {
        const row = await phone.page.locator(".m-row2").nth(r).boundingBox();
        const left = await phone.page
          .locator(".m-row2")
          .nth(r)
          .locator("> a")
          .nth(0)
          .boundingBox();
        const right = await phone.page
          .locator(".m-row2")
          .nth(r)
          .locator("> a")
          .nth(1)
          .boundingBox();
        assert(
          Math.abs(left.x - row.x) <= 1 &&
            Math.abs(left.x + left.width + 12 - right.x) <= 1 &&
            Math.abs(left.width - right.width) <= 1 &&
            Math.abs(right.x + right.width - (row.x + row.width)) <= 1 &&
            Math.abs(left.height - right.height) <= 1 &&
            left.height >= 211,
          `${width}px: row ${r + 1} is two equal halves of the same height (at least 212px) (${Math.round(left.width)}x${Math.round(left.height)} + ${Math.round(right.width)}x${Math.round(right.height)} in ${Math.round(row.width)})`,
        );
      }
      {
        // third row: the AI agent tile (left) and the social box (right), equal halves
        const row3 = phone.page.locator(".m-row2").nth(2);
        const rowBox = await row3.boundingBox();
        const ai = await row3.locator("> a.m-card-ai").boundingBox();
        const social = await row3.locator("> .m-card-social").boundingBox();
        assert(
          Math.abs(ai.x - rowBox.x) <= 1 &&
            Math.abs(ai.x + ai.width + 12 - social.x) <= 1 &&
            Math.abs(ai.width - social.width) <= 1 &&
            Math.abs(social.x + social.width - (rowBox.x + rowBox.width)) <=
              1 &&
            Math.abs(ai.height - social.height) <= 1,
          `${width}px: the AI agent tile sits left of the social box, equal halves of the same height (${Math.round(ai.width)}x${Math.round(ai.height)} + ${Math.round(social.width)}x${Math.round(social.height)})`,
        );
        const icons = await row3
          .locator(".m-social-icon-row .m-icon-chip")
          .count();
        let inside = icons === 3;
        for (let i = 0; i < icons; i++) {
          const b = await row3
            .locator(".m-social-icon-row .m-icon-chip")
            .nth(i)
            .boundingBox();
          if (
            b.x < social.x - 0.5 ||
            b.x + b.width > social.x + social.width + 0.5
          )
            inside = false;
        }
        assert(
          inside,
          `${width}px: the three social icons fit inside the half-width social box`,
        );
        assert(
          (await row3.locator("> a.m-card-ai h3").innerText()).trim() ===
            "Can you break our AI agent?" &&
            (await row3.locator("> a.m-card-ai").getAttribute("href")) ===
              "/ai-agent/",
          `${width}px: the AI agent tile is titled "Can you break our AI agent?" and links to /ai-agent/`,
        );
      }
      if (width === 390) {
        assert(
          (await phone.page
            .getByRole("link", {
              name: "Can you break our AI agent?",
              exact: true,
            })
            .count()) === 1,
          "the animated AI agent tile keeps the title as its accessible name",
        );
        assert(
          (await phone.page.evaluate(() => {
            const p = document.querySelector(".m-ai-prompt");
            const c = document.querySelector(".m-card-ai .m-emoji-chip");
            return (
              getComputedStyle(p).animationName.includes("m-ai-type") &&
              getComputedStyle(c).animationName === "m-ai-nope"
            );
          })) === true,
          "the AI agent tile animates (prompt typing and the robot shaking its head)",
        );
      }
      await phone.context.close();
    }
  }

  // --- reduced motion: the AI agent tile does not move, the prompt stays typed --
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
    await page.locator("#mStand").click();
    await page.waitForTimeout(1800);
    const state = await page.evaluate(() => {
      const p = document.querySelector(".m-ai-prompt");
      const c = document.querySelector(".m-card-ai .m-emoji-chip");
      return {
        promptAnim: getComputedStyle(p).animationName,
        chipAnim: getComputedStyle(c).animationName,
        typed: p.getBoundingClientRect().width > 60,
      };
    });
    assert(
      state.promptAnim === "none" && state.chipAnim === "none" && state.typed,
      "reduced motion: the AI agent tile is still and the prompt line is fully shown",
    );
    await context.close();
  }

  // --- /why-us/: one path, four slides, opens straight on the first --------
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.goto(`http://localhost:${PORT}/why-us/`, {
      waitUntil: "networkidle",
    });
    assert(
      (await page.locator(".wdwd-slide.is-active h3").textContent())?.trim() ===
        "Don't believe us. Check us.",
      "why-us: opens on the first slide",
    );
    assert(
      await page.locator(".wdwd-prev").isDisabled(),
      "why-us: the back arrow is disabled on the first slide",
    );
    assert(
      (await page.locator(".wdwd-dot").count()) === 4,
      "why-us: four dots for four slides",
    );
    assert(
      JSON.stringify(
        await page.locator(".wdwd-slide .wdwd-k").allTextContents(),
      ) === JSON.stringify(["CHECK", "ASK", "CLEAR", "CALL"]),
      "why-us: the four slides open with CHECK, ASK, CLEAR, CALL",
    );
    assert(
      JSON.stringify(
        await page
          .locator(".wdwd-slide")
          .first()
          .locator(".wdwd-links a")
          .allTextContents(),
      ) ===
        JSON.stringify([
          "Check our security level",
          "Check our environmental impact",
        ]),
      "why-us: the first slide links read 'Check our security level' and 'Check our environmental impact'",
    );
    const askLines = await page
      .locator(".wdwd-slide")
      .nth(1)
      .locator(".wdwd-body")
      .evaluate((el) =>
        el.innerHTML
          .split(/<br\s*\/?>/)
          .map((s) => s.replace(/<[^>]*>/g, "").trim()),
      );
    assert(
      JSON.stringify(askLines) ===
        JSON.stringify([
          "Send us your question and judge us by the answer.",
          "We reply fast.",
        ]),
      "why-us: the ASK statement is on two lines, broken at the full stop",
    );
    for (let i = 0; i < 3; i++) await page.locator(".wdwd-next").click();
    await page.waitForTimeout(700);
    assert(
      await page.locator(".wdwd-next").isDisabled(),
      "why-us: the next arrow is disabled on the last slide",
    );
    assert(
      (await page
        .locator(".wdwd-slide.is-active .wdwd-cta")
        .getAttribute("href")) === "https://cal.com/securelayer",
      "why-us: the last slide books a call",
    );
    await context.close();
  }

  // --- broken markup falls back to the stacked page ----------------------
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await page.route(PAGE_URL, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        'id="wdwd-chooser"',
        'id="wdwd-broken"',
      );
      await route.fulfill({ response, body });
    });
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
    assert(
      (await page.evaluate(() =>
        document.documentElement.classList.contains("wdwd-js"),
      )) === false,
      "script failure removes wdwd-js",
    );
    let visible = 0;
    for (let i = 0; i < 6; i++)
      if (await page.locator(".wdwd-path").nth(i).isVisible()) visible++;
    assert(visible === 6, "script failure leaves all six paths visible");
    await context.close();
  }

  // --- axe: chooser, a deck slide, and the no-JS view --------------------
  async function axeFail(page, label) {
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    assert(
      serious.length === 0,
      `axe: ${label} has no serious/critical violations`,
    );
    for (const v of serious) console.error(`  ${v.id}: ${v.help}`);
  }
  {
    const a = await open({});
    await a.page.waitForTimeout(700);
    await axeFail(a.page, "chooser");
    assert(
      (await a.page.getByRole("heading", { level: 1 }).count()) === 1,
      "chooser state exposes exactly one h1",
    );
    await a.context.close();
    const f = await open({}, "#helpinvestors");
    await f.page.keyboard.press("ArrowRight");
    await f.page.waitForTimeout(900);
    await axeFail(f.page, "investor second slide (with the new blocks)");
    await f.context.close();
    const b = await open({}, "#helpinvestors");
    await b.page.keyboard.press("ArrowRight");
    await b.page.keyboard.press("ArrowRight");
    // let the slide transition finish so axe does not read half-faded colours
    await b.page.waitForTimeout(700);
    await axeFail(b.page, "investor last slide");
    assert(
      (await b.page.getByRole("heading", { level: 1 }).count()) === 1,
      "path state exposes exactly one h1",
    );
    await b.context.close();
    // axe cannot run with JavaScript disabled, so block only the deck script
    const c = await browser.newContext();
    const cp = await c.newPage();
    await cp.route("**/scripts/what-we-do.js", (r) => r.abort());
    await cp.goto(PAGE_URL, { waitUntil: "networkidle" });
    await axeFail(cp, "stacked view (deck script blocked)");
    await c.close();
  }

  // --- homepage on phones: lock screen, boxes and the Pro Tips one-liner -----
  {
    const TIPS = JSON.parse(
      readFileSync(
        new URL("../src/data/pro-tips.json", import.meta.url),
        "utf8",
      ),
    );
    const plain = (t) => t.replace(/\*/g, "");
    const phone = async (options = {}) => {
      const context = await browser.newContext({
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        ...options,
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(`http://localhost:${PORT}/`, {
        waitUntil: "networkidle",
      });
      return { context, page };
    };

    const lock = await phone();
    assert(
      (await lock.page.locator(".m-stand-stat-tags").count()) === 0 &&
        !/AppSec/.test(await lock.page.locator("#mStand").innerText()),
      'phone lock screen: the "DevOps / IT / AppSec" line is gone',
    );
    await lock.page.locator("#mStand").click();
    await lock.page.waitForTimeout(1800);
    const titles = await lock.page
      .locator(".m-card h3, .m-card-sec h3")
      .allInnerTexts();
    assert(
      titles.includes("Check our environmental impact") &&
        !titles.includes("Check our impact"),
      'phone: the impact box is titled "Check our environmental impact"',
    );
    const eco = lock.page.locator("a.m-card-eco");
    assert(
      (await eco.count()) === 1 &&
        (await eco.getAttribute("href")) === "/sustainability/" &&
        (await eco.locator(".m-emoji-chip").innerText()).includes("♻") &&
        /Green by design:\s*static, no tracking/.test(
          (await eco.locator("p").innerText()).replace(/\s+/g, " "),
        ),
      "phone: the environmental tile is dark green with a recycling chip, its line and a link to /sustainability/",
    );
    {
      const secTile = lock.page.locator('a.m-card-sec[href="/security"]');
      const whyTile = lock.page.locator('a.m-card-sec[href="/why-us/"]');
      assert(
        (await secTile.locator("p").innerText()).trim() ===
          "Before we secure yours, see ours" &&
          (await whyTile.locator("h3").innerText()).trim() ===
            "Why choose us?" &&
          (await whyTile.locator("p").innerText())
            .replace(/\s+/g, " ")
            .trim() === "Don't believe us, check us",
        'phone: the security tile keeps only "Before we secure yours, see ours" and the Why us tile says "Don\'t believe us, check us"',
      );
    }
    {
      const links = (
        await lock.page.locator(".m-footer-links a").allInnerTexts()
      ).map((x) => x.trim());
      assert(
        JSON.stringify(links) ===
          JSON.stringify([
            "Why choose us?",
            "Security",
            "Environment",
            "Legal",
            "Privacy",
            "Source",
          ]),
        "phone: the homepage footer lists the other pages and has no Home link",
      );
      assert(
        (await lock.page
          .locator(
            '.m-footer a[href="/sustainability"] img[src="/gwf-badge.png"]',
          )
          .count()) === 1,
        "phone: the homepage footer carries the green-hosting badge",
      );
    }
    const social = await lock.page.evaluate(() => {
      const card = document.querySelector(".m-card-social");
      const note = card.querySelector(".m-card-social-note");
      const icons = card.querySelector(".m-icon-row");
      return {
        noteBeforeIcons: !!(
          note &&
          icons &&
          note.compareDocumentPosition(icons) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
        gap: Math.round(
          icons.getBoundingClientRect().top -
            note.getBoundingClientRect().bottom,
        ),
      };
    });
    assert(
      social.noteBeforeIcons && social.gap >= 8,
      `phone: the social media box shows its text before the icons (gap ${social.gap}px)`,
    );

    // lock-screen clock: "HH:MM" with a colon, in the markup (shown before JS runs) and once JS runs
    const clockLive = await lock.page.evaluate(() =>
      document.getElementById("mStandTime").textContent.trim(),
    );
    const clockMarkup = readFileSync(`${DIST}index.html`, "utf8").match(
      /id="mStandTime"[^>]*>\s*([^<\s]+)\s*</,
    )?.[1];
    assert(
      /^\d{2}:\d{2}$/.test(clockLive) &&
        /^\d{2}:\d{2}$/.test(clockMarkup ?? ""),
      `phone: the lock-screen clock uses a colon (live "${clockLive}", markup "${clockMarkup}")`,
    );

    // tips: one at a time, from src/data/pro-tips.json, each on a single line
    const tipState = () =>
      lock.page.evaluate(() => {
        const tips = [...document.querySelectorAll(".m-tip")];
        const room = document.querySelector(".m-tips").clientWidth;
        return {
          rotating: document
            .getElementById("mProTips")
            .classList.contains("is-rotating"),
          texts: tips.map((t) => t.textContent.trim()),
          on: tips
            .filter((t) => t.classList.contains("is-on"))
            .map((t) => t.textContent.trim()),
          oneLine: tips.every((t) => t.scrollWidth <= room + 1),
          bigger: parseFloat(getComputedStyle(tips[0]).fontSize) >= 17,
        };
      });
    const t0 = await tipState();
    assert(
      JSON.stringify(t0.texts) === JSON.stringify(TIPS.tips.map(plain)),
      `phone: the tips shown are the ones in pro-tips.json (${t0.texts.length})`,
    );
    assert(
      t0.rotating && t0.on.length === 1 && t0.oneLine && t0.bigger,
      "phone: one tip at a time, each on one line, in a bigger size",
    );
    const seen = new Set(t0.on);
    for (let i = 0; i < TIPS.tips.length * 2; i++) {
      await lock.page.waitForTimeout(TIPS.seconds * 1000 + 100);
      (await tipState()).on.forEach((t) => seen.add(t));
    }
    assert(
      seen.size === TIPS.tips.length,
      `phone: the tips rotate through all ${TIPS.tips.length} of them (${seen.size} seen)`,
    );
    await lock.context.close();

    const calm = await phone({ reducedMotion: "reduce" });
    await calm.page.locator("#mStand").click();
    await calm.page.waitForTimeout(1800);
    const still = await calm.page.evaluate(() => ({
      rotating: document
        .getElementById("mProTips")
        .classList.contains("is-rotating"),
      visible: [...document.querySelectorAll(".m-tip")].every(
        (t) => getComputedStyle(t).opacity === "1",
      ),
    }));
    assert(
      !still.rotating && still.visible,
      "phone, reduced motion: the tips stay still, all visible",
    );
    await calm.context.close();

    const noJs = await phone({ javaScriptEnabled: false });
    assert(
      (await noJs.page.locator(".m-tip").count()) === TIPS.tips.length,
      "phone, no JavaScript: all the tips are in the page",
    );
    await noJs.context.close();
  }

  // --- /security: the three questions look like the section titles ----------
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${PORT}/security/`, {
      waitUntil: "networkidle",
    });
    const look = await page.evaluate(() => {
      const css = (e) => {
        const c = getComputedStyle(e);
        return [
          c.fontSize,
          c.fontWeight,
          c.letterSpacing,
          c.textTransform,
        ].join(" / ");
      };
      return {
        title: css(document.querySelector(".section-title")),
        questions: [...document.querySelectorAll(".m-cat-question")].map(css),
      };
    });
    assert(
      look.questions.length === 3 &&
        look.questions.every((q) => q === look.title),
      `/security: the 3 questions use the section-title font (${look.title})`,
    );
    await context.close();
  }

  assert(
    pageErrors.length === 0,
    `no uncaught page errors (${pageErrors.join("; ")})`,
  );
} finally {
  await browser.close();
  server.close();
}

if (failed) {
  process.exit(1);
} else {
  console.log("What-we-do page check: all checks passed");
}
