import ClientApp from './ClientApp';
import { getPrompts } from './lib/getPrompts';

export default function Page() {
  const prompts = getPrompts();
  return <ClientApp prompts={prompts} />;
}
