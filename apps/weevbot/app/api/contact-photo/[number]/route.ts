import { NextResponse } from 'next/server';
import { getProfilePictureUrl } from '@/lib/evolution';
import { redis } from '@/lib/redis';

export async function GET(_req: Request, { params }: { params: { number: string } }) {
  try {
    const { number } = params;
    const cacheKey = `photo:${number}`;

    const cached = await redis.get(cacheKey);
    if (cached) return NextResponse.json({ url: cached === 'null' ? null : cached });

    const url = await getProfilePictureUrl(number);
    await redis.set(cacheKey, url ?? 'null', 'EX', 3600);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: null });
  }
}
