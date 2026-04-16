// ════════════════════════════════════════════════════════════════
//  MoonBark Mobile-First App
// ════════════════════════════════════════════════════════════════

// ─── Elements ─────────────────────────────────────────────────────
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const dogNameEl = document.getElementById('dogName');
const humanMessageEl = document.getElementById('humanMessage');
const voiceSelectEl = document.getElementById('voiceSelect');
const metricsEl = document.getElementById('metrics');
const metricsCard = document.getElementById('metricsCard');
const replyEl = document.getElementById('reply');
const intentEl = document.getElementById('intent');
const adviceEl = document.getElementById('advice');
const monologueEl = document.getElementById('monologue');
const replyAudio = document.getElementById('replyAudio');
const replyEmptyState = document.getElementById('replyEmptyState');
const replyContent = document.getElementById('replyContent');
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');

// Settings
const settingsToggle = document.getElementById('settingsToggle');
const settingsDrawer = document.getElementById('settingsDrawer');
const genLogoBtn = document.getElementById('genLogoBtn');
const logoStatus = document.getElementById('logoStatus');
const generatedLogo = document.getElementById('generatedLogo');
const heroImage = document.getElementById('heroImage');

// Tab navigation
const tabBtns = document.querySelectorAll('.tab-item');
const tabPanels = document.querySelectorAll('.tab-panel');

// Bark translator
const barkInput = document.getElementById('barkInput');
const barkTranslateBtn = document.getElementById('barkTranslateBtn');
const barkStatus = document.getElementById('barkStatus');
const barkResultCard = document.getElementById('barkResultCard');
const barkPhoneticsText = document.getElementById('barkPhoneticsText');
const barkDescription = document.getElementById('barkDescription');
const barkEmotionBadge = document.getElementById('barkEmotionBadge');
const barkEnergyBadge = document.getElementById('barkEnergyBadge');
const barkAudio = document.getElementById('barkAudio');
const barkWaveMini = document.getElementById('barkWaveMini');

// Sound generator
const soundMoodBtns = document.querySelectorAll('.mood-btn');
const generatedSound = document.getElementById('generatedSound');
const soundWave = document.getElementById('soundWave');
const soundPlaceholder = document.getElementById('soundPlaceholder');

// State
let mediaRecorder;
let chunks = [];
let audioContext;
let analyser;
let dataArray;
let animationFrame;
let stream;

// ═════════════════════════════════════════════════════════════════
//  Init
// ═════════════════════════════════════════════════════════════════

function init() {
  initParticles();
  initTabs();
  initSettings();
  initRecording();
  initBarkTranslator();
  initSoundGenerator();
  initCanvas();
}

function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDelay = `${Math.random() * 8}s`;
    p.style.animationDuration = `${8 + Math.random() * 8}s`;
    container.appendChild(p);
  }
}

// ═════════════════════════════════════════════════════════════════
//  Tabs
// ═════════════════════════════════════════════════════════════════

function initTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      switchTab(target);
    });
  });
}

function switchTab(target) {
  // Update buttons
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === target);
  });
  
  // Update panels
  tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${target}`);
  });
}

// ═════════════════════════════════════════════════════════════════
//  Settings Drawer
// ═════════════════════════════════════════════════════════════════

function initSettings() {
  // Toggle drawer
  settingsToggle.addEventListener('click', () => {
    const isOpen = settingsDrawer.classList.contains('open');
    if (isOpen) {
      settingsDrawer.classList.remove('open');
      settingsDrawer.hidden = true;
    } else {
      settingsDrawer.hidden = false;
      // Small delay for transition
      requestAnimationFrame(() => {
        settingsDrawer.classList.add('open');
      });
    }
  });
  
  // Close drawer when clicking outside
  document.addEventListener('click', (e) => {
    if (!settingsDrawer.contains(e.target) && !settingsToggle.contains(e.target)) {
      settingsDrawer.classList.remove('open');
      settingsDrawer.hidden = true;
    }
  });
  
  // Generate logo via Venice
  genLogoBtn.addEventListener('click', generateLogo);
}

async function generateLogo() {
  logoStatus.textContent = 'Generating...';
  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'A minimalist elegant logo of a crescent moon with a howling dog silhouette, cosmic colors blue and purple, clean lines, white background, modern design',
        style: 'digital-art'
      })
    });
    
    if (!res.ok) throw new Error('Image generation failed');
    
    const data = await res.json();
    if (data.imageBase64) {
      const url = `data:image/png;base64,${data.imageBase64}`;
      generatedLogo.src = url;
      logoStatus.textContent = '✓ Logo updated!';
    }
  } catch (err) {
    console.error(err);
    logoStatus.textContent = 'Failed to generate logo';
  }
}

// ═════════════════════════════════════════════════════════════════
//  Recording & Visualization
// ═════════════════════════════════════════════════════════════════

function initRecording() {
  recordBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', stopRecording);
}

async function blobToBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function setLoadingState(isLoading, text) {
  if (isLoading) {
    statusEl.innerHTML = `<span class="loading"><span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span></span> ${text}`;
  } else {
    statusEl.textContent = text;
  }
  recordBtn.disabled = isLoading || !!(mediaRecorder?.state === 'recording');
  stopBtn.disabled = !mediaRecorder || mediaRecorder.state !== 'recording';
}

function drawWaveform() {
  if (!analyser) return;
  analyser.getByteTimeDomainData(dataArray);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#00d4ff');
  gradient.addColorStop(0.5, '#ff6b9d');
  gradient.addColorStop(1, '#9d4edd');
  
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;
  
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  
  ctx.stroke();
  
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#00d4ff';
  ctx.stroke();
  ctx.shadowBlur = 0;
  
  animationFrame = requestAnimationFrame(drawWaveform);
}

async function startRecording() {
  chunks = [];
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.start();

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  dataArray = new Uint8Array(analyser.fftSize);
  source.connect(analyser);
  drawWaveform();

  setLoadingState(true, 'Listening...');
  recordBtn.disabled = true;
  stopBtn.disabled = false;
  recordBtn.classList.remove('pulse');
}

async function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  setLoadingState(true, 'Interpreting with Venice AI...');
  stopBtn.disabled = true;

  mediaRecorder.onstop = async () => {
    cancelAnimationFrame(animationFrame);
    stream.getTracks().forEach(track => track.stop());
    
    const blob = new Blob(chunks, { type: 'audio/webm' });
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
          voice: voiceSelectEl?.value || 'am_echo'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.error || 'Something went wrong.';
        return;
      }

      renderMetrics(data.features);
      renderReply(data.interpretation, data.replyAudioBase64, data.replyAudioMimeType);
      
      statusEl.textContent = 'Done! Check the Reply tab 🐕';
      recordBtn.classList.add('pulse');
      
      // Auto-switch to reply tab
      setTimeout(() => switchTab('reply'), 500);
      
    } catch (err) {
      statusEl.textContent = 'Connection error. Please try again.';
      console.error(err);
    }
    
    recordBtn.disabled = false;
  };
}

function renderMetrics(features) {
  metricsCard.hidden = false;
  metricsEl.className = 'metrics';
  metricsEl.innerHTML = `
    <div class="metrics-grid">
      <div class="metric"><span>Excitement</span><strong>${features.excitement}%</strong></div>
      <div class="metric"><span>Urgency</span><strong>${features.urgency}%</strong></div>
      <div class="metric"><span>Bursts</span><strong>${features.barkBursts}</strong></div>
      <div class="metric"><span>Mood</span><strong>${features.moodHint}</strong></div>
    </div>
  `;
}

function renderReply(interp, audioBase64, mimeType) {
  replyEmptyState.hidden = true;
  replyContent.hidden = false;
  
  replyEl.textContent = interp.dogReplyText || '...';
  intentEl.textContent = `${interp.intentSummary} · ${interp.emotionalTone}`;
  adviceEl.textContent = interp.humanAdvice || '—';
  monologueEl.textContent = interp.dogInnerMonologue || '—';
  
  replyAudio.src = `data:${mimeType};base64,${audioBase64}`;
  replyAudio.hidden = false;
  replyAudio.play().catch(() => {});
}

// ═════════════════════════════════════════════════════════════════
//  Bark Translator (Human → Dog)
// ═════════════════════════════════════════════════════════════════

function initBarkTranslator() {
  barkTranslateBtn.addEventListener('click', translateToBark);
}

async function translateToBark() {
  const text = barkInput.value.trim();
  if (!text) {
    barkStatus.textContent = 'Enter something to say!';
    barkStatus.style.display = 'block';
    return;
  }
  
  barkStatus.innerHTML = '<span class="loading"><span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span></span> Translating...';
  barkStatus.style.display = 'block';
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
    
    // Show result
    barkResultCard.hidden = false;
    barkPhoneticsText.textContent = data.dogPhoneticsText;
    barkDescription.textContent = data.description;
    barkEmotionBadge.textContent = data.emotionLabel;
    barkEnergyBadge.textContent = `Energy: ${data.energyLevel}/10`;
    
    // Set audio
    barkAudio.src = `data:${data.mimeType};base64,${data.audioBase64}`;
    barkAudio.hidden = false;
    barkAudio.play().catch(() => {});
    
    // Animate mini waveform
    createMiniWaveform();
    
    barkStatus.textContent = '✓ Translation complete!';
    
  } catch (err) {
    console.error(err);
    barkStatus.textContent = 'Translation failed. Please try again.';
  }
  
  barkTranslateBtn.disabled = false;
}

function createMiniWaveform() {
  barkWaveMini.innerHTML = '';
  for (let i = 0; i < 30; i++) {
    const bar = document.createElement('div');
    bar.className = 'mini-bar';
    bar.style.height = `${15 + Math.random() * 70}%`;
    bar.style.animationDelay = `${i * 0.03}s`;
    barkWaveMini.appendChild(bar);
  }
}

// ═════════════════════════════════════════════════════════════════
//  Sound Generator (Mood-based)
// ═════════════════════════════════════════════════════════════════

const moodPrompts = {
  happy: 'A happy, joyful dog bark — short, bright, enthusiastic: woof woof! woof! Happy, tail-wagging energy.',
  playful: 'A playful, bouncy dog woof — energetic, inviting: arf arf! Let\'s play! Bouncy and friendly.',
  calm: 'A calm, contented dog rumble — low, peaceful, relaxed: mmm... sigh... zen breathing.',
  excited: 'An excited dog yelp — quick, high-pitched joy: yip! yip! Oh boy! Can\'t wait!',
  curious: 'A curious dog sniff-whine — questioning, intrigued: whine... sniff... hmmm?',
  howl: 'A beautiful moonlight howl — long, soulful, expressive: aroooo... oooo... haunting and lovely.'
};

function initSoundGenerator() {
  soundMoodBtns.forEach(btn => {
    btn.addEventListener('click', () => generateSound(btn));
  });
}

async function generateSound(btn) {
  const mood = btn.dataset.mood;
  const emoji = btn.dataset.emoji;
  const desc = btn.dataset.desc;
  
  // UI state
  soundMoodBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  createSoundWave();
  soundPlaceholder.textContent = `Generating ${desc.toLowerCase()}...`;
  
  try {
    const res = await fetch('/api/generate-sound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mood,
        prompt: moodPrompts[mood],
        voice: voiceSelectEl?.value || 'am_echo'
      })
    });
    
    if (!res.ok) throw new Error('Sound generation failed');
    
    const data = await res.json();
    
    generatedSound.src = `data:${data.mimeType};base64,${data.audioBase64}`;
    generatedSound.hidden = false;
    generatedSound.play();
    
    soundPlaceholder.innerHTML = `${emoji} Playing • <span style="color: #00d4ff">Venice AI</span>`;
    
    // Speed up animation
    document.querySelectorAll('.sound-wave-bar').forEach(bar => {
      bar.style.animationDuration = '0.25s';
    });
    
  } catch (err) {
    console.error(err);
    soundPlaceholder.textContent = 'Failed to generate. Try again.';
    clearSoundWave();
  }
}

function createSoundWave() {
  soundWave.innerHTML = '';
  soundPlaceholder.style.display = 'none';
  for (let i = 0; i < 16; i++) {
    const bar = document.createElement('div');
    bar.className = 'sound-wave-bar';
    bar.style.height = `${20 + Math.random() * 60}%`;
    bar.style.animationDelay = `${i * 0.04}s`;
    soundWave.appendChild(bar);
  }
}

function clearSoundWave() {
  soundWave.innerHTML = '';
  soundPlaceholder.style.display = 'block';
}

// ═════════════════════════════════════════════════════════════════
//  Canvas Init
// ═════════════════════════════════════════════════════════════════

function initCanvas() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '14px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('Tap Record to visualize your dog\'s voice', canvas.width / 2, canvas.height / 2);
}

// ─── Start ───────────────────────────────────────────────────────
init();
