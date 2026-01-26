import * as fs from "node:fs";

const MARK = "/tmp/home-electron-bootstrap.txt";

try {
  fs.writeFileSync(MARK, `${new Date().toISOString()} bootstrap loaded\n`, {
    flag: "a",
  });
} catch {
  // ignore
}

// Load the real main process entry
// eslint-disable-next-line @typescript-eslint/no-var-requires
require("./main");
