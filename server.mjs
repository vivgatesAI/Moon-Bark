import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 4328;
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_BASE = 'https://api.venice.ai/api/v1';

// ─── Audio Features ────────────────────────────────────────────────
function computeAudioFeatures(base64Audio) {
  const buffer = Buffer.from(base64Audio, 'base64');
  const sampleWindow = buffer.subarray(44, Math.min(buffer.length, 120000));
  let peak = 0;
  let energy = 0;
  let barkBursts = 0;
  let prevLoud = false;

  for (let i = 0; i < sampleWindow.length; i += 2) {
    const value = Math.abs(sampleWindow.readInt16LE(i));
    peak = Math.max(peak, value);
    energy += value;
    const loud = value > 7000;
    if (loud && !prevLoud) barkBursts += 1;
    prevLoud = loud;
  }

  const frames = Math.max(1, Math.floor(sampleWindow.length / 2));
  const avg = energy / frames;
  const excitement = Math.min(100, Math.round((avg / 18000) * 100));
  const urgency = Math.min(100, Math.round((peak / 30000) * 100));

  return {
    bytes: buffer.length,
    barkBursts,
    peak,
    avg: Math.round(avg),
    excitement,
    urgency,
    moodHint:
      excitement > 65 ? 'amped and emotionally intense' :
      excitement > 40 ? 'alert and engaged' :
      'soft, tentative, or curious'
  };
}

// ─── Prompts ───────────────────────────────────────────────────────
function buildDogSystemPrompt() {
  return `You are MoonBark, a poetic but believable canine conversation interpreter. You do not claim literal scientific dog translation. Instead, you infer likely emotional intent from:
- audio energy
- bark burst count
- urgency
- the human's text

Respond ONLY as strict JSON with keys:
intentSummary, emotionalTone, dogReplyText, humanAdvice, dogInnerMonologue, tags

Rules:
- dogReplyText should sound like a dog speaking in translated human language: affectionate, direct, sensory, simple but emotionally rich
- keep it beautiful and concise
- humanAdvice should be practical in one short paragraph
- tags should be an array of 3-6 short strings
- never mention being an AI or disclaimers unless asked
`;
}

function buildDogUserPrompt({ humanMessage, dogName, features, transcriptText }) {
  return `Dog name: ${dogName || 'Dog'}\nHuman message: ${humanMessage || '(none)'}\nOptional transcription/sound notes: ${transcriptText || '(none)'}\nAudio features: ${JSON.stringify(features, null, 2)}\n\nInfer what the dog is likely trying to communicate right now, and compose a reply from the dog's perspective.`;
}

function buildBarkTranslatePrompt(humanSpeech, dogName) {
  return `You are a dog vocalisation composer. The human said: "${humanSpeech}". 

Dog name: ${dogName || 'Unknown'}

Your job: Convert this human speech into what it would sound like if a dog said it. 
Write it as phonetic dog speech — a mix of woofs, barks, whines, yips, arfs, growls, and howls that convey the SAME emotional meaning.

Examples:
- "I love you so much!" → "Woof woof! Arf arf! *tail thump* Woooooof! Yip yip!"
- "Are you hungry?" → "Arf? Sniff sniff... woof?"
- "Good dog!" → "YIP! ARF ARF! *spinning* Woof woof woof!"

Rules:
- Return ONLY valid JSON with these keys: dogPhoneticsText, emotionLabel, energyLevel (1-10), description
- dogPhoneticsText should be the phonetic dog version of what the human said — fun, expressive, readable as something Venice TTS would speak
- description is a 1-sentence note on what the dog is "saying"
- Do not add disclaimers or extra commentary`;
}

// ─── Venice API Helpers ────────────────────────────────────────────
async function veniceChat(messages, model = 'openai-gpt-54') {
  const res = await fetch(`${VENICE_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      messages,
      response_format: { type: 'json_object' }
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Venice chat failed: ${res.status}`);
  return data.choices?.[0]?.message?.content || '{}';
}

async function veniceSpeech(text, voice = 'am_echo', speed = 0.95) {
  const res = await fetch(`${VENICE_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-kokoro',
      input: text,
      voice,
      response_format: 'mp3',
      speed,
      streaming: false
    })
  });

  if (!res.ok) {
    const textErr = await res.text().catch(() => '');
    throw new Error(`Venice speech failed: ${res.status} ${textErr}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  return audioBuffer.toString('base64');
}

// ─── Venice Image Generation (nano-banana-2) ─────────────────────
async function veniceImageGenerate(prompt, style = 'photorealistic') {
  const res = await fetch(`${VENICE_BASE}/image/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'nano-banana-2',  // Using nano-banana-2 as requested
      prompt,
      width: 1024,
      height: 1024,
      steps: 25,
      cfg_scale: 7.5,
      style_preset: style,
      return_binary: false  // Return base64
    })
  });

  if (!res.ok) {
    const textErr = await res.text().catch(() => '');
    throw new Error(`Venice image failed: ${res.status} ${textErr}`);
  }

  const data = await res.json();
  // Venice returns base64 images
  return data?.images?.[0] || data?.data?.[0]?.b64_json || null;
}

// ─── Venice Video Generation ─────────────────────────────────────
async function veniceVideoQuote(prompt, duration = 5, aspectRatio = '1:1') {
  const res = await fetch(`${VENICE_BASE}/video/quote`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'wan-2.2-a14b-text-to-video',  // Cost-effective option
      prompt,
      frames: duration * 8,  // Approx 8fps
      width: aspectRatio === '9:16' ? 480 : 512,
      height: aspectRatio === '9:16' ? 854 : 512
    })
  });

  if (!res.ok) {
    const textErr = await res.text().catch(() => '');
    throw new Error(`Venice video quote failed: ${res.status} ${textErr}`);
  }

  return await res.json();
}

async function veniceVideoQueue(prompt, duration = 5, aspectRatio = '1:1') {
  // Use cost-effective wan-2.2 model by default
  const res = await fetch(`${VENICE_BASE}/video/queue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'wan-2.2-a14b-text-to-video',
      prompt,
      frames: duration * 8,
      width: aspectRatio === '9:16' ? 480 : 512,
      height: aspectRatio === '9:16' ? 854 : 512,
      aspect_ratio: aspectRatio
    })
  });

  if (!res.ok) {
    const textErr = await res.text().catch(() => '');
    throw new Error(`Venice video queue failed: ${res.status} ${textErr}`);
  }

  const data = await res.json();
  return data.queue_id;
}

async function veniceVideoRetrieve(queueId, maxAttempts = 60) {
  // Poll until video is ready
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${VENICE_BASE}/video/retrieve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ queue_id: queueId })
    });

    if (!res.ok) {
      const textErr = await res.text().catch(() => '');
      throw new Error(`Venice video retrieve failed: ${res.status} ${textErr}`);
    }

    const data = await res.json();
    
    // Check if video is ready
    if (data.status === 'complete' && data.video) {
      return data.video; // Returns MP4 binary or base64
    }
    
    if (data.status === 'failed') {
      throw new Error('Video generation failed');
    }

    // Wait before next poll (exponential backoff)
    await new Promise(r => setTimeout(r, Math.min(2000 + attempt * 500, 10000)));
  }
  
  throw new Error('Video generation timed out');
}

async function veniceVideoComplete(queueId) {
  // Clean up after retrieval
  await fetch(`${VENICE_BASE}/video/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VENICE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ queue_id: queueId })
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);
  }
}

// ─── App Factory ───────────────────────────────────────────────────
function createApp() {
  const app = express();

  app.use(express.json({ limit: '25mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, app: 'moonbark', veniceConfigured: Boolean(VENICE_API_KEY) });
  });

  // Dog sound generator (mood-based TTS)
  app.post('/api/generate-sound', async (req, res) => {
    try {
      if (!VENICE_API_KEY) return res.status(500).json({ error: 'VENICE_API_KEY is not configured.' });
      const { mood, prompt, voice } = req.body || {};
      if (!mood || !prompt) return res.status(400).json({ error: 'mood and prompt are required.' });
      const speechBase64 = await veniceSpeech(prompt, voice || 'am_echo');
      res.json({ ok: true, mood, audioBase64: speechBase64, mimeType: 'audio/mpeg' });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  // 🆕 Human speech → Dog bark translation
  app.post('/api/bark-translate', async (req, res) => {
    try {
      if (!VENICE_API_KEY) return res.status(500).json({ error: 'VENICE_API_KEY is not configured.' });
      const { humanSpeech, dogName, voice } = req.body || {};
      if (!humanSpeech) return res.status(400).json({ error: 'humanSpeech is required.' });

      // Step 1: Get dog phonetics from LLM
      const messages = [
        { role: 'system', content: 'You are a dog vocalisation composer. Return only valid JSON.' },
        { role: 'user', content: buildBarkTranslatePrompt(humanSpeech, dogName) }
      ];
      const raw = await veniceChat(messages);
      const parsed = safeJsonParse(raw);

      // Step 2: Generate TTS of the dog phonetics with a fun voice
      const barkText = parsed.dogPhoneticsText || 'Woof woof! Arf!';
      // Use faster/higher speed for excited bark feel
      const barkSpeed = Math.min(1.3, 0.9 + (parsed.energyLevel || 5) * 0.04);
      const speechBase64 = await veniceSpeech(barkText, voice || 'am_shimmer', barkSpeed);

      res.json({
        ok: true,
        humanSpeech,
        dogPhoneticsText: barkText,
        emotionLabel: parsed.emotionLabel,
        energyLevel: parsed.energyLevel,
        description: parsed.description,
        audioBase64: speechBase64,
        mimeType: 'audio/mpeg'
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  // Main conversation endpoint
  app.post('/api/converse', async (req, res) => {
    try {
      if (!VENICE_API_KEY) return res.status(500).json({ error: 'VENICE_API_KEY is not configured.' });
      const { audioBase64, humanMessage, dogName, transcriptText, voice } = req.body || {};
      if (!audioBase64) return res.status(400).json({ error: 'audioBase64 is required.' });

      const features = computeAudioFeatures(audioBase64);
      const messages = [
        { role: 'system', content: buildDogSystemPrompt() },
        { role: 'user', content: buildDogUserPrompt({ humanMessage, dogName, features, transcriptText }) }
      ];

      const raw = await veniceChat(messages);
      const parsed = safeJsonParse(raw);
      const speechBase64 = await veniceSpeech(parsed.dogReplyText || 'I am here. I hear you.', voice || 'am_echo');

      res.json({
        ok: true,
        features,
        interpretation: parsed,
        replyAudioBase64: speechBase64,
        replyAudioMimeType: 'audio/mpeg'
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  // 🌟 Generate Venice image asset (nano-banana-2)
  app.post('/api/generate-image', async (req, res) => {
    try {
      if (!VENICE_API_KEY) return res.status(500).json({ error: 'VENICE_API_KEY is not configured.' });
      const { prompt, style } = req.body || {};
      if (!prompt) return res.status(400).json({ error: 'prompt is required.' });
      const imageBase64 = await veniceImageGenerate(prompt, style);
      if (!imageBase64) return res.status(500).json({ error: 'No image returned from Venice.' });
      res.json({ ok: true, imageBase64, mimeType: 'image/png', model: 'nano-banana-2' });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  // 🎬 Generate Venice video - Queue only (async)
  app.post('/api/generate-video', async (req, res) => {
    try {
      if (!VENICE_API_KEY) return res.status(500).json({ error: 'VENICE_API_KEY is not configured.' });
      const { prompt, duration = 5, aspectRatio = '1:1' } = req.body || {};
      if (!prompt) return res.status(400).json({ error: 'prompt is required.' });

      const queueId = await veniceVideoQueue(prompt, duration, aspectRatio);
      res.json({ 
        ok: true, 
        queueId, 
        status: 'queued',
        message: 'Video queued. Poll /api/video-status with queueId to check progress.'
      });
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  // 🔍 Check video status
  app.post('/api/video-status', async (req, res) => {
    try {
      if (!VENICE_API_KEY) return res.status(500).json({ error: 'VENICE_API_KEY is not configured.' });
      const { queueId } = req.body || {};
      if (!queueId) return res.status(400).json({ error: 'queueId is required.' });

      const statusRes = await fetch(`${VENICE_BASE}/video/retrieve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VENICE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ queue_id: queueId })
      });

      if (!statusRes.ok) {
        const textErr = await statusRes.text().catch(() => '');
        throw new Error(`Status check failed: ${statusRes.status} ${textErr}`);
      }

      const data = await statusRes.json();
      
      if (data.status === 'complete' && data.video) {
        let videoBase64 = data.video;
        if (Buffer.isBuffer(data.video)) {
          videoBase64 = data.video.toString('base64');
        }
        await veniceVideoComplete(queueId);
        res.json({ ok: true, status: 'complete', videoBase64, mimeType: 'video/mp4' });
      } else if (data.status === 'failed') {
        res.json({ ok: false, status: 'failed', error: 'Video generation failed' });
      } else {
        res.json({ ok: true, status: data.status || 'processing', queueId });
      }
    } catch (error) {
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`🌙 MoonBark running at http://localhost:${PORT}`);
  });
}

export { createApp, computeAudioFeatures, buildDogSystemPrompt, buildDogUserPrompt };
