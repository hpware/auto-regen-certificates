const path =
  process.env.NODE_ENV === "development" ? "./data/" : "/etc/cert-autogen/";

console.log("All arguments:", Bun.argv);
