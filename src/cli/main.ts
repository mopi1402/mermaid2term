#!/usr/bin/env node

import { main } from "./cli.js";

// Never process.exit: a pipe drains asynchronously, and exiting on the heels of the last write cuts its tail.
process.exitCode = await main(process.argv.slice(2));
