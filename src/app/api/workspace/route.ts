import { auth } from '@/auth';
import { db } from '@/lib/firebase-admin';
import {
  getWorkspaceSnapshot,
  normalizeChannelSlug,
  type ChannelKind,
  type TeamRole,
} from '@/lib/workspace';
import { NextRequest, NextResponse } from 'next/server';

function isAdmin(session: { user?: unknown } | null | undefined) {
  return (session?.user as { role?: string } | undefined)?.role === 'admin';
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeIcon(value: unknown) {
  const icon = sanitizeText(value).slice(0, 2).toUpperCase();
  return icon || 'TM';
}

function isChannelKind(value: string): value is ChannelKind {
  return ['general', 'project', 'announcements', 'support'].includes(value);
}

function isTeamRole(value: string): value is TeamRole {
  return ['owner', 'admin', 'member'].includes(value);
}

async function requireSession() {
  const session = await auth();
  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      session: null,
    };
  }

  return { error: null, session };
}

async function requireAdmin() {
  const { error, session } = await requireSession();
  if (error || !session) return { error: error!, session: null };
  if (!isAdmin(session)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      session: null,
    };
  }

  return { error: null, session };
}

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const snapshot = await getWorkspaceSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error!;

  const body = await req.json();
  const action = body.action;
  const now = new Date().toISOString();
  const actorId = session.user?.id;

  if (!actorId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
  }

  if (action === 'createTeam') {
    const name = sanitizeText(body.name);
    const description = sanitizeText(body.description);
    const icon = sanitizeIcon(body.icon || name[0]);

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    const teamRef = db.collection('teams').doc();
    await teamRef.set({
      name,
      description,
      icon,
      visibility: 'private',
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('teamMembers').doc(`${teamRef.id}_${actorId}`).set({
      teamId: teamRef.id,
      userId: actorId,
      role: 'owner',
      joinedAt: now,
      addedBy: actorId,
    });

    await db.collection('channels').add({
      teamId: teamRef.id,
      name: 'General',
      slug: 'general',
      description: 'Team-wide updates, launches, and day-to-day coordination.',
      kind: 'general',
      isDefault: true,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, teamId: teamRef.id });
  }

  if (action === 'createChannel') {
    const teamId = sanitizeText(body.teamId);
    const name = sanitizeText(body.name);
    const description = sanitizeText(body.description);
    const kind = sanitizeText(body.kind || 'project');
    const slug = normalizeChannelSlug(body.slug || name);

    if (!teamId || !name) {
      return NextResponse.json({ error: 'Team and channel name are required' }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: 'Channel name is invalid' }, { status: 400 });
    }

    if (!isChannelKind(kind)) {
      return NextResponse.json({ error: 'Invalid channel type' }, { status: 400 });
    }

    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const existingChannels = await db.collection('channels').where('teamId', '==', teamId).get();
    const slugTaken = existingChannels.docs.some((doc) => (doc.data().slug ?? '') === slug);
    if (slugTaken) {
      return NextResponse.json({ error: 'A channel with that name already exists' }, { status: 409 });
    }

    await db.collection('channels').add({
      teamId,
      name,
      slug,
      description,
      kind,
      isDefault: false,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('teams').doc(teamId).update({ updatedAt: now });

    return NextResponse.json({ ok: true });
  }

  if (action === 'addMember') {
    const teamId = sanitizeText(body.teamId);
    const userId = sanitizeText(body.userId);
    const role = sanitizeText(body.role || 'member');

    if (!teamId || !userId) {
      return NextResponse.json({ error: 'Team and user are required' }, { status: 400 });
    }

    if (!isTeamRole(role)) {
      return NextResponse.json({ error: 'Invalid team role' }, { status: 400 });
    }

    const [teamDoc, userDoc] = await Promise.all([
      db.collection('teams').doc(teamId).get(),
      db.collection('users').doc(userId).get(),
    ]);

    if (!teamDoc.exists) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (!userDoc.exists || userDoc.data()?.status !== 'active') {
      return NextResponse.json({ error: 'User is not available to add' }, { status: 400 });
    }

    const membershipRef = db.collection('teamMembers').doc(`${teamId}_${userId}`);
    const membershipDoc = await membershipRef.get();
    if (membershipDoc.exists) {
      return NextResponse.json({ error: 'User is already in this team' }, { status: 409 });
    }

    await membershipRef.set({
      teamId,
      userId,
      role,
      joinedAt: now,
      addedBy: actorId,
    });

    await db.collection('teams').doc(teamId).update({ updatedAt: now });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const teamId = sanitizeText(body.teamId);
  const userId = sanitizeText(body.userId);
  const role = sanitizeText(body.role);

  if (!teamId || !userId || !role) {
    return NextResponse.json({ error: 'Team, user, and role are required' }, { status: 400 });
  }

  if (!isTeamRole(role)) {
    return NextResponse.json({ error: 'Invalid team role' }, { status: 400 });
  }

  const membershipRef = db.collection('teamMembers').doc(`${teamId}_${userId}`);
  const membershipDoc = await membershipRef.get();
  if (!membershipDoc.exists) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
  }

  if (membershipDoc.data()?.role === 'owner' && role !== 'owner') {
    const ownerCount = (
      await db.collection('teamMembers').where('teamId', '==', teamId).where('role', '==', 'owner').get()
    ).size;

    if (ownerCount <= 1) {
      return NextResponse.json({ error: 'Every team needs at least one owner' }, { status: 400 });
    }
  }

  await membershipRef.update({ role });
  await db.collection('teams').doc(teamId).update({ updatedAt: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { teamId, userId } = await req.json();
  const safeTeamId = sanitizeText(teamId);
  const safeUserId = sanitizeText(userId);

  if (!safeTeamId || !safeUserId) {
    return NextResponse.json({ error: 'Team and user are required' }, { status: 400 });
  }

  const membershipRef = db.collection('teamMembers').doc(`${safeTeamId}_${safeUserId}`);
  const membershipDoc = await membershipRef.get();
  if (!membershipDoc.exists) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
  }

  if (membershipDoc.data()?.role === 'owner') {
    const ownerCount = (
      await db.collection('teamMembers').where('teamId', '==', safeTeamId).where('role', '==', 'owner').get()
    ).size;

    if (ownerCount <= 1) {
      return NextResponse.json({ error: 'Every team needs at least one owner' }, { status: 400 });
    }
  }

  await membershipRef.delete();
  await db.collection('teams').doc(safeTeamId).update({ updatedAt: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}


