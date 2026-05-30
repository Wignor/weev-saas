const MAX = 250;

export function splitIntoBlocks(text: string): string[] {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];
  if (normalized.length <= MAX) return [normalized];

  const blocks: string[] = [];
  let rem = normalized;
  while (rem.length > 0) {
    if (rem.length <= MAX) { blocks.push(rem.trim()); break; }
    const chunk = rem.slice(0, MAX);
    const para = chunk.lastIndexOf('\n\n');
    if (para > 20) { blocks.push(rem.slice(0, para).trim()); rem = rem.slice(para + 2).trim(); continue; }
    const line = chunk.lastIndexOf('\n');
    if (line > 20) { blocks.push(rem.slice(0, line).trim()); rem = rem.slice(line + 1).trim(); continue; }
    const sent = Math.max(chunk.lastIndexOf('. '), chunk.lastIndexOf('! '), chunk.lastIndexOf('? '));
    if (sent > 20) { blocks.push(rem.slice(0, sent + 1).trim()); rem = rem.slice(sent + 2).trim(); continue; }
    const space = chunk.lastIndexOf(' ');
    if (space > 20) { blocks.push(rem.slice(0, space).trim()); rem = rem.slice(space + 1).trim(); continue; }
    blocks.push(rem.slice(0, MAX).trim()); rem = rem.slice(MAX).trim();
  }
  return blocks.filter(b => b.length > 0);
}
