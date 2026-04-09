import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(currentDirectory, "../dist");

await copyFile(
    path.join(distDirectory, "index.html"),
    path.join(distDirectory, "404.html"),
);