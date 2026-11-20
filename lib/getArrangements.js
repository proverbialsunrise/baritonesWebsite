import { readFile } from 'node:fs/promises';

const arrangementDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatArrangementDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const parts = arrangementDateFormatter.formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  return month && year ? `${month}, ${year}` : '';
}

export async function getArrangements(filename) {
  const data = await readFile(filename, 'utf8');
  const rawArrangements = JSON.parse(data);

  return rawArrangements
    .map((item) => ({
      item,
      timestamp: Date.parse(item.dateStr),
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ item }) => ({
      ...item,
      dateStr: formatArrangementDate(item.dateStr),
    }));
}
