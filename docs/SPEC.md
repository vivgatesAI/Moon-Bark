# MoonBark Spec

## Product idea
A very beautiful app that lets a human record dog vocalizations, infer emotional intent, and carry on a poetic but grounded conversation between human and dog.

## Core experience
1. Record the dog's voice.
2. Analyze bark rhythm, energy, and pacing.
3. Use Venice chat to translate the dog's likely intent.
4. Let the human send a message.
5. Generate the dog's reply and optional dog-voice audio with Venice TTS.

## UX principles
- cinematic, calm, premium, emotionally warm
- clear two-species dialogue layout
- immediate delight from waveform + animated response cards
- simple enough to demo live

## Technical choices
- Node + Express server
- static frontend with custom CSS/JS
- Web Audio-based WAV recording in browser
- Venice `/chat/completions` for reasoning
- Venice `/audio/speech` for dog reply playback

## Constraints
- no external DB required
- local runnable MVP
- keep secrets server-side
- tests for core prompt-building / bark profiling logic
