#!/usr/bin/env node

const fs = require("fs-extra");
const path = require("path");
const fetch = require("isomorphic-fetch");
const os = require("os");
const tar = require("tar");
const yargs = require("yargs");
const uuid = require("uuid/v4");

const argv = yargs
  .usage(`go-livepeer prebuilt binary downloader script`)
  .env("LP_")
  .strict(true)
  .options({
    out: {
      describe: "directory to save",
      default: process.cwd(),
      type: "string",
      alias: "o"
    },
    branch: {
      describe: "branch of go-livepeer you want to download",
      default: "master",
      tyoe: "string",
      alias: "b"
    }
  })
  .help().argv;

const run = async ({ out, branch }) => {
  const branchRes = await fetch(
    `https://api.github.com/repos/livepeer/go-livepeer/git/refs/heads/${branch}`
  );
  const versionRes = await fetch(
    `https://raw.githubusercontent.com/livepeer/go-livepeer/${branch}/VERSION`
  );
  const branchInfo = await branchRes.json();
  const version = await versionRes.text();
  const commit = branchInfo.object.sha.slice(0, 8);
  // https://build.livepeer.live/0.3.3-9b2bc027-dirty/livepeer-linux-amd64.tar.gz
  const fullVersion = `${version}-${commit}`;
  let filename;
  const platform = os.platform();
  const arch = os.arch();
  if (arch !== "x64") {
    throw new Error("only amd64 arch supported");
  }
  if (platform === "win32") {
    filename = "livepeer-windows-amd64.zip";
  } else if (platform === "darwin") {
    filename = "livepeer-darwin-amd64.tar.gz";
  } else if (platform === "linux") {
    filename = "livepeer-linux-amd64.tar.gz";
  }
  // Account for possible "-dirty" suffix
  let successfulRes;
  const tmpDir = path.resolve(os.tmpdir(), `livepeer-${fullVersion}`, uuid());
  await fs.ensureDir(tmpDir);
  for (const versionString of [fullVersion, `${fullVersion}-dirty`]) {
    const url = `https://build.livepeer.live/${versionString}/${filename}`;
    const res = await fetch(url);
    if (res.status === 200) {
      console.error(`Downloading from ${url}`);
      successfulRes = res;
      break;
    }
    // Do we need this to flush the request?
    res.text();
  }
  if (!successfulRes) {
    console.error(`Couldn't find ${fullVersion}. Perhaps it hasn't built yet?`);
    process.exit(1);
  }
  const outputFile = path.resolve(tmpDir, filename);
  successfulRes.body.pipe(fs.createWriteStream(outputFile));
  await new Promise(r => successfulRes.body.on("end", r));
  // console.error(`Downloaded to ${outputFile}`);
  await fs.ensureDir(out);
  if (outputFile.endsWith(".tar.gz")) {
    await tar.extract({
      file: outputFile,
      cwd: tmpDir
    });
  }
  const dirs = [];
  for (const maybeDir of await fs.readdir(tmpDir)) {
    const fullMaybeDir = path.resolve(tmpDir, maybeDir);
    const stats = await fs.stat(fullMaybeDir);
    if (stats.isDirectory()) {
      dirs.push(fullMaybeDir);
    }
  }
  if (dirs.length === 0) {
    throw new Error("error: extracted directory not found");
  }
  const extractedDir = dirs[0];
  if (dirs.length > 2) {
    console.warn(
      `More than one output directory found?! Using ${extractedDir}`
    );
  }
  const extractedFiles = await fs.readdir(extractedDir);
  for (const file of extractedFiles) {
    const finalFile = path.resolve(out, file);
    await fs.move(path.resolve(extractedDir, file), finalFile, {
      overwrite: true
    });
    console.error(`Wrote ${finalFile}`);
  }
  await fs.remove(tmpDir);
};

run(argv).catch(err => {
  console.error(err);
  process.exit(1);
});
