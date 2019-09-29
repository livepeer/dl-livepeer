const https = require("https");
const fs = require("fs-extra");
const path = require("path");
const fetch = require("isomorphic-fetch");
const os = require("os");
const tar = require("tar");

(async () => {
  const branchRes = await fetch(
    "https://api.github.com/repos/livepeer/go-livepeer/git/refs/heads/master"
  );
  const versionRes = await fetch(
    "https://raw.githubusercontent.com/livepeer/go-livepeer/master/VERSION"
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
  const outputDir = path.resolve(os.tmpdir(), `livepeer-${fullVersion}`);
  await fs.ensureDir(outputDir);
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
  const outputFile = path.resolve(outputDir, filename);
  successfulRes.body.pipe(fs.createWriteStream(outputFile));
  await new Promise(r => successfulRes.body.on("end", r));
  console.error(`Downloaded to ${outputFile}`);
  const finalOutputDir = path.resolve(os.homedir(), "bin");
  if (outputFile.endsWith(".tar.gz")) {
    await tar.extract({
      file: outputFile,
      cwd: outputDir
    });
  }
  const dirs = (await fs.readdir(outputDir, { withFileTypes: true })).filter(
    dirent => dirent.isDirectory()
  );
  if (dirs.length === 0) {
    throw new Error("error: extracted directory not found");
  }
  const extractedDir = path.resolve(outputDir, dirs[0].name);
  if (dirs.length > 2) {
    console.warn(
      `More than one output directory found?! Using ${extractedDir}`
    );
  }
  const extractedFiles = await fs.readdir(extractedDir);
  for (const file of extractedFiles) {
    const finalFile = path.resolve(process.cwd(), file);
    await fs.move(path.resolve(extractedDir, file), finalFile);
    console.error(`Wrote ${finalFile}`);
  }
  await fs.remove(outputDir);
})();

// const file = fs.createWriteStream("file.jpg");
// const request = https.get(
//   "http://i3.ytimg.com/vi/J---aiyznGQ/mqdefault.jpg",
//   function(response) {
//     response.pipe(file);
//   }
// );
