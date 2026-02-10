import ClientApp from './ClientApp';
import { getPrompts } from '@/app/lib/getPrompts';


export const dynamic = 'force-static';

export default function Page() {
  const prompts = getPrompts();
  return <ClientApp prompts={prompts} />;
}
