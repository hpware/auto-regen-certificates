// ── Types & constants ────────────────────────────────────────────────
const VALID_OS = ["linux", "windows", "darwin"] as const;
const VALID_ARCH = ["x64", "arm64"] as const;

type OS = (typeof VALID_OS)[number];
type Arch = (typeof VALID_ARCH)[number];

interface Target {
  os: OS;
  arch: Arch;
  bunTarget: `bun-${OS}-${Arch}`;
  outfile: string;
}

const OS_LABELS: Record<OS, string> = {
  linux: "linux",
  windows: "windows",
  darwin: "mac",
};

// ── All supported build targets ──────────────────────────────────────
const ALL_TARGETS: Target[] = VALID_OS.flatMap((os) =>
  VALID_ARCH.map(
    (arch): Target => ({
      os,
      arch,
      bunTarget: `bun-${os}-${arch}`,
      outfile: `./dist/${OS_LABELS[os]}-${arch}`,
    }),
  ),
);

// ── Arg parsing ──────────  ────────────────────────────────────────────
function printUsage(): never {
  console.log(`Usage: bun run build [options]

Options:
  --os <os>          Target OS: ${VALID_OS.join(", ")} (can be repeated)
  --arch <arch>      Target arch: ${VALID_ARCH.join(", ")} (can be repeated)
  --all              Build all targets (default when no args given)
  --list             List all available targets
  --help, -h         Show this help message

Examples:
  bun run build                        # build all targets
  bun run build --os linux             # linux x64 + linux arm64
  bun run build --arch arm64           # all OSes, arm64 only
  bun run build --os linux --arch x64  # linux x64 only
  bun run build --os linux --os darwin # linux + mac, both arches`);
  process.exit(0);
}

function parseArgs(argv: string[]): { osFilter: OS[]; archFilter: Arch[] } {
  // Skip bun + script path
  const args = argv.slice(2);
  const osFilter: OS[] = [];
  const archFilter: Arch[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--help":
      case "-h":
        printUsage();
        break;
      case "--list":
        console.log("Available targets:");
        for (const t of ALL_TARGETS) {
          console.log(`  ${t.bunTarget}  ->  ${t.outfile}`);
        }
        process.exit(0);
        break;
      case "--all":
        // Explicitly requesting all — clear any filters
        osFilter.length = 0;
        archFilter.length = 0;
        return { osFilter, archFilter };
      case "--os": {
        const val = args[++i];
        if (!val || !VALID_OS.includes(val as OS)) {
          console.error(
            `Error: --os requires one of: ${VALID_OS.join(", ")} (got "${val ?? ""}")`,
          );
          process.exit(1);
        }
        if (!osFilter.includes(val as OS)) osFilter.push(val as OS);
        break;
      }
      case "--arch": {
        const val = args[++i];
        if (!val || !VALID_ARCH.includes(val as Arch)) {
          console.error(
            `Error: --arch requires one of: ${VALID_ARCH.join(", ")} (got "${val ?? ""}")`,
          );
          process.exit(1);
        }
        if (!archFilter.includes(val as Arch)) archFilter.push(val as Arch);
        break;
      }
      default:
        console.error(`Error: unknown option "${arg}"`);
        process.exit(1);
    }
  }

  return { osFilter, archFilter };
}

// ── Main ─────────────────────────────────────────────────────────────
const { osFilter, archFilter } = parseArgs(Bun.argv);

const targets = ALL_TARGETS.filter(
  (t) =>
    (osFilter.length === 0 || osFilter.includes(t.os)) &&
    (archFilter.length === 0 || archFilter.includes(t.arch)),
);

if (targets.length === 0) {
  console.error("No targets matched the given filters.");
  process.exit(1);
}

console.log(`Building ${targets.length} target(s)...\n`);

let failed = 0;
for (const target of targets) {
  const label = `${target.bunTarget} -> ${target.outfile}`;
  process.stdout.write(`  ${label} ... `);
  try {
    const result = await Bun.build({
      entrypoints: ["src/app/index.ts"],
      compile: {
        target: target.bunTarget,
        outfile: target.outfile,
      },
    });
    if (!result.success) {
      console.log("FAILED");
      for (const msg of result.logs) console.error(`    ${msg}`);
      failed++;
    } else {
      console.log("OK");
    }
  } catch (err) {
    console.log("ERROR");
    console.error(`    ${err}`);
    failed++;
  }
}

console.log(`\nDone. ${targets.length - failed}/${targets.length} succeeded.`);
if (failed > 0) process.exit(1);
