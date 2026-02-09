import PromptClient from './PromptClient';
import { getPrompts } from '../../lib/getPrompts';

export default function PromptPage() {
  const prompts = getPrompts();
  return <PromptClient prompts={prompts} />;
}
