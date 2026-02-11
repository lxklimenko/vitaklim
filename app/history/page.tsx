import { getUserGenerations } from '@/app/lib/getUserGenerations'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const generations = await getUserGenerations()

  return <HistoryClient initialGenerations={generations} />
}
