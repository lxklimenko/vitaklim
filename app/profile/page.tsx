import { createClient } from '@/app/lib/supabase-server'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <ProfileClient initialProfile={null} />
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('telegram_username, telegram_first_name, telegram_avatar_url, balance')
    .eq('id', user.id)
    .single()

  return <ProfileClient initialProfile={profile} />
}