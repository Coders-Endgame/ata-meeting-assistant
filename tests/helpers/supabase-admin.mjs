import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

let envLoaded = false;

function loadEnv() {
  if (!envLoaded && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile('.env');
    envLoaded = true;
  }
}

function getRequiredEnv(name) {
  loadEnv();
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const TEST_PASSWORD = 'Test1234!';

export function createRunId(prefix = 'ata-test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || getRequiredEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function uniqueEmail(prefix = 'ata-user') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@gmail.com`;
}

export async function findUserByEmail(admin, email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      throw error;
    }

    const user = data.users.find((candidate) => candidate.email === email);
    if (user) {
      return user;
    }

    if (data.users.length < 200) {
      return null;
    }
    page += 1;
  }
}

export async function seedUser(options = {}) {
  const admin = options.admin ?? createAdminClient();
  const email = options.email ?? uniqueEmail();
  const password = options.password ?? TEST_PASSWORD;
  const firstName = options.firstName ?? 'Test';
  const lastName = options.lastName ?? 'User';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
    },
  });

  if (error) {
    throw error;
  }

  const user = data.user;
  await admin.from('profiles').upsert({
    id: user.id,
    first_name: firstName,
    last_name: lastName,
    email,
  });
  await admin.from('user_preferences').upsert(
    {
      user_id: user.id,
      preferred_model: process.env.OLLAMA_MODEL || 'llama3.1',
      preferred_language: 'en',
    },
    { onConflict: 'user_id' },
  );

  return { user, email, password };
}

export async function upsertUserPreferences(admin, userId, values = {}) {
  const payload = {
    user_id: userId,
    preferred_model: values.preferred_model ?? process.env.OLLAMA_MODEL ?? 'llama3.1',
    preferred_language: values.preferred_language ?? 'en',
  };

  const { error } = await admin.from('user_preferences').upsert(payload, {
    onConflict: 'user_id',
  });

  if (error) {
    throw error;
  }
}

export async function deleteUserById(admin, userId) {
  if (!userId) {
    return;
  }
  await admin.auth.admin.deleteUser(userId);
}

export async function deleteUserByEmail(admin, email) {
  const user = await findUserByEmail(admin, email);
  if (user) {
    await deleteUserById(admin, user.id);
  }
}

export async function seedSessionBundle(options = {}) {
  const admin = options.admin ?? createAdminClient();
  const sessionId = options.sessionId ?? randomUUID();
  const sourceType = options.sourceType ?? 'offline';
  const sourceRef = options.sourceRef ?? null;
  const processingStatus = options.processingStatus ?? 'completed';
  const ownerId = options.ownerId ?? null;
  const participantIds = options.participantIds ?? (ownerId ? [ownerId] : []);
  const transcripts = options.transcripts ?? [];
  const summary = options.summary ?? null;
  const actionItems = options.actionItems ?? [];

  const { error: sessionError } = await admin.from('sessions').insert({
    id: sessionId,
    source_type: sourceType,
    source_ref: sourceRef,
    processing_status: processingStatus,
  });

  if (sessionError) {
    throw sessionError;
  }

  for (const participantId of participantIds) {
    const { error } = await admin.from('session_member').insert({
      session_id: sessionId,
      user_id: participantId,
    });
    if (error) {
      throw error;
    }
  }

  if (transcripts.length > 0) {
    const transcriptRows = transcripts.map((entry, index) => ({
      id: entry.id ?? randomUUID(),
      session_id: sessionId,
      speaker: entry.speaker ?? 'Speaker',
      transcript: entry.transcript,
      timestamp_ms: entry.timestamp_ms ?? index * 1_000,
      created_at: entry.created_at ?? new Date(Date.now() + index * 1_000).toISOString(),
    }));
    const { error } = await admin.from('transcripts').insert(transcriptRows);
    if (error) {
      throw error;
    }
  }

  if (summary) {
    const { error } = await admin.from('summaries').insert({
      id: randomUUID(),
      session_id: sessionId,
      summary,
    });
    if (error) {
      throw error;
    }
  }

  for (const item of actionItems) {
    const actionItemId = item.id ?? randomUUID();
    const { error: actionItemError } = await admin.from('action_items').insert({
      id: actionItemId,
      session_id: sessionId,
      description: item.description,
      status: item.status ?? 'pending',
    });
    if (actionItemError) {
      throw actionItemError;
    }

    if (item.assignee) {
      const { error: assigneeError } = await admin.from('action_item_assignees').insert({
        id: randomUUID(),
        action_item_id: actionItemId,
        assigned_to: item.assignee,
      });
      if (assigneeError) {
        throw assigneeError;
      }
    }
  }

  return { sessionId };
}

export async function uploadAudioFixture(options = {}) {
  const admin = options.admin ?? createAdminClient();
  const userId = options.userId;
  const fixturePath = options.fixturePath;
  const fileName = options.fileName ?? `${Date.now()}.wav`;
  const bucket = options.bucket ?? 'audio-uploads';

  const contents = await readFile(fixturePath);
  const storagePath = `${userId}/${fileName}`;

  const { data, error } = await admin.storage.from(bucket).upload(storagePath, contents, {
    contentType: 'audio/wav',
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return data.path;
}

export async function getSession(admin, sessionId) {
  const { data, error } = await admin
    .from('sessions')
    .select('id, source_ref, source_type, processing_status')
    .eq('id', sessionId)
    .single();
  if (error) {
    throw error;
  }
  return data;
}

export async function getUserPreferences(admin, userId) {
  const { data, error } = await admin
    .from('user_preferences')
    .select('preferred_model, preferred_language, updated_at')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getSessionSummary(admin, sessionId) {
  const { data, error } = await admin
    .from('summaries')
    .select('summary')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function listSessionTranscripts(admin, sessionId) {
  const { data, error } = await admin
    .from('transcripts')
    .select('speaker, transcript, timestamp_ms, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function listSessionActionItems(admin, sessionId) {
  const { data, error } = await admin
    .from('action_items')
    .select('id, description, status, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function cleanupSessionBundle(admin, sessionId) {
  if (!sessionId) {
    return;
  }

  let sessionSourceRef = null;
  const { data: sessionData } = await admin
    .from('sessions')
    .select('source_ref')
    .eq('id', sessionId)
    .maybeSingle();
  sessionSourceRef = sessionData?.source_ref ?? null;

  const { data: actionItems } = await admin
    .from('action_items')
    .select('id')
    .eq('session_id', sessionId);

  const actionItemIds = (actionItems || []).map((item) => item.id);
  if (actionItemIds.length > 0) {
    await admin.from('action_item_assignees').delete().in('action_item_id', actionItemIds);
  }

  await admin.from('action_items').delete().eq('session_id', sessionId);
  await admin.from('summaries').delete().eq('session_id', sessionId);
  await admin.from('transcripts').delete().eq('session_id', sessionId);
  await admin.from('bots').delete().eq('session', sessionId);
  await admin.from('session_member').delete().eq('session_id', sessionId);
  await admin.from('sessions').delete().eq('id', sessionId);

  if (sessionSourceRef) {
    await admin.storage.from('audio-uploads').remove([sessionSourceRef]);
  }
}

export function fixturePath(...segments) {
  return path.join(process.cwd(), 'tests', 'fixtures', ...segments);
}
