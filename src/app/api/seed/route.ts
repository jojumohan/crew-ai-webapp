import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/firebase-admin';

// One-time seed: creates admin user and AI Agents in Firestore if not exists
// Call: POST /api/seed  with header x-seed-secret matching SEED_SECRET env var
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-seed-secret');
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 1. Admin User
  const existingAdmin = await db.collection('users').where('username', '==', 'joju').limit(1).get();
  if (existingAdmin.empty) {
    const hash = await bcrypt.hash('Crew2026!', 12);
    await db.collection('users').add({
      username: 'joju',
      display_name: 'Joju',
      email: 'aieurekaminds@gmail.com',
      password_hash: hash,
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
    });
  }

  // 2. AI Agents as Members
  const agents = [
    { username: 'agent_chief', display_name: 'AI Chief of Staff', role: 'agent', status: 'active', bio: 'Task management and standup bot.' },
    { username: 'agent_dev', display_name: 'AI Lead Developer', role: 'agent', status: 'active', bio: 'Technical lead and code reviewer.' }
  ];

  for (const agent of agents) {
    const existingAgent = await db.collection('users').where('username', '==', agent.username).limit(1).get();
    if (existingAgent.empty) {
      await db.collection('users').add({ ...agent, created_at: new Date().toISOString() });
    }
  }

  return NextResponse.json({ ok: true, message: 'Admin and AI Agents seeded successfully' });
}

