import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/firebase-admin';

// POST — approve or reject a pending user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session.user as any).role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, action } = await req.json(); // action: 'approve' | 'reject'
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const ref = db.collection('users').doc(id);

  if (action === 'approve') {
    await ref.update({ status: 'active' });
  } else {
    // Only delete if still pending
    const doc = await ref.get();
    if (doc.exists && doc.data()?.status === 'pending') {
      await ref.delete();
    }
  }

  return NextResponse.json({ ok: true });
}
