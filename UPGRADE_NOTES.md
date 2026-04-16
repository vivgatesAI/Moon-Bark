# MoonBark v2.0 — Mobile-First Upgrade

## ✨ What's New

### 1. Mobile-First UI
- **Bottom tab navigation** — 4 tabs: Listen, Speak Dog, Sounds, Reply
- **Top settings drawer** — swipe/click to access settings
- **Touch-optimized** — 48px minimum touch targets
- **Safe area support** — works with iPhone notches
- **Responsive design** — looks great on all screen sizes

### 2. "Speak Dog" Feature 🐕
New tab that translates your human speech into dog barks!
- Type what you want to say
- AI converts it to phonetic dog sounds (woof, arf, yip, etc.)
- Generates audio via Venice TTS
- Shows emotion label and energy level

### 3. Venice Image Generation
- Settings drawer includes "Generate AI Logo" button
- Uses Venice `/image/generate` API with `fluently-xl` model
- Generates a custom logo for the app

### 4. Updated Sound Generator
- Added "Howl" mood option
- Grid layout for easier mobile tapping
- Visual feedback with animated waveform

## 📱 UI Changes

### Navigation
```
┌─────────────────────────┐
│  🌙 MoonBark        ⚙️  │  ← Top bar with settings
├─────────────────────────┤
│                         │
│     [Tab Content]       │  ← Main content area
│                         │
├─────────────────────────┤
│ 🎙️  🐕  🎵  💬         │  ← Bottom tab bar
│Listen Speak Sounds Reply│
└─────────────────────────┘
```

### Tabs
1. **Listen** — Record your dog, get AI interpretation
2. **Speak Dog** — Translate human speech to dog barks
3. **Sounds** — Generate mood-based dog sounds
4. **Reply** — View your dog's translated reply

## 🔧 Technical Changes

### New API Endpoints
```
POST /api/bark-translate    → Human text → Dog phonetics + TTS audio
POST /api/generate-image   → Venice image generation
```

### Updated Files
- `server.mjs` — Added bark translation + image generation
- `public/index.html` — Completely rewritten with tab navigation
- `public/styles.css` — Mobile-first CSS with bottom nav
- `public/app.js` — Modular architecture with tab switching

## 🚀 Setup

1. Add your Venice API key to `.env`:
   ```
   VENICE_API_KEY=your_key_here
   ```

2. Install dependencies (if needed):
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open `http://localhost:4328`

## 🎨 Venice Asset Generation

The app can now generate images via Venice! Use the "Generate AI Logo" button in settings, or call the API directly:

```bash
curl -X POST http://localhost:4328/api/generate-image \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A golden retriever under a cosmic moon", "style": "photorealistic"}'
```

## 📝 Notes

- The bark translator uses Venice chat + TTS to create dog-like sounds
- Speech speed varies based on the "energy level" of the bark
- Works best with short phrases (under 50 words)
- All audio is generated in real-time via Venice AI
