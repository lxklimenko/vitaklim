import ClientApp from './ClientApp';
import { getPrompts } from '@/app/lib/getPrompts';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const prompts = await getPrompts();
  return <ClientApp prompts={prompts} />;
}