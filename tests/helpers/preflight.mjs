import { existsSync } from 'node:fs';

if (!existsSync('.env')) {
  console.error('Missing .env. The real-stack tests require the configured local environment.');
  process.exit(1);
}

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const mode = process.argv[2] ?? 'all';
const missingEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
  (name) => !process.env[name],
);

if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const checks = [
  {
    name: 'API',
    url: 'http://127.0.0.1:3001/health',
  },
  {
    name: 'Summarizer',
    url: 'http://127.0.0.1:8000/health',
  },
  {
    name: 'Ollama',
    url: `${process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'}/api/tags`,
  },
];

if (mode === 'e2e' || mode === 'all') {
  checks.unshift({
    name: 'Frontend',
    url: 'http://127.0.0.1:5173',
  });
}

const failures = [];
for (const check of checks) {
  try {
    const response = await fetch(check.url);
    if (!response.ok) {
      failures.push(`${check.name} responded with HTTP ${response.status} at ${check.url}`);
    }
  } catch (error) {
    failures.push(`${check.name} is not reachable at ${check.url}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error('Real-stack preflight failed.');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error('Start the local stack first, for example with ./start.sh, then rerun the test command.');
  process.exit(1);
}

console.log(`Real-stack preflight passed for mode: ${mode}`);
