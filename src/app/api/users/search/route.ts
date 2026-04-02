import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getUserId } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? '';
  if (!q) return NextResponse.json([]);

  const snap = await adminDb.collection('users').limit(50).get();

  const results = snap.docs
    .filter((doc) => {
      if (doc.id === userId) return false;
      const d = doc.data();
      return (
        d.display_name?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.username?.toLowerCase().includes(q)
      );
    })
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        displayName: d.display_name ?? 'Unknown',
        email: d.email ?? '',
        avatarUrl: d.avatar_url ?? null,
        isOnline: false,
      };
    });

  return NextResponse.json(results);
}
