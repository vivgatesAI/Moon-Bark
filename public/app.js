// ════════════════════════════════════════════════════════════════
//  MoonBark — Mobile-First App
// ════════════════════════════════════════════════════════════════

// Defensive helper
const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ─── Elements ─────────────────────────────────────────────────────
const recordBtn          = $('recordBtn');
const stopBtn            = $('stopBtn');
const statusTextEl       = $('statusText');          // inside #statusBar
const statusBarEl        = $('statusBar');
const dogNameEl          = $('dogName');
const humanMessageEl     = $('humanMessage');
const voiceSelectEl      = $('voiceSelect');
const metricsEl          = $('metrics');
const metricsCard        = $('metricsCard');
const replyTextEl        = $('replyText');
const intentTextEl       = $('intentText');
const adviceTextEl       = $('adviceText');
const replyAudio         = $('replyAudio');
const replyEmptyState    = $('replyEmptyState');
const replyContent       = $('replyContent');
const canvas             = $('waveform');
const ctx                = canvas ? canvas.getContext('2d') : null;
const waveformPlaceholder= $('waveformPlaceholder');
const stars              = $('stars');

// Settings
const settingsBtn        = $('settingsBtn');
const settingsPanel      = $('settingsPanel');
const settingsOverlay    = $('settingsOverlay');
const closeSettings      = $('closeSettings');
const apiStatus          = $('apiStatus');

// Hero
const heroImage          = $('heroImage');

// Bottom nav / tabs
const navBtns            = $$('.nav-item');
const tabPanels          = $$('.tab');

// Bark translator
const barkInput          = $('barkInput');
const barkTranslateBtn   = $('barkTranslateBtn');
const barkProgress       = $('barkProgress');
const barkResultCard     = $('barkResultCard');
const barkPhoneticsText  = $('barkPhoneticsText');
const barkDescription    = $('barkDescription');
const barkEmotionBadge   = $('barkEmotionBadge');
const barkEnergyBadge    = $('barkEnergyBadge');
const barkAudio          = $('barkAudio');

// Sound generator (mood cards)
const moodCards          = $$('.mood-card');
const soundPlayer        = $('soundPlayer');
const soundVisualizer    = $('soundVisualizer');
const generatedSound     = $('generatedSound');

// Studio (image / video)
const studioTabs         = $$('.studio-tab');
const studioPanels       = $$('.studio-panel');
const imagePrompt        = $('imagePrompt');
const generateImageBtn   = $('generateImageBtn');
const imageProgress      = $('imageProgress');
const generatedImageContainer = $('generatedImageContainer');
const generatedImage     = $('generatedImage');
const downloadImageBtn   = $('downloadImageBtn');
const videoPrompt        = $('videoPrompt');
const videoDuration      = $('videoDuration');
const videoAspect        = $('videoAspect');
const generateVideoBtn   = $('generateVideoBtn');
const videoProgress      = $('videoProgress');
const videoProgressText  = $('videoProgressText');
const generatedVideoContainer = $('generatedVideoContainer');
const generatedVideo     = $('generatedVideo');
const downloadVideoBtn   = $('downloadVideoBtn');

// Toast
const toastContainer     = $('toastContainer');

// State
let mediaRecorder;
let chunks = [];
let audioContext;
let analyser;
let dataArray;
let animationFrame;
let stream;
let lastImageUrl = null;
let lastVideoUrl = null;

// ═════════════════════════════════════════════════════════════════
//  Init — run each step safely so one failure doesn't kill the rest
// ═════════════════════════════════════════════════════════════════
function safe(label, fn) {
  try { fn(); } catch (err) { console.error(`[init:${label}]`, err); }
}

function init() {
  safe('stars',           initStars);
  safe('nav',             initNav);
  safe('settings',        initSettings);
  safe('recording',       initRecording);
  safe('barkTranslator',  initBarkTranslator);
  safe('soundGenerator',  initSoundGenerator);
  safe('studio',          initStudio);
  safe('canvas',          initCanvas);
  safe('apiStatus',       checkApiStatus);
}

// ═════════════════════════════════════════════════════════════════
//  Ambient stars
// ═════════════════════════════════════════════════════════════════
function initStars() {
  if (!stars) return;
  stars.innerHTML = '';
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = `${Math.random() * 100}%`;
    s.style.top = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 6}s`;
    s.style.animationDuration = `${3 + Math.random() * 6}s`;
    stars.appendChild(s);
  }
}

// ═════════════════════════════════════════════════════════════════
//  Bottom Nav / Tabs
// ═════════════════════════════════════════════════════════════════
function initNav() {
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.nav));
  });
}

function switchTab(target) {
  navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.nav === target));
  tabPanels.forEach(p => {
    const active = p.dataset.tab === target;
    p.hidden = !active;
    p.classList.toggle('active', active);
  });
}

// ═════════════════════════════════════════════════════════════════
//  Settings Panel
// ═════════════════════════════════════════════════════════════════
function initSettings() {
  if (!settingsBtn || !settingsPanel) return;
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('open');
  });
  if (closeSettings)    closeSettings.addEventListener('click', () => settingsPanel.classList.remove('open'));
  if (settingsOverlay)  settingsOverlay.addEventListener('click', () => settingsPanel.classList.remove('open'));
}

async function checkApiStatus() {
  if (!apiStatus) return;
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    const dot  = apiStatus.querySelector('.status-dot');
    const text = apiStatus.querySelector('.status-text');
    if (data.veniceConfigured) {
      if (dot)  { dot.classList.remove('checking'); dot.classList.add('online'); }
      if (text) text.textContent = 'Connected';
    } else {
      if (dot)  { dot.classList.remove('checking'); dot.classList.add('offline'); }
      if (text) text.textContent = 'API key missing';
    }
  } catch {
    const dot  = apiStatus.querySelector('.status-dot');
    const text = apiStatus.querySelector('.status-text');
    if (dot)  { dot.classList.remove('checking'); dot.classList.add('offline'); }
    if (text) text.textContent = 'Offline';
  }
}

// ═════════════════════════════════════════════════════════════════
//  Recording & Visualization
// ═════════════════════════════════════════════════════════════════
function initRecording() {
  if (!recordBtn || !stopBtn) {
    console.warn('[moonbark] record/stop button missing');
    return;
  }
  recordBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
}

function setStatus(text, loading = false) {
  if (!statusTextEl) return;
  statusTextEl.textContent = text;
  if (statusBarEl) statusBarEl.classList.toggle('loading', !!loading);
}

function toast(msg, kind = 'info') {
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
}

async function startRecording() {
  try {
    chunks = [];
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Microphone not supported in this browser');
      toast('Microphone not supported', 'error');
      return;
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
    mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    mediaRecorder.start();

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    dataArray = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    if (waveformPlaceholder) waveformPlaceholder.hidden = true;
    drawWaveform();

    setStatus('Listening…', true);
    recordBtn.hidden = true;
    stopBtn.hidden = false;
  } catch (err) {
    console.error(err);
    setStatus('Microphone permission denied');
    toast('Microphone permission denied', 'error');
  }
}

async function stopRecording() {
  if (!mediaRecorder) return;
  try { mediaRecorder.stop(); } catch {}
  setStatus('Interpreting with Venice AI…', true);
  stopBtn.hidden = true;

  mediaRecorder.onstop = async () => {
    cancelAnimationFrame(animationFrame);
    if (stream) stream.getTracks().forEach(t => t.stop());

    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    const audioBase64 = await blobToBase64(blob);

    try {
      const res = await fetch('/api/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          dogName: dogNameEl?.value || '',
          humanMessage: humanMessageEl?.value || '',
          transcriptText: 'Recorded live dog vocalization from browser microphone.',
          voice: voiceSelectEl?.value || 'am_shimmer'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || 'Something went wrong.');
        toast(data.error || 'Request failed', 'error');
        recordBtn.hidden = false;
        return;
      }

      renderMetrics(data.features);
      renderReply(data.interpretation, data.replyAudioBase64, data.replyAudioMimeType);
      setStatus('Done! Check the Reply tab 🐕');
      toast('Reply ready', 'success');
      setTimeout(() => switchTab('reply'), 500);
    } catch (err) {
      console.error(err);
      setStatus('Connection error. Please try again.');
      toast('Connection error', 'error');
    }

    recordBtn.hidden = false;
    if (waveformPlaceholder) waveformPlaceholder.hidden = false;
    if (ctx) initCanvas();
  };
}

function drawWaveform() {
  if (!analyser || !ctx) return;
  analyser.getByteTimeDomainData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0,   '#00d4ff');
  gradient.addColorStop(0.5, '#ff6b9d');
  gradient.addColorStop(1,   '#9d4edd');
  ctx.strokeStyle = gradient;
  ctx.lineWidth   = 2;
  ctx.beginPath();

  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;
    if (i === 0) ctx.moveTo(x, y);
    else         ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
  ctx.shadowBlur  = 15;
  ctx.shadowColor = '#00d4ff';
  ctx.stroke();
  ctx.shadowBlur  = 0;
  animationFrame = requestAnimationFrame(drawWaveform);
}

function renderMetrics(features) {
  if (!metricsCard || !metricsEl || !features) return;
  metricsCard.hidden = false;
  metricsEl.innerHTML = `
    <div class="metrics-grid">
      <div class="metric"><span>Excitement</span><strong>${features.excitement ?? '—'}%</strong></div>
      <div class="metric"><span>Urgency</span><strong>${features.urgency ?? '—'}%</strong></div>
      <div class="metric"><span>Bursts</span><strong>${features.barkBursts ?? '—'}</strong></div>
      <div class="metric"><span>Mood</span><strong>${features.moodHint ?? '—'}</strong></div>
    </div>`;
}

function renderReply(interp, audioBase64, mimeType) {
  if (!interp) return;
  if (replyEmptyState) replyEmptyState.hidden = true;
  if (replyContent)    replyContent.hidden   = false;
  if (replyTextEl)     replyTextEl.textContent   = interp.dogReplyText || '…';
  if (intentTextEl)    intentTextEl.textContent  = `${interp.intentSummary || ''}${interp.emotionalTone ? ' · ' + interp.emotionalTone : ''}`.trim() || '—';
  if (adviceTextEl)    adviceTextEl.textContent  = interp.humanAdvice || '—';
  if (replyAudio && audioBase64) {
    replyAudio.src = `data:${mimeType || 'audio/mpeg'};base64,${audioBase64}`;
    replyAudio.play().catch(() => {});
  }
}

// ═════════════════════════════════════════════════════════════════
//  Bark Translator (Human → Dog)
// ═════════════════════════════════════════════════════════════════
function initBarkTranslator() {
  if (!barkTranslateBtn) return;
  barkTranslateBtn.addEventListener('click', translateToBark);
}

async function translateToBark() {
  const text = (barkInput?.value || '').trim();
  if (!text) { toast('Enter something to say!', 'info'); return; }

  if (barkProgress) barkProgress.hidden = false;
  barkTranslateBtn.disabled = true;

  try {
    const res = await fetch('/api/bark-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        humanSpeech: text,
        dogName: dogNameEl?.value || '',
        voice: voiceSelectEl?.value || 'am_shimmer'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Translation failed');

    if (barkResultCard)    barkResultCard.hidden = false;
    if (barkPhoneticsText) barkPhoneticsText.textContent = data.dogPhoneticsText || '';
    if (barkDescription)   barkDescription.textContent   = data.description || '';
    if (barkEmotionBadge)  barkEmotionBadge.textContent  = data.emotionLabel || 'Happy';
    if (barkEnergyBadge)   barkEnergyBadge.textContent   = `Energy: ${data.energyLevel ?? 5}/10`;
    if (barkAudio && data.audioBase64) {
      barkAudio.src = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`;
      barkAudio.play().catch(() => {});
    }
    toast('Translated!', 'success');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Translation failed', 'error');
  } finally {
    if (barkProgress) barkProgress.hidden = true;
    barkTranslateBtn.disabled = false;
  }
}

// ═════════════════════════════════════════════════════════════════
//  Sound Generator (Mood cards)
// ═════════════════════════════════════════════════════════════════
const moodPrompts = {
  happy:    'A happy, joyful dog bark — short, bright, enthusiastic: woof woof! Happy, tail-wagging energy.',
  playful:  "A playful, bouncy dog woof — energetic, inviting: arf arf! Let's play! Bouncy and friendly.",
  calm:     'A calm, contented dog rumble — low, peaceful, relaxed: mmm… sigh… zen breathing.',
  excited:  "An excited dog yelp — quick, high-pitched joy: yip! yip! Oh boy! Can't wait!",
  curious:  'A curious dog sniff-whine — questioning, intrigued: whine… sniff… hmmm?',
  howl:     'A beautiful moonlight howl — long, soulful, expressive: aroooo… oooo… haunting and lovely.'
};

function initSoundGenerator() {
  moodCards.forEach(btn => btn.addEventListener('click', () => generateSound(btn)));
}

function showSoundViz() {
  if (!soundVisualizer) return;
  soundVisualizer.innerHTML = '';
  for (let i = 0; i < 24; i++) {
    const bar = document.createElement('div');
    bar.className = 'viz-bar';
    bar.style.animationDelay    = `${i * 0.04}s`;
    bar.style.animationDuration = `${0.6 + Math.random() * 0.6}s`;
    soundVisualizer.appendChild(bar);
  }
}

async function generateSound(btn) {
  const mood  = btn.dataset.mood;
  const emoji = btn.dataset.emoji || '🐾';
  moodCards.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (soundPlayer) soundPlayer.hidden = false;
  showSoundViz();
  toast(`Generating ${mood} sound…`, 'info');

  try {
    const res = await fetch('/api/generate-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mood,
        prompt: moodPrompts[mood] || `A ${mood} dog sound`,
        voice: voiceSelectEl?.value || 'am_shimmer'
      })
    });
    if (!res.ok) throw new Error('Sound generation failed');
    const data = await res.json();
    if (generatedSound && data.audioBase64) {
      generatedSound.src = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`;
      generatedSound.play().catch(() => {});
    }
    toast(`${emoji} ${mood} ready`, 'success');
  } catch (err) {
    console.error(err);
    toast('Failed to generate sound', 'error');
  }
}

// ═════════════════════════════════════════════════════════════════
//  AI Studio (Image / Video)
// ═════════════════════════════════════════════════════════════════
function initStudio() {
  studioTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.studioTab;
      studioTabs.forEach(t => t.classList.toggle('active', t === tab));
      studioPanels.forEach(p => p.classList.toggle('active', p.id === `studio-${target}`));
    });
  });

  if (generateImageBtn) generateImageBtn.addEventListener('click', generateImage);
  if (generateVideoBtn) generateVideoBtn.addEventListener('click', generateVideo);
  if (downloadImageBtn) downloadImageBtn.addEventListener('click', () => downloadMedia(lastImageUrl, 'moonbark-image.png'));
  if (downloadVideoBtn) downloadVideoBtn.addEventListener('click', () => downloadMedia(lastVideoUrl, 'moonbark-video.mp4'));
}

async function generateImage() {
  const prompt = (imagePrompt?.value || '').trim();
  if (!prompt) { toast('Enter an image prompt', 'info'); return; }
  if (imageProgress) imageProgress.hidden = false;
  generateImageBtn.disabled = true;
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style: 'photographic' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Image generation failed');
    if (data.imageBase64 && generatedImage && generatedImageContainer) {
      lastImageUrl = `data:image/png;base64,${data.imageBase64}`;
      generatedImage.src = lastImageUrl;
      generatedImageContainer.hidden = false;
    }
    toast('Image ready', 'success');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Image failed', 'error');
  } finally {
    if (imageProgress) imageProgress.hidden = true;
    generateImageBtn.disabled = false;
  }
}

async function generateVideo() {
  const prompt = (videoPrompt?.value || '').trim();
  if (!prompt) { toast('Enter a video prompt', 'info'); return; }
  if (videoProgress) videoProgress.hidden = false;
  if (videoProgressText) videoProgressText.textContent = 'Queueing…';
  generateVideoBtn.disabled = true;

  try {
    const res = await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        duration: Number(videoDuration?.value || 5),
        aspect:   videoAspect?.value || '9:16'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Video request failed');

    const queueId = data.queueId;
    if (!queueId) throw new Error('No queueId returned');
    if (videoProgressText) videoProgressText.textContent = 'Rendering…';

    // Poll status
    const pollRes = await pollVideo(queueId);
    if (pollRes?.videoUrl || pollRes?.videoBase64) {
      if (generatedVideoContainer && generatedVideo) {
        lastVideoUrl = pollRes.videoUrl || `data:${pollRes.mimeType || 'video/mp4'};base64,${pollRes.videoBase64}`;
        generatedVideo.src = lastVideoUrl;
        generatedVideoContainer.hidden = false;
        generatedVideo.play().catch(() => {});
      }
      toast('Video ready', 'success');
    } else {
      toast(pollRes?.message || 'Video still processing', 'info');
    }
  } catch (err) {
    console.error(err);
    toast(err.message || 'Video failed', 'error');
  } finally {
    if (videoProgress) videoProgress.hidden = true;
    generateVideoBtn.disabled = false;
  }
}

async function pollVideo(queueId, tries = 30, delayMs = 4000) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch('/api/video-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId })
    });
    const data = await res.json();
    if (data.status === 'completed' || data.videoUrl || data.videoBase64) return data;
    if (data.status === 'failed') throw new Error(data.error || 'Video failed');
    if (videoProgressText) videoProgressText.textContent = `Rendering… (${i + 1}/${tries})`;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return { message: 'Still rendering — check back soon' };
}

function downloadMedia(url, filename) {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ═════════════════════════════════════════════════════════════════
//  Canvas placeholder text
// ═════════════════════════════════════════════════════════════════
function initCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font      = '14px Inter';
  ctx.textAlign = 'center';
  ctx.fillText("Tap Record to visualize your dog's voice", canvas.width / 2, canvas.height / 2);
}

// ═════════════════════════════════════════════════════════════════
//  Utils
// ═════════════════════════════════════════════════════════════════
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;            // data:audio/webm;base64,xxxx
      const b64 = typeof result === 'string' ? result.split(',')[1] : '';
      resolve(b64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Start ───────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
