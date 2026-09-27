import { config } from '$lib/stores/config.svelte';
import { buildSystemPrompt, withTurnCue } from './prompt';
import { estMessages, attachThinking } from './thinking';
import { parseTaggedReply, type TaggedReply, type ScreenTagState } from './tags';
import {
  localProxy,
  upstreamUrl,
  chat,
  replyLang,
  resolvedContext,
  getModelMeta,
  type ChatOptions,
} from './index';

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

  const st = config.get('state');
  const outLang = opts.lang || replyLang();
  const system = buildSystemPrompt({
    mode: opts.mode || st.mode,
    style: opts.style || st.style,
    rpgContext: opts.rpgContext || '',
    outLang,
    nsfwSection: opts.nsfwSection || '',
    sceneSection: opts.sceneSection || '',
    memorySection: opts.memoryBlock || '',
    tagState: opts.tagState,
  });

  const keep = Math.max(0, (llm.historyTurns || 12) * 2);
  let hist = (history || []).slice(-keep);
  const ctx = resolvedContext();
  const reserve = Math.max(256, Number(llm.maxTokens) || 400) + 96;
  const budget = Math.max(1024, ctx - reserve);

  function pack(h: Array<{ role: string; content?: string }>) {
    return [
      { role: 'system', content: system },
      ...h,
      { role: 'user', content: withTurnCue(userText, opts.tagState) },
    ];
  }

  let used = estMessages(pack(hist));
  while (hist.length > 2 && used > budget) {
    hist = hist.slice(2);
    used = estMessages(pack(hist));
  }

  if (used > budget * 0.85 && opts.onPressure) {
    try {
      opts.onPressure();
    } catch {}
  }

  const body: Record<string, unknown> = {
    model: llm.model,
    messages: pack(hist),
    temperature: Number(llm.temperature) || 0.9,
    max_tokens: Number(llm.maxTokens) || 400,
    stream: true,
  };
  attachThinking(body, llm, getModelMeta());

  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${llm.apiKey}`,
    'api-key': llm.apiKey,
  });

  const url = localProxy(upstreamUrl(llm.baseUrl, '/chat/completions'));

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts.signal || AbortSignal.timeout(60000),
    });
  } catch {
    // If stream request fails to dispatch, fall back to standard non-streaming chat
    return chat(history, userText, opts);
  }

  if (!res.ok || !res.body) {
    return chat(history, userText, opts);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let lineBuffer = '';
  let firstLineTriggered = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      lineBuffer += chunk;
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              fullText += delta;
              opts.onToken?.(delta);

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
            // Ignore malformed chunk
          }
        }
      }
    }
  } catch {
    if (!fullText) {
      return chat(history, userText, opts);
    }
  }

  return parseTaggedReply(fullText);
}
