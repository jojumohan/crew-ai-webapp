import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'crypto';

// Simple bcrypt-compatible hash using pbkdf2 — for seeding only
// We'll store a known hash for Crew2026! that matches bcryptjs
// Instead, just use the hash directly from a known bcrypt run
const PASSWORD_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGqL/A6B5w5DkIVN6VqK5V6qK5q'; // placeholder
// We'll generate it properly using the Node crypto approach

const PROJECT_ID   = 'meetingaron-55180';
const CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@meetingaron-55180.iam.gserviceaccount.com';
const PRIVATE_KEY  = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDFqMTJtGtF/2MV
fSK/AonWlCa7aNHTUMqiIo+ijECrljIa3yFO7I/p1H78JmbsvQ1fFd3HljG/mW1T
u3BNV1O0VlRA87oRuw6VDkp2Uz39caxAqlFuDjiejgGuVzbZkkD/FyHdIeTg4jgp
nxh51j46t2ympq00A1+EYdDy4EkAly1RNUD8lzb3GWwt6W9iHJOyMrUUnGZPO3+R
acU/cplfnUuJTIq1D3oAHHipQBqdPK7iWMY38Eihx4nrTPjWqNCf2TXMJDt6epcL
20G7r/qfttp+sMnfqrM2BHi51v0XOulcVUefFsSPS6FCQfnrnM1bEGpV4N3oUBYj
IxamoJcHAgMBAAECggEAEArmd0qN9F9J5E9vl6+LOXUf1FEpypbBmOQ+N96zTFnt
6ibBtigBduSOLpqn+un4i7GjelSzPU5Pbx7aUA9Y61z1t1SGKHSVYT1eMiQHzCoY
Os1iu5CAQZoxV7xGEZBLId53m1I/beMz1L5QHGoU9etiRapnNL6wrMwgSz4vSVKs
iDUQZfpfh1vt11EYRdkG4tG5cw8pd/qCpL8QNlY+nTkdf4TAbJbM3KZFljdQlx3Z
s/TkWw2vpTBd+Rp336ZSjam4+s+01xTTcMzsnQiAeBq+/7zJUjbwHhWY5aoisfFp
QtfFZq6SU+4Z++j5cTgYU15xxMtLXvFG21a4A4qONQKBgQDz0i/wsv0tni/yjmz1
IzRRUIPUU0Ilm/sP+QgAVjcrY67ccnYHkfxFA2doSoFcGy4zS0VgYfSZ4pEPU8GW
P9H2MCqrkxdsKgvjb7fB+TtO2tRp5H9IiXrrED49Oa+t5QRhWRsGB+2HQTYSuo5W
9p9ASw7nL5otkS6WbRB6eXOl+wKBgQDPiEv564nv+xSvK191y/KQPmh6YbmmFz0B
RA9cOtOzUFYpsME5+Wz1sYRjJotmrZM0N8MU2vp4R74s8GpUlhugTnnyBFVEWvLJ
kv4sCxM6X/ErhgvRfEqa6hHHKbr9BahV9qYK9alSvvKIJxAhG1aoVjIEvw4O+Ovp
AFiqz5RhZQKBgH5Jmw0oGFy9d4ZB4QujnWCUvIOIUFWckhC24z8RaOfvbM2/94R6
R9kTJ0dsd85WQbrNvPRsKD5gjNQMhNOm4MCMOD3AJTygFqJJ5jrxNZflXmousQLI
OsNwGVyq+WSvn3Iwrf+UsaIB09klib5fZSLu/ZwfGtOJREEj4oodSBprAoGAVZj6
9VcQKrpd2q5CDl0TbClBgJDEONxG3jnLOBhPbxtInqN330igh2ozl42zW6NmHtiN
DxIO0wOMTg7PXJoZRPJ5W7grzyjQERIe4d2jjaU63N/KChqAzwqSUJpGtMvblbFI
5SZUM3vsnvm1rmIPSRlcQhbnXoePDiiFadZ6df0CgYEAsLeR8pO2YCIV3Jts0qkl
Q9ZLTLOmuyAQbpTz5fDFbeWgWk1R5Mt4aqgNoblu6xE8DzxYTt6K2f4RFtOn7Rpy
b44k+p4qQr7KnBfk7gp23v0qrSJzNrjRJbzZo1V/5v3LoPh6BMyx87ULBk/JHmBX
5OM+UMpDKsec/PY/XG0RnuY=
-----END PRIVATE KEY-----`;

initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: CLIENT_EMAIL, privateKey: PRIVATE_KEY }) });
const db = getFirestore();

// Hash password using bcryptjs
import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('Crew2026!', 12);
console.log('Password hashed');

// Seed admin user
const existingAdmin = await db.collection('users').where('username', '==', 'joju').limit(1).get();
if (existingAdmin.empty) {
  await db.collection('users').add({
    username: 'joju',
    display_name: 'Joju',
    email: 'aieurekaminds@gmail.com',
    password_hash: hash,
    role: 'admin',
    status: 'active',
    created_at: new Date().toISOString(),
  });
  console.log('Admin user seeded');
} else {
  console.log('Admin user already exists');
}

// Seed AI agents
const agents = [
  { username: 'agent_chief', display_name: 'AI Chief of Staff', role: 'agent', status: 'active', bio: 'Task management and standup bot.' },
  { username: 'agent_dev',   display_name: 'AI Lead Developer',  role: 'agent', status: 'active', bio: 'Technical lead and code reviewer.' }
];

for (const agent of agents) {
  const existing = await db.collection('users').where('username', '==', agent.username).limit(1).get();
  if (existing.empty) {
    await db.collection('users').add({ ...agent, created_at: new Date().toISOString() });
    console.log(`Seeded ${agent.display_name}`);
  } else {
    console.log(`${agent.display_name} already exists`);
  }
}

console.log('Done!');
