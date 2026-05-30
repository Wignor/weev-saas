import OpenAI from 'openai';

type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export async function generateSpeech(
  apiKey: string,
  text: string,
  voice: string = 'nova'
): Promise<Buffer | null> {
  if (!text.trim()) return null;
  try {
    const client = new OpenAI({ apiKey });
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice: (voice as TTSVoice) || 'nova',
      input: text.slice(0, 4096),
      response_format: 'opus',
    });
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error('[tts]', err);
    return null;
  }
}
