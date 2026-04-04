import { build as viteBuild } from 'vite';

async function run() {
  try {
    await viteBuild();
    // Work around vite-prerender-plugin + React 19 leaving the process alive
    // after a successful build even though output files are already written.
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

await run();
