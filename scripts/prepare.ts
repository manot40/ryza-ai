import pkg from '../package.json';

const VERSION = pkg.version;
const REPO_ASSETS_URL = 'https://github.com/zeroa234/ryza-ai-revive/archive/refs/tags';

console.info('Downloading web assets for version', VERSION);

try {
  const res = await fetch(`${REPO_ASSETS_URL}/v${pkg.version}.zip`);
  if (!res.ok) {
    console.error('Cannot get upstream archive with version', VERSION, 'Error:', res.statusText);
    process.exit(1);
  }

  const archive = new Bun.Archive(await res.blob());
  await archive.extract('./web', { glob: 'web/**' });
  console.info('Web assets download completed!');
} catch (e: any) {
  console.error('Cannot process downloaded archive. Error:', e.message);
}
