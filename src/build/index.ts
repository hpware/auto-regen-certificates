// Linux
// x64
await Bun.build({
  entrypoints: ["src/app/index.ts"],
  compile: {
    target: "bun-linux-x64",
    outfile: "./dist/linux-x64",
  },
});

// arm64
await Bun.build({
  entrypoints: ["src/app/index.ts"],
  compile: {
    target: "bun-linux-arm64",
    outfile: "./dist/linux-arm64",
  },
});

// Windows
// x64
await Bun.build({
  entrypoints: ["src/app/index.ts"],
  compile: {
    target: "bun-windows-x64",
    outfile: "./dist/windows-x64",
  },
});

//arm64
await Bun.build({
  entrypoints: ["src/app/index.ts"],
  compile: {
    target: "bun-windows-arm64",
    outfile: "./dist/windows-arm64",
  },
});

// MacOS
// arm64
await Bun.build({
  entrypoints: ["src/app/index.ts"],
  compile: {
    target: "bun-darwin-arm64",
    outfile: "./dist/mac-arm64",
  },
});

//x64
await Bun.build({
  entrypoints: ["src/app/index.ts"],
  compile: {
    target: "bun-darwin-x64",
    outfile: "./dist/mac-x64",
  },
});
