import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAudioFeatures, buildDogSystemPrompt, buildDogUserPrompt } from '../server.mjs';

function makeFakeWav() {
  const buffer = Buffer.alloc(4000);
  buffer.write('RIFF', 0);
  buffer.write('WAVE', 8);
  for (let i = 44; i < buffer.length; i += 2) {
    buffer.writeInt16LE((i % 400 < 200 ? 12000 : 2000), i);
  }
  return buffer.toString('base64');
}

test('computeAudioFeatures extracts bark-ish metrics', () => {
  const features = computeAudioFeatures(makeFakeWav());
  assert.ok(features.barkBursts > 0);
  assert.ok(features.excitement > 0);
  assert.ok(features.urgency > 0);
});

test('prompt builders include important context', () => {
  const prompt = buildDogSystemPrompt();
  const user = buildDogUserPrompt({
    humanMessage: 'Are you hungry?',
    dogName: 'Mochi',
    transcriptText: 'short barks',
    features: { excitement: 70, urgency: 50, barkBursts: 8 }
  });

  assert.match(prompt, /strict JSON/i);
  assert.match(user, /Mochi/);
  assert.match(user, /Are you hungry\?/);
  assert.match(user, /barkBursts/);
});
