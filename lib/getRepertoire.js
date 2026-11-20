import { readFile } from 'node:fs/promises';

export async function getRepertoire(filename) {
  const data = await readFile(filename, 'utf8');
  const repertoire = JSON.parse(data);
  repertoire.sort(compareTitles);
  return repertoire;
}

function compareTitles(rep1, rep2) {
  if (rep1.title < rep2.title) return -1;
  if (rep1.title > rep2.title) return 1;
  return 0;
}
