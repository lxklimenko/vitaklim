import PromptClient from './PromptClient';
import { getPrompts } from '../../lib/getPrompts';

export const metadata = {
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default async function PromptPage() {
  const prompts = await getPrompts();
  return <PromptClient prompts={prompts} />;
}