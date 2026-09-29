import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

try {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('Usage: npm run test:e2e:report');
    console.log('Opens the latest HTML report in your default browser. The report identifies the environment.');
  } else {
    const report = fileURLToPath(new URL('reports/index.html', import.meta.url));
    try {
      await access(report);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      throw new Error('No report found. Run npm run test:e2e first (add --docker for Docker).');
    }
    const command = { darwin: 'open', linux: 'xdg-open' }[process.platform];
    if (!command) throw new Error(`Open this report manually on ${process.platform}: ${report}`);
    try {
      await promisify(execFile)(command, [report]);
    } catch (error) {
      throw new Error(`Could not open the browser (${error.message}). Open this report manually: ${report}`);
    }
    console.log(`Opened ${report}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}