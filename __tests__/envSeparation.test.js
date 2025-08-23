import fs from 'fs';
import path from 'path';

function getJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.includes(path.join('pages', 'api'))) continue;
      files.push(...getJsFiles(full));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

describe('environment separation', () => {
  it('does not import env.server in client bundles', () => {
    const root = path.resolve(__dirname, '..');
    const files = getJsFiles(path.join(root, 'pages')).concat(getJsFiles(path.join(root, 'components')));
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/env\.server/);
    }
  });
});
