import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "past_data");
const outputRoot = join(root, "public");
const contentRoot = join(outputRoot, "content");
const ids = [1, 4, 6, 7, 9];

const plans = {
  post00001: [
    // Opening — establish the time-versus-learning misconception before naming it.
    section("flow", range(4, 6)),
    section("spotlight", [7]),
    section("flow", range(8, 10)),

    // Method and equation — move from the vehicle analogy to the governing idea.
    section("chapter", range(12, 14)),
    section("flow", [15]),
    section("spotlight", [16, 17]),
    section("flow", range(18, 20)),

    // Deep Work — explain focus first, then leave the reader with a usable ritual.
    section("chapter", range(21, 24)),
    section("flow", range(25, 27)),
    section("flow", [28]),

    // Mind Map — analogy, definition, then a full image plate.
    section("chapter", range(29, 30)),
    section("flow", range(31, 32)),
    section("image", [33]),

    // Sleep — close the final method with its warning on a deliberate pause.
    section("chapter", range(34, 36)),
    section("spotlight", range(37, 38)),
    section("ending", range(40, 42)),
  ],
  post00004: [
    // Opening — ask why we study, then let the personal story answer.
    section("flow", range(5, 8)),
    section("story", range(10, 11)),
    section("story", range(12, 14)),
    section("image", [15]),

    // Discovery — isolate the question that leads into Meta Learning.
    section("spotlight", range(16, 17)),
    section("flow", [18, 20]),

    // Definition — introduce Meta Learning, then give its five-part map room.
    section("chapter", range(21, 22)),
    section("flow", range(23, 25)),
    section("image", [26]),

    // Consequence — show what changed, then what the reclaimed time made possible.
    section("story", range(28, 30)),
    section("story", range(31, 32)),

    // Coda — identify the reader and point forward to the series.
    section("chapter", range(34, 35)),
    section("ending", range(37, 38)),
  ],
  post00006: [
    // Opening experiment — let the 500-kyat question create the reader's doubt.
    section("flow", range(4, 6)),

    // Problem and illusion — first the familiar habit, then the hidden failure.
    section("chapter", range(8, 12)),
    section("image", [13]),
    section("chapter", range(15, 17)),
    section("spotlight", [18]),

    // Why the brain shortcuts — explain the mechanism, then pause on its example.
    section("chapter", range(20, 23)),
    section("chapter", range(25, 27)),
    section("spotlight", [28]),
    section("image", [29]),

    // Consequence and correction — signal importance by retrieving, not rereading.
    section("chapter", range(31, 33)),
    section("chapter", range(35, 38)),
    section("spotlight", [39]),

    // Evidence and handoff — give the research result its own page before Book 007.
    section("flow", range(40, 42)),
    section("spotlight", [43]),
    section("ending", range(45, 48)),
  ],
  post00007: [
    // Part I — diagnose why studying can feel productive without creating recall.
    section("chapter", range(3, 6)),
    section("flow", range(7, 9)),
    section("chapter", range(10, 11)),
    section("image", [12]),
    section("spotlight", range(13, 14)),
    section("flow", [15]),

    // Part II — define Active Recall, then give the reader the five-step map.
    section("chapter", range(16, 17)),
    section("flow", range(18, 19)),

    // Step 1 — learn for understanding; each prompt stays with its introduction.
    section("chapter", range(20, 23)),
    section("story", range(24, 25)),
    section("story", range(26, 27)),
    section("flow", range(28, 29)),

    // Step 2 — turn material into questions, then pause for a flashcard plate.
    section("chapter", range(30, 33)),
    section("story", range(34, 35)),
    section("flow", range(36, 37)),
    section("image", [38]),

    // Steps 3–5 — attempt, inspect memory, compare answers, and practise.
    section("chapter", range(39, 43)),
    section("chapter", range(44, 45)),
    section("story", range(46, 47)),
    section("chapter", range(48, 51)),
    section("image", [52]),

    // Coda — close Active Recall and leave the next problem deliberately open.
    section("ending", [54]),
    section("ending", [55]),
  ],
  post00009: [
    // Opening — overturn the belief that more hours always create better marks.
    section("flow", range(4, 6)),

    // Method 1 — define ROI, compare choices, then stop on the visual example.
    section("chapter", range(8, 11)),
    section("image", [12]),

    // Method 2 — ask what can be automated, show it, then leave a concrete prompt.
    section("chapter", range(13, 15)),
    section("image", [16]),
    section("spotlight", [17]),

    // Method 3 — diagnose broken focus, then make the two-hour experiment memorable.
    section("chapter", range(18, 20)),
    section("image", [21]),
    section("spotlight", [22]),

    // Method 4 — introduce 80/20, unpack the exam, and preserve the video handoff.
    section("chapter", range(23, 24)),
    section("image", [25]),
    section("flow", range(26, 29)),
    section("spotlight", [30]),
    section("flow", range(31, 32)),

    // Method 5 — find the reader's fit, with the visual-learning idea and plate apart.
    section("chapter", range(34, 36)),
    section("spotlight", [37]),
    section("image", [38]),
    section("flow", range(39, 40)),

    // Coda — keep the invitation to share, its link, and the author's sign-off.
    section("ending", range(42, 45)),
  ],
};

mkdirSync(contentRoot, { recursive: true });
rmSync(join(outputRoot, "assets"), { recursive: true, force: true });
cpSync(join(sourceRoot, "assets"), join(outputRoot, "assets"), { recursive: true });

for (const number of ids) {
  const id = `post${String(number).padStart(5, "0")}`;
  const source = readFileSync(join(sourceRoot, "posts", `${id}.html`), "utf8");
  const title = decodeEntities(source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? id);
  const articleStart = source.search(/<article\b[^>]*>/i);
  const articleOpenEnd = source.indexOf(">", articleStart) + 1;
  const articleEnd = source.lastIndexOf("</article>");

  if (articleStart < 0 || articleEnd < articleOpenEnd) {
    throw new Error(`Could not extract the article from ${id}`);
  }

  const cleanArticle = sanitize(source.slice(articleOpenEnd, articleEnd));
  const blocks = topLevelBlocks(cleanArticle);
  const plan = plans[id];
  if (!plan) throw new Error(`Missing editorial plan for ${id}`);

  const sections = plan.map(({ kind, indexes }) => {
    const selected = indexes.map((index) => {
      if (!blocks[index]) throw new Error(`${id}: editorial block ${index} does not exist`);
      return blocks[index];
    });
    return { kind, html: selected.join("") };
  });

  writeFileSync(join(contentRoot, `${id}.json`), JSON.stringify({ id, title, sections }));
}

function section(kind, indexes) {
  return { kind, indexes };
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function sanitize(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/href=(["'])javascript:[\s\S]*?\1/gi, 'href="#"');
}

function topLevelBlocks(html) {
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const blocks = [];
  let cursor = 0;

  while (cursor < html.length) {
    while (cursor < html.length && /\s/.test(html[cursor])) cursor += 1;
    if (cursor >= html.length) break;
    if (html.startsWith("<!--", cursor)) {
      const commentEnd = html.indexOf("-->", cursor);
      cursor = commentEnd === -1 ? html.length : commentEnd + 3;
      continue;
    }

    const opening = html.slice(cursor).match(/^<([a-z0-9-]+)\b[^>]*>/i);
    if (!opening) {
      const next = html.indexOf("<", cursor + 1);
      cursor = next === -1 ? html.length : next;
      continue;
    }

    const start = cursor;
    const rootTag = opening[1].toLowerCase();
    if (voidTags.has(rootTag) || opening[0].endsWith("/>")) {
      blocks.push(opening[0]);
      cursor += opening[0].length;
      continue;
    }

    const tokens = /<\/?([a-z0-9-]+)\b[^>]*>/gi;
    tokens.lastIndex = cursor;
    let depth = 0;
    let token;
    while ((token = tokens.exec(html))) {
      const raw = token[0];
      const tag = token[1].toLowerCase();
      if (raw.startsWith("</")) depth -= 1;
      else if (!voidTags.has(tag) && !raw.endsWith("/>")) depth += 1;

      if (depth === 0) {
        blocks.push(html.slice(start, tokens.lastIndex));
        cursor = tokens.lastIndex;
        break;
      }
    }
    if (depth !== 0) throw new Error("Malformed article HTML while building editorial sections");
  }

  return blocks;
}

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

console.log(`Prepared ${ids.length} editorially paginated library books.`);
