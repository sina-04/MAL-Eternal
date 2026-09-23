import { copyFile, readdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const outputDirectory = new URL("../dist/client/", import.meta.url);
const basePath = "/MAL-Eternal";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".rsc"]);

for await (const file of walk(outputDirectory)) {
  if (!textExtensions.has(extname(file.pathname))) continue;
  const source = await readFile(file, "utf8");
  const normalized = source.replaceAll(/(?<!\/MAL-Eternal)\/_next\//g, `${basePath}/_next/`);
  if (normalized !== source) await writeFile(file, normalized);
}

await writeFile(new URL(".nojekyll", outputDirectory), "");
await copyFile(new URL("index.html", outputDirectory), new URL("404.html", outputDirectory));

const index = await readFile(new URL("index.html", outputDirectory), "utf8");
if (index.includes('"/_next/') || !index.includes(`${basePath}/_next/`)) {
  throw new Error("GitHub Pages asset paths were not normalized.");
}

console.log(`Prepared static artifact for ${basePath}/`);

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) yield* walk(child);
    else yield child;
  }
}
