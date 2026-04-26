const VPS_SYNC_URL = process.env.VPS_SYNC_URL;
const VPS_SYNC_SECRET = process.env.VPS_SYNC_SECRET;

async function vpsGet(path: string) {
  if (!VPS_SYNC_URL || !VPS_SYNC_SECRET) return null;
  try {
    const res = await fetch(`${VPS_SYNC_URL}${path}`, {
      headers: { Authorization: `Bearer ${VPS_SYNC_SECRET}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? json.data : null;
  } catch {
    return null;
  }
}

export async function getProfileFromVps(userId: string) {
  return vpsGet(`/profile/${userId}`);
}

export async function getProfileByTelegramId(telegramId: string | number) {
  return vpsGet(`/profile-by-telegram/${telegramId}`);
}

export async function getGenerationFromVps(id: string) {
  return vpsGet(`/generation/${id}`);
}

export async function getGenerationsFromVps(userId: string, limit = 20, offset = 0) {
  return vpsGet(`/generations?userId=${userId}&limit=${limit}&offset=${offset}`);
}

export async function getProfileByMaxUserId(maxUserId: string | number) {
  return vpsGet(`/profile-by-max/${maxUserId}`);
}
