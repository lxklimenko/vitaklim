import ClientApp from './ClientApp';
import { PROMPTS } from './constants/appConstants';

export default function Page() {
  return <ClientApp prompts={PROMPTS} />;
}
