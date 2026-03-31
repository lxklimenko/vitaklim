import PromptClient from './PromptClient';
import { getPrompts } from '../../lib/getPrompts';

export default async function PromptPage() {
  const prompts = await getPrompts();
  return <PromptClient prompts={prompts} />;
}