import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';

import pkg from '../package.json';

const VERSION = pkg.version;
const VERSION_LOCAL = './static/assets/VERSION';
const TMP_FILE = path.join(os.tmpdir(), `ryza-${VERSION}.zip`);
const RELEASE_URL = 'https://github.com/zeroa234/ryza-ai-revive/releases';

if (fs.existsSync(VERSION_LOCAL)) {
  const version = fs.readFileSync(VERSION_LOCAL, 'utf8').trim();
  if (version === VERSION) {
    console.info('Current local assets already updated. Assets extraction skipped.');
    process.exit(0);
  }
}

try {
  const file = Bun.file(TMP_FILE);
  const res = await fetch(`${RELEASE_URL}/download/v${pkg.version}/RyzaChat-${VERSION}.apk`);
  if (!res.ok) {
    console.error('Cannot get upstream release with version', VERSION, 'Error:', res.statusText);
    process.exit(1);
  }

  console.info('Downloading web assets for version', VERSION);
  await file.write(res);
  console.info('Web assets download completed!');

  console.info('Extracting assets...');
  exec(`unzip ${TMP_FILE} -d _extracted assets/assets/**`, (err) => {
    if (err) throw err;
    if (fs.existsSync('./static/assets'))
      // prettier-ignore
      fs.rmSync('./static/assets', { force:true, recursive: true });

    fs.renameSync('_extracted/assets/assets', 'static/assets');
    fs.rmSync('_extracted', { recursive: true });
    fs.rmSync(TMP_FILE, { force: true });
    fs.writeFileSync(VERSION_LOCAL, VERSION);
    console.info('Assets extracted into static/assets');
  });
} catch (e: any) {
  console.error('Cannot process downloaded archive. Error:', e.message);
}
