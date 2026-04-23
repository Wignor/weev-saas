import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const TRACCAR_URL = process.env.TRACCAR_URL || 'http://localhost:8082';

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wt_session')?.value;
  if (!session) return NextResponse.json({});

  try {
    const usersRes = await fetch(`${TRACCAR_URL}/api/users`, {
      headers: { Cookie: `JSESSIONID=${session}` },
      cache: 'no-store',
    });
    if (!usersRes.ok) return NextResponse.json({});

    const users = await usersRes.json();
    const clients = users.filter((u: { administrator: boolean }) => !u.administrator);

    const assignments: Record<number, string> = {};

    await Promise.all(
      clients.map(async (client: { id: number; name: string }) => {
        try {
          const devRes = await fetch(`${TRACCAR_URL}/api/devices?userId=${client.id}`, {
            headers: { Cookie: `JSESSIONID=${session}` },
            cache: 'no-store',
          });
          if (!devRes.ok) return;
          const devices = await devRes.json();
          for (const d of devices) {
            assignments[d.id] = client.name;
          }
        } catch { /* silencioso */ }
      })
    );

    return NextResponse.json(assignments);
  } catch {
    return NextResponse.json({});
  }
}
