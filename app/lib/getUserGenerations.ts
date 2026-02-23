import { createClient } from './supabase-server'

export async function getUserGenerations() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('Error loading generations:', error)
    return []
  }

  // 🔒 Генерируем signed URLs
  const generationsWithSignedUrls = await Promise.all(
    data.map(async (gen) => {
      if (!gen.storage_path) return gen

      const { data: signedData, error: signedError } =
        await supabase.storage
          .from('generations-private')
          .createSignedUrl(gen.storage_path, 3600) // 1 час // 60 секунд

      if (signedError) {
        console.error('Signed URL error:', signedError)
        return gen
      }

      return {
        ...gen,
        image_url: signedData?.signedUrl ?? gen.image_url,
      }
    })
  )

  return generationsWithSignedUrls
}