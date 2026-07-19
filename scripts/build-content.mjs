import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sourceRoot = join(root, "past_data");
const outputRoot = join(root, "public");
const contentRoot = join(outputRoot, "content");
const ids = [1, 4, 6, 7, 9];

const plans = {
  post00001: [
    section("flow", range(4, 10)),
    section("chapter", range(12, 15)),
    section("spotlight", [16, 17]),
    section("flow", range(18, 20)),
    section("chapter", range(21, 28)),
    section("chapter", range(29, 32)),
    section("image", [33]),
    section("chapter", range(34, 38)),
    section("ending", range(40, 42)),
  ],
  post00004: [
    section("flow", range(5, 8)),
    section("story", range(10, 14)),
    section("image", [15]),
    section("spotlight", [16, 17]),
    section("flow", [18, 20]),
    section("chapter", range(21, 25)),
    section("image", [26]),
    section("story", range(28, 32)),
    section("chapter", range(34, 35)),
    section("ending", range(37, 38)),
  ],
  post00006: [
    section("flow", range(4, 6)),
    section("chapter", range(8, 12)),
    section("image", [13]),
    section("chapter", range(15, 17)),
    section("spotlight", [18]),
    section("chapter", range(20, 23)),
    section("chapter", range(25, 28)),
    section("image", [29]),
    section("chapter", range(31, 33)),
    section("chapter", range(35, 39)),
    section("flow", range(40, 42)),
    section("spotlight", [43]),
    section("ending", range(45, 48)),
  ],
  post00007: [
    section("chapter", range(3, 9)),
    section("chapter", range(10, 13)),
    section("spotlight", [14]),
    section("flow", [15]),
    section("chapter", range(16, 19)),
    section("chapter", range(20, 29)),
    section("chapter", range(30, 37)),
    section("image", [38]),
    section("chapter", range(39, 43)),
    section("chapter", range(44, 47)),
    section("chapter", range(48, 52)),
    section("ending", range(54, 55)),
  ],
  post00009: [
    section("flow", range(4, 6)),
    section("chapter", range(8, 11)),
    section("image", [12]),
    section("chapter", range(13, 16)),
    section("spotlight", [17]),
    section("chapter", range(18, 21)),
    section("spotlight", [22]),
    section("chapter", range(23, 24)),
    section("image", [25]),
    section("flow", range(26, 29)),
    section("spotlight", [30]),
    section("flow", [31]),
    section("chapter", range(34, 37)),
    section("image", [38]),
    section("flow", range(39, 40)),
    section("ending", [42, 45]),
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
