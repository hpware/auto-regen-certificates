import { Cron } from "croner";
import { access, mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";

// ── Configuration ────────────────────────────────────────────────────
const CERT_URL = process.env.CERT_URL;
if (!CERT_URL) {
  console.error("ERROR: CERT_URL environment variable is required.");
  process.exit(1);
}

const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "0 0 1 */2 *"; // Default: every 2 months on the 1st at midnight
const path =
  process.env.NODE_ENV === "development" ? "./data/" : "/etc/cert-autogen/";

await mkdir(path, { recursive: true });
await mkdir(`${path}jobs`, { recursive: true });
await mkdir(`${path}certificates`, { recursive: true });

// ── Types ────────────────────────────────────────────────────────────
interface AccountResponse {
  accountId: string;
  [key: string]: unknown;
}

interface GenerateResponse {
  certificateId: string;
  certificate: string;
  privateKey: string;
  [key: string]: unknown;
}

interface JobRecord {
  accountId: string;
  certificateId: string | null;
  createdAt: string;
  status: "pending" | "generated" | "revoked" | "error";
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────
function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function saveJob(job: JobRecord): Promise<void> {
  const filename = `${path}jobs/${job.accountId}.json`;
  await writeFile(filename, JSON.stringify(job, null, 2));
}

async function loadJob(accountId: string): Promise<JobRecord | null> {
  try {
    const data = await readFile(`${path}jobs/${accountId}.json`, "utf-8");
    return JSON.parse(data) as JobRecord;
  } catch {
    return null;
  }
}

async function getActiveJobs(): Promise<JobRecord[]> {
  const files = await readdir(`${path}jobs`);
  const jobs: JobRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = await readFile(`${path}jobs/${file}`, "utf-8");
      jobs.push(JSON.parse(data) as JobRecord);
    } catch {
      log(`Warning: could not read job file ${file}`);
    }
  }
  return jobs;
}

// ── API calls ────────────────────────────────────────────────────────
async function getAccount(): Promise<AccountResponse> {
  log("Requesting new account...");
  const res = await fetch(`${CERT_URL}/api/regen/account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Account request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as AccountResponse;
  log(`Account obtained: ${data.accountId}`);
  return data;
}

async function generateCertificate(accountId: string): Promise<GenerateResponse> {
  log(`Generating certificate for account ${accountId}...`);
  const res = await fetch(`${CERT_URL}/api/regen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) {
    throw new Error(`Generate request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as GenerateResponse;
  log(`Certificate generated: ${data.certificateId}`);
  return data;
}

async function revokeCertificate(accountId: string, certificateId: string): Promise<void> {
  log(`Revoking certificate ${certificateId} for account ${accountId}...`);
  const res = await fetch(`${CERT_URL}/api/regen/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, certificateId }),
  });
  if (!res.ok) {
    throw new Error(`Revoke request failed: ${res.status} ${res.statusText}`);
  }
  log(`Certificate ${certificateId} revoked successfully.`);
}

// ── Certificate regeneration workflow ────────────────────────────────
async function regenerateCertificates(): Promise<void> {
  log("=== Starting certificate regeneration cycle ===");

  try {
    // Step 1: Revoke all existing certificates from previous runs
    const existingJobs = await getActiveJobs();
    for (const job of existingJobs) {
      if (job.status === "generated" && job.certificateId) {
        try {
          await revokeCertificate(job.accountId, job.certificateId);
          job.status = "revoked";
          await saveJob(job);
        } catch (err) {
          log(`Warning: failed to revoke cert ${job.certificateId}: ${err}`);
        }
      }
    }

    // Step 2: Get a new account
    const account = await getAccount();

    const job: JobRecord = {
      accountId: account.accountId,
      certificateId: null,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    await saveJob(job);

    // Step 3: Generate a new certificate
    const cert = await generateCertificate(account.accountId);

    // Step 4: Save the certificate files
    const certDir = `${path}certificates/${account.accountId}`;
    await mkdir(certDir, { recursive: true });
    await writeFile(`${certDir}/certificate.pem`, cert.certificate);
    await writeFile(`${certDir}/privateKey.pem`, cert.privateKey);

    // Step 5: Update job record
    job.certificateId = cert.certificateId;
    job.status = "generated";
    await saveJob(job);

    log("=== Certificate regeneration cycle completed successfully ===");
  } catch (err) {
    log(`ERROR: Certificate regeneration failed: ${err}`);
  }
}

// ── Schedule cron job ────────────────────────────────────────────────
log(`Starting certificate auto-regeneration service`);
log(`CERT_URL: ${CERT_URL}`);
log(`Cron schedule: ${CRON_SCHEDULE}`);
log(`Data directory: ${path}`);

// Run immediately on startup
await regenerateCertificates();

// Schedule recurring runs
const job = new Cron(CRON_SCHEDULE, async () => {
  await regenerateCertificates();
});

log(`Next scheduled run: ${job.nextRun()?.toISOString() ?? "unknown"}`);
log("Service is running. Waiting for next scheduled cycle...");
