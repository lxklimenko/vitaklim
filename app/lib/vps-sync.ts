const DEFAULT_SYNC_TIMEOUT_MS = 5000;

type SupabaseRow = Record<string, unknown>;

type SupabaseQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => Promise<{ data: SupabaseRow | null; error: unknown }>;
        maybeSingle?: () => Promise<{ data: SupabaseRow | null; error: unknown }>;
      };
    };
  };
};

type SupabaseLikeClient = unknown;

function getSyncConfig() {
  const url = process.env.VPS_SYNC_URL;
  const secret = process.env.VPS_SYNC_SECRET;

  if (!url || !secret) return null;

  return {
    url: url.replace(/\/$/, ""),
    secret,
  };
}

export async function syncToVps(table: string, payload: Record<string, unknown> | null | undefined) {
  const config = getSyncConfig();
  if (!config || !payload?.id) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.url}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.secret}`,
      },
      body: JSON.stringify({ table, payload }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("VPS sync failed:", table, response.status, text);
    }
  } catch (error) {
    console.error("VPS sync request failed:", table, error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncSupabaseRow(
  supabase: SupabaseLikeClient,
  table: string,
  id: string | null | undefined,
) {
  if (!id) return;

  try {
    const client = supabase as SupabaseQueryClient;
    const query = client.from(table).select("*").eq("id", id);
    const { data, error } = query.maybeSingle
      ? await query.maybeSingle()
      : await query.single!();

    if (error) {
      console.error("VPS sync row fetch failed:", table, id, error);
      return;
    }

    await syncToVps(table, data as Record<string, unknown>);
  } catch (error) {
    console.error("VPS sync row failed:", table, id, error);
  }
}

export async function syncProfile(supabase: SupabaseLikeClient, userId: string | null | undefined) {
  await syncSupabaseRow(supabase, "profiles", userId);
}

export async function syncGeneration(supabase: SupabaseLikeClient, generationId: string | null | undefined) {
  await syncSupabaseRow(supabase, "generations", generationId);
}
