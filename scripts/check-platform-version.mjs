import { readFileSync } from "node:fs";

const files = [
  "package.json",
  "package-lock.json",
  "backend/package.json",
  "backend/package-lock.json",
];
const versions = files.map((file) => {
  const manifest = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  if (file.endsWith("package-lock.json") && manifest.packages[""].version !== manifest.version) {
    throw new Error(`${file}: root package and lockfile versions differ`);
  }
  return manifest.version;
});

if (!/^\d+\.\d+\.\d+$/.test(versions[0]) || versions.some((version) => version !== versions[0])) {
  throw new Error(`Platform versions must be matching MAJOR.MINOR.PATCH values: ${files.map((file, index) => `${file}=${versions[index]}`).join(", ")}`);
}

console.log(`Platform version ${versions[0]}`);
