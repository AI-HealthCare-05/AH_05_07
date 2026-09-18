const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);

function arg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0
    ? args[index + 1]
    : fallback;
}

function has(name) {
  return args.includes(name);
}

function sha256(file) {
  return createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function isInside(value, parent) {
  const relative = path.relative(
    parent,
    value,
  );

  return relative === ""
    || (
      !relative.startsWith("..")
      && !path.isAbsolute(relative)
    );
}

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(
      file,
      "utf8",
    ),
  );
}

function fail(message) {
  throw new Error(message);
}

const assetsArg = arg(
  "--assets",
  undefined,
);

assert(
  assetsArg,
  "--assets is required",
);

const assets = path.resolve(
  assetsArg,
);

const validateOnly = has(
  "--validate-only",
);

const outputArg = arg(
  "--output",
  undefined,
);

if (!validateOnly) {
  assert(
    outputArg,
    "--output is required unless --validate-only is used",
  );
}

const output = outputArg
  ? path.resolve(outputArg)
  : null;

const timeoutMs = Number(
  arg(
    "--timeout-ms",
    "900000",
  ),
);

assert(
  Number.isInteger(timeoutMs)
    && timeoutMs >= 60_000
    && timeoutMs <= 3_600_000,
  "--timeout-ms must be between 60000 and 3600000",
);

const browserChannel = arg(
  "--browser-channel",
  undefined,
);

assert(
  browserChannel === undefined
    || browserChannel === "chromium",
  "Use the default browser or --browser-channel chromium",
);

assert(
  fs.statSync(assets).isDirectory(),
  "candidate review asset root is not a directory",
);

assert(
  !isInside(assets, root),
  "candidate review assets must stay outside the repository",
);

const catalogFile = path.join(
  assets,
  "catalog.json",
);

const inputFile = path.join(
  assets,
  "candidate-review-input.json",
);

assert(
  fs.existsSync(catalogFile),
  "candidate review catalog is missing",
);

assert(
  fs.existsSync(inputFile),
  "candidate review input evidence is missing",
);

const catalog = readJson(
  catalogFile,
);

const input = readJson(
  inputFile,
);

assert.equal(
  catalog.schema_version,
  1,
);

assert.equal(
  catalog.animals.length,
  12,
);

assert.equal(
  input.documentType,
  "COMPANION_CANDIDATE_BROWSER_REVIEW_INPUT",
);

assert.equal(
  input.status,
  "prepared-not-qualified",
);

assert(
  [
    "world-v2",
    "optimized-v1",
  ].includes(input.family),
  "unsupported candidate family",
);

assert.equal(
  input.runtimeActivation,
  false,
);

assert.equal(
  input.r2Mutation,
  false,
);

assert.equal(
  input.productionQualified,
  false,
);

assert(
  Number.isInteger(
    input.speciesCount,
  )
    && input.speciesCount > 0,
);

assert(
  Number.isInteger(
    input.candidateCount,
  )
    && input.candidateCount > 0,
);

assert.equal(
  input.candidateCount,
  input.speciesCount * 2,
  "every reviewed species must have exactly two variants",
);

assert.equal(
  input.candidates.length,
  input.candidateCount,
);

const candidateIds = new Set();
const candidateSha = new Set();
const species = new Set();
const files = new Map();

for (const candidate of input.candidates) {
  assert(
    typeof candidate.candidateId === "string"
      && candidate.candidateId.length > 0,
  );

  assert(
    !candidateIds.has(
      candidate.candidateId,
    ),
    "duplicate candidateId in review input",
  );

  candidateIds.add(
    candidate.candidateId,
  );

  assert.match(
    candidate.sha256,
    /^[0-9a-f]{64}$/,
  );

  assert(
    !candidateSha.has(
      candidate.sha256,
    ),
    "duplicate candidate SHA-256 in review input",
  );

  candidateSha.add(
    candidate.sha256,
  );

  assert(
    typeof candidate.speciesKey === "string"
      && candidate.speciesKey.length > 0,
  );

  species.add(
    candidate.speciesKey,
  );

  assert(
    [
      "standard",
      "light",
    ].includes(
      candidate.viewerVariant,
    ),
  );

  assert(
    typeof candidate.reviewFile === "string"
      && candidate.reviewFile.length > 0
      && !candidate.reviewFile.includes("..")
      && !candidate.reviewFile.includes("\\")
      && !path.isAbsolute(
        candidate.reviewFile,
      ),
    "unsafe reviewFile",
  );

  const file = path.resolve(
    assets,
    candidate.reviewFile,
  );

  assert(
    isInside(
      file,
      assets,
    ),
    "reviewFile escaped asset root",
  );

  assert(
    fs.existsSync(file)
      && fs.statSync(file).isFile(),
    `missing review GLB: ${candidate.reviewFile}`,
  );

  assert.equal(
    fs.statSync(file).size,
    candidate.bytes,
    `byte mismatch: ${candidate.reviewFile}`,
  );

  assert.equal(
    sha256(file),
    candidate.sha256,
    `SHA-256 mismatch: ${candidate.reviewFile}`,
  );

  files.set(
    candidate.reviewFile,
    candidate,
  );
}

assert.equal(
  species.size,
  input.speciesCount,
);

const sortedSpecies = [
  ...species,
].sort();

const available = catalog.animals.filter(
  animal => (
    animal.standard
    && animal.light
  ),
);

assert.equal(
  available.length,
  input.speciesCount,
);

assert.deepEqual(
  available
    .map(animal => animal.id)
    .sort(),
  sortedSpecies,
);

for (const animal of available) {
  assert.equal(
    animal.status,
    "review_candidate",
  );

  for (const viewerVariant of [
    "standard",
    "light",
  ]) {
    const reviewFile = animal[
      viewerVariant
    ];

    assert(
      files.has(reviewFile),
      `${animal.id}/${viewerVariant} is not backed by candidate evidence`,
    );

    const candidate = files.get(
      reviewFile,
    );

    assert.equal(
      candidate.speciesKey,
      animal.id,
    );

    assert.equal(
      candidate.viewerVariant,
      viewerVariant,
    );
  }
}

const expectedClipVariantChecks =
  input.speciesCount * 2 * 7;

const validationSummary = {
  status:
    "validated-not-run",
  family:
    input.family,
  species:
    sortedSpecies,
  speciesCount:
    input.speciesCount,
  candidateCount:
    input.candidateCount,
  candidateInventorySha256:
    input.candidateInventorySha256,
  sourceArchiveSha256:
    input.sourceArchiveSha256,
  candidateReviewInputSha256:
    sha256(inputFile),
  catalogSha256:
    sha256(catalogFile),
  expectedClipVariantChecks,
  runtimeActivation:
    false,
  productionQualified:
    false,
};

if (validateOnly) {
  console.log(
    JSON.stringify(
      validationSummary,
    ),
  );

  process.exit(0);
}

assert(
  output !== null,
);

assert(
  !fs.existsSync(output),
  "use a new output directory; previous browser evidence must remain immutable",
);

assert(
  !isInside(
    output,
    root,
  ),
  "browser evidence output must stay outside the repository",
);

assert(
  !isInside(
    output,
    assets,
  )
    && !isInside(
      assets,
      output,
    ),
  "browser evidence and candidate assets must not overlap",
);

const distIndex = path.join(
  root,
  "web",
  "dist",
  "index.html",
);

assert(
  fs.existsSync(distIndex),
  "build web before running candidate browser qualification",
);

const defaultVendor = path.join(
  process.env.HOME
    || path.dirname(output),
  ".cache",
  "sk7-character-preview",
  "three-0.185.1",
);

const vendor = path.resolve(
  arg(
    "--vendor",
    defaultVendor,
  ),
);

assert(
  !isInside(
    vendor,
    root,
  ),
  "local Three.js vendor must stay outside the repository",
);

const vendorManifest = path.join(
  vendor,
  "vendor-manifest.json",
);

if (
  fs.existsSync(vendor)
  && !fs.existsSync(vendorManifest)
) {
  fail(
    "vendor directory exists without vendor-manifest.json; choose a clean vendor path",
  );
}

const verifier = path.join(
  __dirname,
  "verify.cjs",
);

const verifyArgs = [
  verifier,
  "--assets",
  assets,
  "--vendor",
  vendor,
  "--output",
  output,
  "--animals",
  sortedSpecies.join(","),
  "--timeout-ms",
  String(timeoutMs),
];

if (browserChannel) {
  verifyArgs.push(
    "--browser-channel",
    browserChannel,
  );
}

const python = process.env.PYTHON
  || "python3";

const execution = spawnSync(
  process.execPath,
  verifyArgs,
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHON: python,
    },
  },
);

assert.equal(
  execution.status,
  0,
  "existing character-preview browser verification failed",
);

const verificationFile = path.join(
  output,
  "verification.json",
);

assert(
  fs.existsSync(
    verificationFile,
  ),
  "verification.json was not produced",
);

const verification = readJson(
  verificationFile,
);

assert.equal(
  verification.status,
  "passed",
);

assert.equal(
  verification.availableAnimalsTested,
  input.speciesCount,
);

assert.equal(
  verification.clipVariantChecks,
  expectedClipVariantChecks,
);

assert.equal(
  verification.externalRequests,
  0,
);

assert.deepEqual(
  verification.errors,
  [],
);

assert.equal(
  verification.assetManifest.length,
  input.candidateCount,
);

const browserAssetSha = new Map(
  verification.assetManifest.map(
    item => [
      item.file,
      item.sha256,
    ],
  ),
);

for (const candidate of input.candidates) {
  assert.equal(
    browserAssetSha.get(
      candidate.reviewFile,
    ),
    candidate.sha256,
    `browser verifier identity mismatch: ${candidate.reviewFile}`,
  );
}

assert.equal(
  verification.samples.length,
  3,
  "expected 1366/390/320 browser samples",
);

assert.deepEqual(
  verification.samples.map(
    sample => sample.viewport.width,
  ),
  [
    1366,
    390,
    320,
  ],
);

const qualification = {
  documentType:
    "COMPANION_CANDIDATE_BROWSER_PREQUALIFICATION",
  status:
    "passed",
  scope:
    "isolated-character-preview-technical-prequalification",
  family:
    input.family,
  species:
    sortedSpecies,
  speciesCount:
    input.speciesCount,
  candidateCount:
    input.candidateCount,
  candidateIds:
    input.candidates.map(
      candidate => candidate.candidateId,
    ),
  candidateInventorySha256:
    input.candidateInventorySha256,
  sourceArchiveSha256:
    input.sourceArchiveSha256,
  candidateReviewInputSha256:
    sha256(inputFile),
  catalogSha256:
    sha256(catalogFile),
  browserVerificationSha256:
    sha256(verificationFile),
  availableAnimalsTested:
    verification.availableAnimalsTested,
  clipVariantChecks:
    verification.clipVariantChecks,
  checks:
    verification.checks,
  assetManifest:
    verification.assetManifest,
  samples:
    verification.samples,
  limitations: [
    ...verification.limitations,
    "This is isolated candidate technical pre-qualification, not SK7 S01/S02/S10 product integration qualification.",
    "This is not physical Android/iOS qualification.",
    "This is not final owner visual or art acceptance.",
    "This does not activate candidates, publish R2 objects, or change production runtime.",
  ],
  sk7RuntimeIntegrated:
    false,
  physicalDeviceQualified:
    false,
  artAccepted:
    false,
  productionReady:
    false,
};

const qualificationFile = path.join(
  output,
  "candidate-qualification.json",
);

assert(
  !fs.existsSync(
    qualificationFile,
  ),
  "candidate qualification summary already exists",
);

fs.writeFileSync(
  qualificationFile,
  JSON.stringify(
    qualification,
    null,
    2,
  ) + "\n",
);

console.log(
  JSON.stringify({
    status:
      "passed",
    family:
      input.family,
    species:
      input.speciesCount,
    candidates:
      input.candidateCount,
    clipVariantChecks:
      verification.clipVariantChecks,
    productionReady:
      false,
  }),
);
