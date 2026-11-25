import { CONFIG } from '../config/config.js';
import { getSupabaseClient } from './supabase.js';

function notConfiguredResult(fallbackData) {
  return {
    data: fallbackData,
    error: null,
    configured: false,
  };
}

export async function getAccessLogs(limit = 100) {
  const client = getSupabaseClient();
  if (!client) return notConfiguredResult([]);

  const { data, error } = await client
    .from(CONFIG.TABLES.LOGS)
    .select('id, card_id, uid, device_id, method, result, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data: data || [], error, configured: true };
}

export async function getCards() {
  const client = getSupabaseClient();
  if (!client) return notConfiguredResult([]);

  const { data, error } = await client
    .from(CONFIG.TABLES.CARDS)
    .select('id, uid, owner_name, is_active, created_at')
    .order('created_at', { ascending: false });

  return { data: data || [], error, configured: true };
}

export async function addCard({ uid, owner_name, is_active = true }) {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: null,
      error: new Error('Supabase belum dikonfigurasi di js/config/config.js'),
    };
  }

  const { data, error } = await client
    .from(CONFIG.TABLES.CARDS)
    .insert([{ uid, owner_name, is_active }]);

  return { data, error };
}

export async function toggleCardStatus(id, isActive) {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: null,
      error: new Error('Supabase belum dikonfigurasi di js/config/config.js'),
    };
  }

  const { data, error } = await client
    .from(CONFIG.TABLES.CARDS)
    .update({ is_active: isActive })
    .eq('id', id);

  return { data, error };
}

export async function getDashboardStats() {
  const client = getSupabaseClient();
  if (!client) {
    return {
      activeCards: 0,
      totalCards: 0,
      totalLogs: 0,
      error: null,
      configured: false,
    };
  }

  const [activeCardsRes, totalCardsRes, logsRes] = await Promise.all([
    client
      .from(CONFIG.TABLES.CARDS)
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    client.from(CONFIG.TABLES.CARDS).select('id', { count: 'exact', head: true }),
    client.from(CONFIG.TABLES.LOGS).select('id', { count: 'exact', head: true }),
  ]);

  const firstError = activeCardsRes.error || totalCardsRes.error || logsRes.error || null;

  return {
    activeCards: activeCardsRes.count ?? 0,
    totalCards: totalCardsRes.count ?? 0,
    totalLogs: logsRes.count ?? 0,
    error: firstError,
    configured: true,
  };
}

export async function getAppConfig() {
  const client = getSupabaseClient();
  if (!client) return notConfiguredResult({});

  const { data, error } = await client
    .from(CONFIG.TABLES.APP_CONFIG)
    .select('key, value');

  if (error) {
    return { data: {}, error, configured: true };
  }

  const configMap = {};
  (data || []).forEach((row) => {
    if (row && row.key) {
      configMap[row.key] = row.value;
    }
  });

  return { data: configMap, error: null, configured: true };
}
