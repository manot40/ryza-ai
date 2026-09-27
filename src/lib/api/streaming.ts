import { streamText } from 'ai';
import { config } from '$lib/stores/config.svelte';
import { parseTaggedReply, type TaggedReply } from './tags';
import { chat, getLlmProvider, prepareTurnContext, type ChatOptions } from './llm';

export interface StreamChatOptions extends ChatOptions {
  onFirstLineTags?: (tags: TaggedReply) => void;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(
  history: Array<{ role: string; content?: string }>,
  userText: string,
  opts: StreamChatOptions = {}
): Promise<TaggedReply> {
  const llm = config.get('llm');
  if (!llm.apiKey) throw new Error('NO_KEY');

  const { systemPrompt, messages } = prepareTurnContext(history, userText, opts);

  let result;
  try {
    const provider = getLlmProvider(llm);
    result = streamText({
      model: provider.chatModel(llm.model),
      system: systemPrompt,
      messages,
      temperature: Number(llm.temperature) || 0.9,
      maxOutputTokens: Number(llm.maxTokens) || 400,
      maxRetries: 0,
      abortSignal: opts.signal || AbortSignal.timeout(60000),
    });
  } catch {
    // If stream request fails to dispatch, fall back to standard non-streaming chat
    return chat(history, userText, opts);
  }

  let fullText = '';
  let firstLineTriggered = false;

  try {
    for await (const token of result.textStream) {
      fullText += token;
      opts.onToken?.(token);

      if (!firstLineTriggered && fullText.includes('\n')) {
        const firstLine = fullText.slice(0, fullText.indexOf('\n'));
        const earlyParsed = parseTaggedReply(firstLine);
        if (earlyParsed.emotion || earlyParsed.attitude) {
          opts.onFirstLineTags?.(earlyParsed);
        }
        firstLineTriggered = true;
      }
    }
  } catch {
    // Stream reading failed
  }

  if (!fullText) {
    return chat(history, userText, opts);
  }

  return parseTaggedReply(fullText);
}
