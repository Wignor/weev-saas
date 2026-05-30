const MAX_BLOCK_CHARS = 250;

export function splitIntoBlocks(text: string): string[] {
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];
  if (normalized.length <= MAX_BLOCK_CHARS) return [normalized];

  const blocks: string[] = [];
  let remaining = normalized;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_BLOCK_CHARS) {
      blocks.push(remaining.trim());
      break;
    }

    const chunk = remaining.slice(0, MAX_BLOCK_CHARS);

    const para = chunk.lastIndexOf('\n\n');
    if (para > 20) {
      blocks.push(remaining.slice(0, para).trim());
      remaining = remaining.slice(para + 2).trim();
      continue;
    }

    const line = chunk.lastIndexOf('\n');
    if (line > 20) {
      blocks.push(remaining.slice(0, line).trim());
      remaining = remaining.slice(line + 1).trim();
      continue;
    }

    const sent = Math.max(
      chunk.lastIndexOf('. '), chunk.lastIndexOf('! '), chunk.lastIndexOf('? '),
      chunk.lastIndexOf('.\n'), chunk.lastIndexOf('!\n'), chunk.lastIndexOf('?\n'),
    );
    if (sent > 20) {
      blocks.push(remaining.slice(0, sent + 1).trim());
      remaining = remaining.slice(sent + 2).trim();
      continue;
    }

    const space = chunk.lastIndexOf(' ');
    if (space > 20) {
      blocks.push(remaining.slice(0, space).trim());
      remaining = remaining.slice(space + 1).trim();
      continue;
    }

    blocks.push(remaining.slice(0, MAX_BLOCK_CHARS).trim());
    remaining = remaining.slice(MAX_BLOCK_CHARS).trim();
  }

  return blocks.filter(b => b.length > 0);
}
