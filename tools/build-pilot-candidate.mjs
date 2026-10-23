import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = ["app.html", "konto.html", "integritetspolicy.html", "aterstall.html"];
const BUILD_RECIPE_FILES = [
  "tools/build-pilot-candidate.mjs",
  "tools/render-pilot-runtime-config.mjs",
  "vercel.json",
  "package.json",
  "package-lock.json",
];
export const PILOT_ROUTES = ["abandon-exam", "check-role", "explain", "generate-exam", "grade"];
export const PILOT_UI_HELD_OUT_ROUTES = ["create-checkout-session", "ocr", "signup"];
const PILOT_ENV = { EXGEN_PILOT_MODE: "true" };
const RUNTIME_PLACEHOLDER = `window.ExGenRuntime = Object.freeze({
  environment: "pilot",
  projectRef: "candidate-unconfigured",
  supabaseUrl: "https://candidate-unconfigured.invalid",
  publishableKey: "candidate-key-not-configured",
  appOrigin: "https://candidate-unconfigured.invalid",
  authStorageKey: "sb-candidate-unconfigured-auth-token"
});\n`;
const SECRET_PATTERNS = [
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
  ["Stripe live secret key", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ["private-key PEM", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

function secretKind(content) {
  const source = content.toString("utf8");
  for (const [kind, pattern] of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) return kind;
  }
  for (const match of source.matchAll(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split(".")[1], "base64url").toString("utf8"));
      if (payload.role === "service_role") return "Supabase service_role JWT";
    } catch {}
  }
  return null;
}

function localPath(reference, basePath) {
  const value = String(reference || "").trim();
  if (!value || value.startsWith("#") || /^(?:[a-z]+:|\/\/)/i.test(value)) return null;
  const pathname = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  if (!pathname || pathname === "/") return null;
  if (pathname.startsWith("/api/")) return null;
  return pathname.startsWith("/")
    ? pathname.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(basePath), pathname));
}

function assertSafeRelative(relative) {
  const normalized = path.posix.normalize(relative.replaceAll("\\", "/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error(`Refusing unsafe candidate path: ${relative}`);
  }
  return normalized;
}

function refsFromHtml(source) {
  return [...source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
}

function refsFromCss(source) {
  const refs = [];
  for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.push(match[1]);
  for (const match of source.matchAll(/@import\s+["']([^"']+)["']/gi)) refs.push(match[1]);
  return refs;
}

function refsFromJs(source) {
  const refs = [];
  for (const match of source.matchAll(/\b(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) refs.push(match[1]);
  for (const match of source.matchAll(/["']\/(?:js|config|image|fonts)\/[^"'?#]+["']/g)) refs.push(match[0].slice(1, -1));
  return refs;
}

function refsFromJson(source) {
  const refs = [];
  function visit(value) {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (["src", "href", "url"].includes(key.toLowerCase()) && typeof item === "string") refs.push(item);
        else visit(item);
      }
    }
  }
  visit(JSON.parse(source));
  return refs;
}

export function collectStaticFiles(root = ROOT) {
  const allowedPages = new Set([...PAGES, "index.html"]);
  const files = new Set(["index.html"]);
  const queue = [...PAGES];
  const visited = new Set();

  while (queue.length) {
    const current = assertSafeRelative(queue.shift());
    if (visited.has(current)) continue;
    visited.add(current);
    if (!existsSync(path.join(root, current))) throw new Error(`Missing pilot page or asset: ${current}`);
    files.add(current);
    const ext = path.posix.extname(current).toLowerCase();
    const source = readFileSync(path.join(root, current), "utf8");
    const refs = ext === ".html" ? refsFromHtml(source)
      : ext === ".css" ? refsFromCss(source)
        : ext === ".js" || ext === ".mjs" ? refsFromJs(source)
          : ext === ".json" || ext === ".webmanifest" ? refsFromJson(source) : [];

    for (const ref of refs) {
      const target = localPath(ref, current);
      if (!target) continue;
      const normalized = assertSafeRelative(target);
      if (normalized === "js/exgen-runtime.js") continue;
      if (/\.html?$/i.test(normalized) && !allowedPages.has(normalized)) continue;
      if (!existsSync(path.join(root, normalized))) {
        throw new Error(`Missing local pilot dependency: ${current} -> ${normalized}`);
      }
      if (!files.has(normalized)) queue.push(normalized);
    }
  }

  files.add("js/exgen-runtime.js");
  files.add("vendor/supabase.js");
  return [...files].sort();
}

function tagEnd(source, start) {
  let quote = "";
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === "\"" || char === "'") quote = char;
    else if (char === ">") return i + 1;
  }
  return source.length;
}

function rawTextClosingTag(source, name, start) {
  const pattern = new RegExp(`<\\/${name}(?=[\\t\\n\\f\\r />])`, "ig");
  pattern.lastIndex = start;
  const match = pattern.exec(source);
  return match ? { start: match.index, end: tagEnd(source, match.index) } : null;
}

function decodeAttributeReferences(value) {
  return value
    .replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi, (_match, hex, decimal) => {
      const point = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point) : "\ufffd";
    })
    .replace(/&colon;?/gi, ":")
    .replace(/&sol;?/gi, "/")
    .replace(/&Tab;?/gi, "\t")
    .replace(/&NewLine;?/gi, "\n")
    .replace(/&plus;?/gi, "+");
}

function commentEnd(source, start) {
  let cursor = start + 4;
  if (source[cursor] === ">") return cursor + 1;
  if (source.startsWith("->", cursor)) return cursor + 2;
  while (cursor < source.length) {
    if (source.startsWith("--!>", cursor)) return cursor + 4;
    if (source.startsWith("-->", cursor)) return cursor + 3;
    cursor++;
  }
  return source.length;
}

function attributesFromTag(raw, nameEnd) {
  const attributes = new Map();
  const limit = raw.length - 1;
  let i = nameEnd;
  while (i < limit) {
    while (i < limit && /[\s/]/.test(raw[i])) i++;
    const start = i;
    while (i < limit && !/[\s=/>]/.test(raw[i])) i++;
    if (i === start) { i++; continue; }
    const name = raw.slice(start, i).toLowerCase();
    while (i < limit && /\s/.test(raw[i])) i++;
    let value = "";
    if (raw[i] === "=") {
      i++;
      while (i < limit && /\s/.test(raw[i])) i++;
      const quote = raw[i] === "\"" || raw[i] === "'" ? raw[i++] : "";
      const valueStart = i;
      if (quote) {
        while (i < limit && raw[i] !== quote) i++;
        value = raw.slice(valueStart, i);
        if (raw[i] === quote) i++;
      } else {
        while (i < limit && !/[\s>]/.test(raw[i])) i++;
        value = raw.slice(valueStart, i).replace(/\/$/, "");
      }
    }
    if (!attributes.has(name)) attributes.set(name, decodeAttributeReferences(value));
  }
  return attributes;
}

function htmlTags(source) {
  const tags = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) break;
    if (source.startsWith("<!--", start)) {
      cursor = commentEnd(source, start);
      continue;
    }
    if (source[start + 1] === "!" || source[start + 1] === "?") {
      cursor = tagEnd(source, start);
      continue;
    }

    let nameStart = start + 1;
    const closing = source[nameStart] === "/";
    if (closing) nameStart++;
    while (/\s/.test(source[nameStart] || "")) nameStart++;
    const nameMatch = /^[A-Za-z][A-Za-z0-9:-]*/.exec(source.slice(nameStart));
    if (!nameMatch) { cursor = start + 1; continue; }
    const nameEnd = nameStart + nameMatch[0].length;
    const end = tagEnd(source, start);
    const name = nameMatch[0].toLowerCase();
    const raw = source.slice(start, end);
    tags.push({ start, end, name, closing, attributes: closing ? new Map() : attributesFromTag(raw, nameEnd - start) });
    cursor = end;

    if (!closing && ["script", "style", "textarea", "title"].includes(name)) {
      const close = rawTextClosingTag(source, name, cursor);
      cursor = close ? close.start : source.length;
    }
  }
  return tags;
}

function isPublicMetadataTag(tag) {
  if (tag.name === "link") {
    const rel = String(tag.attributes.get("rel") || "").toLowerCase().split(/\s+/);
    return rel.includes("canonical");
  }
  if (tag.name !== "meta") return false;
  const name = String(tag.attributes.get("name") || "").toLowerCase();
  const property = String(tag.attributes.get("property") || "").toLowerCase();
  return name === "description" || name.startsWith("twitter:")
    || property.startsWith("og:") || property.startsWith("twitter:");
}

function isRobotsTag(tag) {
  if (tag.name !== "meta") return false;
  const name = String(tag.attributes.get("name") || "").toLowerCase();
  return name === "robots" || /(?:bot|spider|crawl|slurp|archiver|yandex|teoma)/.test(name);
}

function isJsonLdTag(tag) {
  if (tag.name !== "script") return false;
  const type = String(tag.attributes.get("type") || "").toLowerCase().split(";")[0].trim();
  return type === "application/ld+json";
}

function elementRange(tags, index, name) {
  const opening = tags[index];
  const closingIndex = tags.findIndex((tag, candidate) => candidate > index && tag.name === name && tag.closing);
  return { start: opening.start, end: closingIndex < 0 ? opening.end : tags[closingIndex].end };
}

function onlyWhitespaceAndComments(value) {
  let cursor = 0;
  while (cursor < value.length) {
    if (/[\t\n\f\r ]/.test(value[cursor])) { cursor++; continue; }
    if (!value.startsWith("<!--", cursor)) return false;
    const end = commentEnd(value, cursor);
    if (end === value.length && !value.endsWith("-->")) return false;
    if (!value.slice(cursor, end).endsWith("-->")) return false;
    cursor = end;
  }
  return true;
}

function hasValidHeadStructure(tags, html, head, headClose) {
  const inside = tags.filter((tag) => tag.start >= head.end && tag.end <= headClose.start);
  const allowed = new Set(["base", "link", "meta", "script", "style", "title"]);
  let cursor = head.end;
  for (let i = 0; i < inside.length; i++) {
    const tag = inside[i];
    if (tag.closing || !allowed.has(tag.name)) return false;
    if (!onlyWhitespaceAndComments(html.slice(cursor, tag.start))) return false;
    if (["script", "style", "title"].includes(tag.name)) {
      const closing = inside[i + 1];
      if (!closing?.closing || closing.name !== tag.name) return false;
      cursor = closing.end;
      i++;
      continue;
    }
    cursor = tag.end;
  }
  return onlyWhitespaceAndComments(html.slice(cursor, headClose.start));
}

function documentHead(tags, html) {
  const htmlOpenings = tags.filter((tag) => tag.name === "html" && !tag.closing);
  const htmlClosings = tags.filter((tag) => tag.name === "html" && tag.closing);
  const heads = tags.filter((tag) => tag.name === "head");
  const bodies = tags.filter((tag) => tag.name === "body");
  const root = htmlOpenings[0];
  const rootClose = htmlClosings[0];
  const head = heads.find((tag) => !tag.closing);
  const headClose = heads.find((tag) => tag.closing);
  const body = bodies.find((tag) => !tag.closing);
  const bodyClose = bodies.find((tag) => tag.closing);
  if (htmlOpenings.length !== 1 || htmlClosings.length !== 1 || heads.length !== 2 || bodies.length !== 2
    || !root || !rootClose || !head || !headClose || !body || !bodyClose
    || root.end > head.start || head.end > headClose.start || headClose.end > body.start
    || body.end > bodyClose.start || bodyClose.end > rootClose.start
    || !onlyWhitespaceAndComments(html.slice(root.end, head.start))
    || !onlyWhitespaceAndComments(html.slice(headClose.end, body.start))) return null;
  return { root, rootClose, head, headClose, body, bodyClose };
}

export function sanitizePilotHtml(source) {
  const tags = htmlTags(String(source));
  if (!documentHead(tags, String(source))) throw new Error("Pilot HTML must have one well-formed html, head, and body structure.");
  const ranges = [];
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (tag.closing) continue;
    if (tag.name === "title" || isRobotsTag(tag) || isPublicMetadataTag(tag)) {
      ranges.push(tag.name === "title" ? elementRange(tags, i, tag.name) : { start: tag.start, end: tag.end });
    } else if (isJsonLdTag(tag)) {
      ranges.push(elementRange(tags, i, tag.name));
    }
  }
  let html = String(source);
  for (const range of ranges.sort((a, b) => b.start - a.start)) {
    html = html.slice(0, range.start) + html.slice(range.end);
  }
  html = html.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2(?:\/dist\/umd\/supabase\.min\.js)?/g, "/vendor/supabase.js");
  const head = htmlTags(html).find((tag) => tag.name === "head" && !tag.closing);
  if (!head) throw new Error("Pilot HTML lost its head element during sanitization.");
  return html.slice(0, head.end) + "<title>ExGen skolpilot</title><meta name=\"robots\" content=\"noindex,nofollow\">" + html.slice(head.end);
}

export function verifyPilotHtml(html) {
  const source = String(html);
  const tags = htmlTags(source);
  const structure = documentHead(tags, source);
  const head = structure?.head;
  const headClose = structure?.headClose;
  const inHead = (tag) => head && headClose && tag.start >= head.end && tag.end <= headClose.start;
  const headOpenings = tags.filter((tag) => tag.name === "head" && !tag.closing);
  const headClosings = tags.filter((tag) => tag.name === "head" && tag.closing);
  const titles = tags.filter((tag) => tag.name === "title" && !tag.closing);
  const titleClosings = tags.filter((tag) => tag.name === "title" && tag.closing);
  const titleClose = titles.length === 1 && titleClosings.length === 1 && titleClosings[0].start > titles[0].end
    ? titleClosings[0] : null;
  const titleText = titleClose ? source.slice(titles[0].end, titleClose.start).trim() : "";
  const robots = tags.filter(isRobotsTag);
  const robotsValue = robots.length === 1 ? String(robots[0].attributes.get("content") || "").replace(/\s+/g, "").toLowerCase() : "";
  const publicTag = tags.find((tag) => isPublicMetadataTag(tag)
    || (tag.name === "script" && !tag.closing && isJsonLdTag(tag)));
  if (!structure || headOpenings.length !== 1 || headClosings.length !== 1 || !head || !headClose || head.end > headClose.start
    || !hasValidHeadStructure(tags, String(html), head, headClose)
    || titles.length !== 1 || titleClosings.length !== 1 || !inHead(titles[0]) || titleText !== "ExGen skolpilot"
    || robots.length !== 1 || !inHead(robots[0]) || robotsValue !== "noindex,nofollow") {
    throw new Error("Candidate pilot title/robots metadata is missing, duplicated, conflicting, or outside head.");
  }
  if (publicTag) throw new Error("Public crawler metadata remains in candidate HTML.");
  return true;
}

function copyStaticFile(sourceRoot, staticRoot, relative) {
  const normalized = assertSafeRelative(relative);
  const source = path.join(sourceRoot, normalized);
  const destination = path.join(staticRoot, normalized);
  mkdirSync(path.dirname(destination), { recursive: true });
  if (normalized === "index.html") {
    writeFileSync(destination, "<!doctype html><html lang=\"sv\"><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex,nofollow\"><meta http-equiv=\"refresh\" content=\"0;url=/app.html\"><title>ExGen skolpilot</title></head><body><p><a href=\"/app.html\">Öppna ExGen</a></p><script>location.replace('/app.html'+location.search+location.hash)</script></body></html>\n", { flag: "wx", mode: 0o644 });
    return;
  }
  if (normalized === "js/exgen-runtime.js") {
    writeFileSync(destination, RUNTIME_PLACEHOLDER, { flag: "wx", mode: 0o644 });
    return;
  }
  if (normalized === "vendor/supabase.js") {
    cpSync(path.join(sourceRoot, "node_modules/@supabase/supabase-js/dist/umd/supabase.js"), destination, { errorOnExist: true, force: false });
    return;
  }
  if (/\.html?$/i.test(normalized)) writeFileSync(destination, sanitizePilotHtml(readFileSync(source, "utf8")), { flag: "wx", mode: 0o644 });
  else cpSync(source, destination, { errorOnExist: true, force: false, dereference: true, recursive: true });
}

function packagePath(root, name) {
  if (name.startsWith("node:")) return null;
  return path.join(root, "node_modules", ...name.split("/"));
}

export function packageClosure(root, initialPackages) {
  const packages = new Set();
  const queue = [...initialPackages];
  while (queue.length) {
    const name = queue.shift();
    if (packages.has(name)) continue;
    const source = packagePath(root, name);
    const metadataPath = path.join(source, "package.json");
    if (!existsSync(metadataPath)) throw new Error(`Missing runtime package: ${name}`);
    packages.add(name);
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    for (const dependency of Object.keys(metadata.dependencies || {})) queue.push(dependency);
    for (const dependency of Object.keys(metadata.optionalDependencies || {})) {
      if (existsSync(path.join(packagePath(root, dependency), "package.json"))) queue.push(dependency);
    }
    for (const dependency of Object.keys(metadata.peerDependencies || {})) {
      const optional = metadata.peerDependenciesMeta?.[dependency]?.optional === true;
      if (existsSync(path.join(packagePath(root, dependency), "package.json"))) queue.push(dependency);
      else if (!optional) throw new Error(`Missing required peer runtime package: ${name} -> ${dependency}`);
    }
  }
  return [...packages].sort();
}

function packageRootName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function moduleSpecifiers(source, relativeFile) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
  const unsupportedLoaders = [
    /\bmodule\s*(?:\.\s*require|\[\s*["']require["']\s*\])\s*\(/,
    /\brequire\s*\.\s*resolve\s*\(/,
    /\b(?:const|let|var)\s+[$\w]+\s*=\s*require\s*(?:[;,]|\n|$)/,
    /\bcreateRequire\s*\(/,
    /\bimport\.meta\.resolve\s*\(/,
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
  ];
  if (unsupportedLoaders.some((pattern) => pattern.test(withoutComments))) {
    throw new Error(`Unsupported indirect module loader in candidate dependency: ${relativeFile}`);
  }
  for (const match of withoutComments.matchAll(/\b(import|require)\s*\(([^)]*)\)/g)) {
    const argument = match[2].trim();
    if (!((argument.startsWith("'") && argument.endsWith("'")) || (argument.startsWith('"') && argument.endsWith('"')))) {
      throw new Error(`Non-literal module load in candidate dependency: ${relativeFile}`);
    }
  }
  return [...new Set([...withoutComments.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]))];
}

export function collectFunctionPlan(sourceRoot, route) {
  if (!PILOT_ROUTES.includes(route)) throw new Error(`Route is not in the pilot allowlist: ${route}`);
  const root = path.resolve(sourceRoot);
  const queue = [path.join(root, "api", `${route}.js`)];
  const sourceFiles = new Set();
  const packageNames = new Set();

  while (queue.length) {
    const absolute = queue.shift();
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (sourceFiles.has(relative)) continue;
    if (!existsSync(absolute) || !statSync(absolute).isFile()) throw new Error(`Missing candidate dependency: ${relative}`);
    sourceFiles.add(relative);
    const source = readFileSync(absolute, "utf8");

    for (const specifier of moduleSpecifiers(source, relative)) {
      if (isBuiltin(specifier)) continue;
      if (specifier.startsWith("#")) throw new Error(`Unsupported package import map in candidate dependency: ${relative} -> ${specifier}`);
      if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
        let resolved;
        try {
          resolved = createRequire(absolute).resolve(specifier);
        } catch {
          throw new Error(`Unresolved candidate dependency: ${relative} -> ${specifier}`);
        }
        if (!resolved.startsWith(`${root}${path.sep}`)) {
          throw new Error(`Candidate dependency escapes source repository: ${relative} -> ${specifier}`);
        }
        if (/\.(?:js|cjs|mjs)$/i.test(resolved)) queue.push(resolved);
        else sourceFiles.add(path.relative(root, resolved).split(path.sep).join("/"));
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(specifier)) {
        throw new Error(`Unsupported candidate dependency scheme: ${relative} -> ${specifier}`);
      }
      packageNames.add(packageRootName(specifier));
    }
  }

  const packages = packageClosure(root, [...packageNames]);
  const dataFiles = collectFiles(path.join(root, "config")).map((file) => `config/${file}`);
  return {
    sourceFiles: [...sourceFiles].sort(),
    dataFiles,
    directPackages: [...packageNames].sort(),
    packages,
  };
}

function sourceFingerprint(root, staticFiles) {
  const paths = new Set(staticFiles.filter((file) => !["index.html", "js/exgen-runtime.js", "vendor/supabase.js"].includes(file)));
  for (const directory of ["api", "src", "config"]) {
    const absolute = path.join(root, directory);
    if (!existsSync(absolute)) continue;
    function collect(current, prefix) {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const relative = path.posix.join(prefix, entry.name);
        if (entry.isDirectory()) collect(path.join(current, entry.name), relative);
        else paths.add(relative);
      }
    }
    collect(absolute, directory);
  }
  const orderedPaths = [...paths].sort();
  const hash = createHash("sha256");
  for (const relative of orderedPaths) {
    const absolute = path.join(root, relative);
    hash.update(relative).update("\0");
    if (!existsSync(absolute)) {
      hash.update("deleted\0");
      continue;
    }
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) hash.update(`symlink:${readlinkSync(absolute)}\0`);
    else if (stat.isFile()) hash.update(readFileSync(absolute)).update("\0");
  }
  return { fileCount: orderedPaths.length, sha256: hash.digest("hex") };
}

function buildRecipeFingerprint(root) {
  const hash = createHash("sha256");
  for (const relative of BUILD_RECIPE_FILES) {
    const absolute = path.join(root, relative);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      throw new Error(`Missing candidate build input: ${relative}`);
    }
    hash.update(relative).update("\0").update(readFileSync(absolute)).update("\0");
  }
  return { files: BUILD_RECIPE_FILES, sha256: hash.digest("hex") };
}

function collectFiles(root) {
  const files = [];
  function walk(current, prefix = "") {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) walk(path.join(current, entry.name), relative);
      else files.push(relative);
    }
  }
  walk(root);
  return files.sort();
}

function outputFingerprint(root) {
  const files = collectFiles(root);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file).update("\0").update(readFileSync(path.join(root, file))).update("\0");
  }
  return hash.digest("hex");
}

function copyFunction(sourceRoot, functionsRoot, route, plan) {
  const functionRoot = path.join(functionsRoot, `api/${route}.func`);
  mkdirSync(functionRoot, { recursive: true });
  for (const relative of plan.dataFiles) {
    const source = path.join(sourceRoot, relative);
    const destination = path.join(functionRoot, relative);
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination, { errorOnExist: true, force: false, dereference: true });
  }

  buildSync({
    entryPoints: [path.join(sourceRoot, "api", `${route}.js`)],
    outfile: path.join(functionRoot, "index.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node24",
    legalComments: "none",
    logLevel: "silent",
  });

  writeFileSync(path.join(functionRoot, "package.json"), "{\"private\":true}\n", { flag: "wx", mode: 0o644 });
  writeFileSync(path.join(functionRoot, ".vc-config.json"), JSON.stringify({
    runtime: "nodejs24.x",
    handler: "index.cjs",
    launcherType: "Nodejs",
    maxDuration: 60,
    shouldAddHelpers: true,
    environment: PILOT_ENV,
  }, null, 2) + "\n", { flag: "wx", mode: 0o644 });
}

export function verifyCandidateOutput(outputPath, expectations = null) {
  const vercelOutput = path.join(path.resolve(outputPath), ".vercel/output");
  const staticRoot = path.join(vercelOutput, "static");
  const functionsRoot = path.join(vercelOutput, "functions");
  const manifestPath = path.join(path.resolve(outputPath), "PILOT_CANDIDATE_MANIFEST.json");
  const manifest = expectations?.manifest || (existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null);
  const expectedStaticFiles = expectations?.staticFiles || manifest?.staticFiles;
  const expectedFunctionFiles = expectations?.functionFiles || manifest?.functionFiles;
  const outputConfig = JSON.parse(readFileSync(path.join(vercelOutput, "config.json"), "utf8"));
  if (outputConfig.version !== 3) throw new Error("Candidate has an unsupported Vercel Build Output API version.");

  const staticFiles = collectFiles(staticRoot);
  const functionDirs = [];
  function walkFunctions(current, prefix = "") {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      if (!entry.isDirectory()) continue;
      if (entry.name.endsWith(".func")) functionDirs.push(relative);
      else walkFunctions(path.join(current, entry.name), relative);
    }
  }
  walkFunctions(functionsRoot);
  functionDirs.sort();
  const expectedFunctions = PILOT_ROUTES.map((route) => `api/${route}.func`).sort();
  if (JSON.stringify(functionDirs) !== JSON.stringify(expectedFunctions)) {
    throw new Error(`Candidate function allowlist mismatch: ${functionDirs.join(",")}`);
  }

  if (!Array.isArray(expectedStaticFiles) || JSON.stringify(staticFiles) !== JSON.stringify([...expectedStaticFiles].sort())) {
    throw new Error("Candidate static file allowlist mismatch.");
  }
  const functionFiles = [];
  function walkFunctionFiles(current, prefix = "") {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) walkFunctionFiles(path.join(current, entry.name), relative);
      else functionFiles.push(relative);
    }
  }
  walkFunctionFiles(functionsRoot);
  if (!expectedFunctionFiles || typeof expectedFunctionFiles !== "object") {
    throw new Error("Candidate function file allowlist is missing.");
  }
  for (const route of PILOT_ROUTES) {
    const routePath = `api/${route}.func`;
    const expected = expectedFunctionFiles[route];
    const actual = collectFiles(path.join(functionsRoot, routePath));
    if (!Array.isArray(expected) || JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
      throw new Error(`Candidate function file allowlist mismatch: ${route}`);
    }
  }
  const pages = staticFiles.filter((file) => file.endsWith(".html")).sort();
  const expectedPages = [...PAGES, "index.html"].sort();
  if (JSON.stringify(pages) !== JSON.stringify(expectedPages)) {
    throw new Error(`Candidate static page allowlist mismatch: ${pages.join(",")}`);
  }
  for (const page of pages) {
    const html = readFileSync(path.join(staticRoot, page), "utf8");
    try { verifyPilotHtml(html); }
    catch (error) { throw new Error(`${error.message}: ${page}`); }
  }
  for (const route of PILOT_ROUTES) {
    const base = path.join(functionsRoot, `api/${route}.func`);
    const config = JSON.parse(readFileSync(path.join(base, ".vc-config.json"), "utf8"));
    if (config.runtime !== "nodejs24.x" || config.environment?.EXGEN_PILOT_MODE !== "true") {
      throw new Error(`Candidate function config is not explicitly pilot-only: ${route}`);
    }
    if (!existsSync(path.join(base, config.handler))) throw new Error(`Missing candidate handler entry: ${route}`);
  }
  const runtime = readFileSync(path.join(staticRoot, "js/exgen-runtime.js"), "utf8");
  if (runtime !== RUNTIME_PLACEHOLDER) throw new Error("Candidate runtime is not the exact unconfigured placeholder.");

  const filesToInspect = [
    ...staticFiles.map((file) => path.join(staticRoot, file)),
    ...functionFiles.map((file) => path.join(functionsRoot, file)),
  ];
  for (const file of filesToInspect) {
    const content = readFileSync(file);
    if (content.includes(Buffer.from("mnmotdluigzeehdjbhbu"))) {
      throw new Error(`Production Supabase project reference found in candidate output: ${path.relative(vercelOutput, file)}`);
    }
    const kind = secretKind(content);
    if (kind) throw new Error(`Possible ${kind} found in candidate output: ${path.relative(vercelOutput, file)}`);
  }
  if (manifest?.outputSha256 && outputFingerprint(vercelOutput) !== manifest.outputSha256) {
    throw new Error("Candidate output SHA-256 does not match its manifest.");
  }
  return { staticFileCount: staticFiles.length, staticPages: pages, functionRoutes: expectedFunctions };
}

export function buildCandidate(outputPath, sourceRoot = ROOT) {
  if (!path.isAbsolute(outputPath)) throw new Error("Candidate output must be an absolute path.");
  const resolvedOutput = path.resolve(outputPath);
  if (resolvedOutput === sourceRoot || resolvedOutput.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error("Candidate output must be outside the source repository.");
  }
  if (existsSync(resolvedOutput)) throw new Error("Candidate output already exists; refusing to overwrite it.");
  const parent = realpathSync(path.dirname(resolvedOutput));
  const canonicalSource = realpathSync(sourceRoot);
  if (parent === canonicalSource || parent.startsWith(`${canonicalSource}${path.sep}`)) {
    throw new Error("Candidate output parent resolves inside the source repository.");
  }
  if (lstatSync(path.dirname(resolvedOutput)).isSymbolicLink() || !statSync(parent).isDirectory()) {
    throw new Error("Candidate output parent must be a real existing directory.");
  }

  const staticFiles = collectStaticFiles(sourceRoot);
  const functionPlans = Object.fromEntries(PILOT_ROUTES.map((route) => [route, collectFunctionPlan(sourceRoot, route)]));
  const packages = [...new Set(Object.values(functionPlans).flatMap((plan) => plan.packages))].sort();
  const source = sourceFingerprint(sourceRoot, staticFiles);
  const manifest = {
    schemaVersion: 2,
    status: "UNCONFIGURED_NOT_DEPLOYABLE",
    sourceBaseCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim(),
    sourceWorktree: source,
    buildRecipe: buildRecipeFingerprint(sourceRoot),
    staticFiles,
    routes: PILOT_ROUTES.map((route) => `/api/${route}`),
    runtime: "nodejs24.x",
    functionInputs: functionPlans,
    packageDependencies: packages.map((name) => ({
      name,
      version: JSON.parse(readFileSync(path.join(packagePath(sourceRoot, name), "package.json"), "utf8")).version,
    })),
    blockers: [
      "pilot Supabase runtime must be rendered from verified staging settings",
      "school data, retention, deletion and support approvals are outstanding",
      "this local output has not been deployed or tested in Vercel",
      "the repository Vercel configuration still deploys the repository root, not this isolated candidate",
    ],
  };

  mkdirSync(resolvedOutput, { recursive: false });
  const vercelOutput = path.join(resolvedOutput, ".vercel/output");
  const staticRoot = path.join(vercelOutput, "static");
  const functionsRoot = path.join(vercelOutput, "functions");
  mkdirSync(staticRoot, { recursive: true });
  mkdirSync(functionsRoot, { recursive: true });
  for (const file of staticFiles) copyStaticFile(sourceRoot, staticRoot, file);
  for (const route of PILOT_ROUTES) copyFunction(sourceRoot, functionsRoot, route, functionPlans[route]);
  writeFileSync(path.join(vercelOutput, "config.json"), "{\"version\":3}\n", { flag: "wx", mode: 0o644 });
  manifest.functionFiles = Object.fromEntries(PILOT_ROUTES.map((route) => [
    route,
    collectFiles(path.join(functionsRoot, `api/${route}.func`)),
  ]));
  manifest.outputSha256 = outputFingerprint(vercelOutput);
  manifest.verification = verifyCandidateOutput(resolvedOutput, {
    manifest,
    staticFiles,
    functionFiles: manifest.functionFiles,
  });
  writeFileSync(path.join(resolvedOutput, "PILOT_CANDIDATE_MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o644 });
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf("--out");
  const outputPath = outIndex >= 0 ? process.argv[outIndex + 1] : "";
  if (!outputPath) throw new Error("Usage: node tools/build-pilot-candidate.mjs --out /absolute/new/candidate/path");
  const manifest = buildCandidate(outputPath);
  console.log(JSON.stringify({ outputPath: path.resolve(outputPath), ...manifest }, null, 2));
}
