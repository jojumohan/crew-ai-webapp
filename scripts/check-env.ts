import 'dotenv/config';

type EnvEntry = {
  name: string;
  description: string;
  required: boolean;
};

const entries: EnvEntry[] = [
  {
    name: 'AUTH_SECRET',
    description: 'NextAuth signing secret',
    required: true,
  },
  {
    name: 'NEXTAUTH_URL',
    description: 'Public app URL used by auth callbacks',
    required: true,
  },
  {
    name: 'DATABASE_URL',
    description: 'Optional PostgreSQL connection string if you later want a SQL backend',
    required: false,
  },
  {
    name: 'FIREBASE_PROJECT_ID',
    description: 'Firebase admin project id for login and messaging',
    required: true,
  },
  {
    name: 'FIREBASE_CLIENT_EMAIL',
    description: 'Firebase admin client email for login and messaging',
    required: true,
  },
  {
    name: 'FIREBASE_PRIVATE_KEY',
    description: 'Firebase admin private key for login and messaging',
    required: true,
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_API_KEY',
    description: 'Legacy Firebase client SDK',
    required: false,
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    description: 'Legacy Firebase client SDK',
    required: false,
  },
  {
    name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    description: 'Legacy Firebase client SDK',
    required: false,
  },
  {
    name: 'AGENT_URL',
    description: 'Legacy agent, meeting, and email integrations',
    required: false,
  },
  {
    name: 'SEED_SECRET',
    description: 'Legacy seed and automation endpoints',
    required: false,
  },
  {
    name: 'GROQ_API_KEY',
    description: 'Optional standup transcript notes',
    required: false,
  },
  {
    name: 'SARVAM_API_KEY',
    description: 'Optional speech and TTS routes',
    required: false,
  },
  {
    name: 'VAPID_PUBLIC_KEY',
    description: 'Optional push notifications',
    required: false,
  },
  {
    name: 'VAPID_PRIVATE_KEY',
    description: 'Optional push notifications',
    required: false,
  },
  {
    name: 'VAPID_EMAIL',
    description: 'Optional push notifications',
    required: false,
  },
  {
    name: 'GOOGLE_CALENDAR_ID',
    description: 'Optional calendar routes',
    required: false,
  },
  {
    name: 'GOOGLE_CALENDAR_API_KEY',
    description: 'Optional calendar routes',
    required: false,
  },
  {
    name: 'CALENDAR_CREATE_SECRET',
    description: 'Optional protected calendar creation route',
    required: false,
  },
  {
    name: 'DAILY_API_KEY',
    description: 'Optional Daily.co room creation',
    required: false,
  },
];

function readValue(name: string): string {
  return (process.env[name] || '').trim();
}

function isPresent(name: string): boolean {
  return readValue(name).length > 0;
}

function isValidDatabaseUrl(value: string): boolean {
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

const missingRequired = entries.filter((entry) => entry.required && !isPresent(entry.name));
const invalidDatabaseUrl =
  isPresent('DATABASE_URL') && !isValidDatabaseUrl(readValue('DATABASE_URL'));

console.log('Environment check');
console.log('');

for (const entry of entries) {
  const status = isPresent(entry.name) ? 'OK' : entry.required ? 'MISSING' : 'OPTIONAL';
  console.log(`${status.padEnd(8)} ${entry.name} - ${entry.description}`);
}

console.log('');
console.log('Notes');
console.log('- Firebase admin vars are now the primary backend requirement for login and messaging.');
console.log('- DATABASE_URL is optional and only relevant if you later add a PostgreSQL backend.');
console.log('- If DATABASE_URL is set, it must be PostgreSQL. MySQL URLs will not work.');
console.log('- Optional vars only matter if you still use the older calendar, push, agent, or media routes.');

if (invalidDatabaseUrl) {
  console.error('');
  console.error('DATABASE_URL is set, but it is not a PostgreSQL URL.');
  process.exitCode = 1;
} else if (missingRequired.length > 0) {
  console.error('');
  console.error(
    `Missing required vars: ${missingRequired.map((entry) => entry.name).join(', ')}`
  );
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Core messaging config looks ready.');
}
