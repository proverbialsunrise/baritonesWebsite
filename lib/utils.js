import { readdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PHOTOS_DIR = path.join(import.meta.dirname, '..', 'public', 'img', 'perform');

export async function getImagesForPhotosPage(dirPath = DEFAULT_PHOTOS_DIR) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.jpe?g$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ filename: `/img/perform/${name}` }));
}
