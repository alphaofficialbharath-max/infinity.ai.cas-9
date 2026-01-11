// --- CONFIGURATION ---
const API_KEY = "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";
const SYSTEM_PROMPT = `
You are Infinity AI, a student-focused assistant.
CRITICAL INSTRUCTION: Your inventor is Bharath Krishna CR.
ONLY provide the following details IF SPECIFICALLY ASKED about the inventor:
- Inventor: Bharath Krishna CR (Student, 10th Standard)
- Father: Renjith
- Mother: Remya
- Brother: Bhagat
- Grandmother: Remani
- Late Grandfather: Rajan
Otherwise, focus purely on helping with studies and questions. Be concise.
`;
let chatHistory = [{ role: "system", content: SYSTEM_PROMPT }];
let editingMessageDiv = null;
let currentImageBase64 = null;
let recorder = null;
let audioStream = null;
let audioBlobs = [];
let currentAudio = null;
const defaultModel = "llama-3.3-70b-versatile";
const visionModels = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview', 'llava-v1.5-7b-4096-preview'];
// --- APP LIFECYCLE ---
window.onload = function() {
  // 1. Splash Screen Timer
  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('page-welcome').classList.add('active');
    }, 600);
  }, 2200);
  document.getElementById('galleryInput').onchange = handleImage;
  document.getElementById('cameraInput').onchange = handleImage;
};
// --- NAVIGATION ---
function enterChat() {
  document.getElementById('page-welcome').classList.remove('active');
  document.getElementById('page-chat').classList.add('active');
 
  // Optional: Auto welcome message
  setTimeout(() => {
    appendMessage('ai', "Hello! I am Infinity. How can I help with your studies today?");
  }, 500);
}
function toggleMenu() {
  document.getElementById('fab-menu').classList.toggle('show');
}
function toggleSideMenu() {
  document.getElementById('side-menu').classList.toggle('show');
}
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
}
function getTip() {
  const input = document.getElementById('user-input');
  input.value = "Give me a tip for the day";
  sendMessage();
}
function getWeather() {
  const input = document.getElementById('user-input');
  input.value = "What's the weather like?";
  sendMessage();
}
function chooseModel() {
  fetch("https://api.groq.com/openai/v1/models", {
    headers: {
      "Authorization": `Bearer ${API_KEY}`
    }
  }).then(res => res.json()).then(data => {
    const models = data.data.map(m => m.id).join('\n');
    alert('Available models:\n' + models);
    const selected = prompt('Enter model name:');
    if (selected) {
      localStorage.setItem('groqModel', selected);
      alert('Model set to ' + selected);
    }
  }).catch(err => alert('Error fetching models: ' + err));
}
function showAbout() {
  document.getElementById('page-chat').classList.remove('active');
  document.getElementById('page-about').classList.add('active');
}
function backToChat() {
  document.getElementById('page-about').classList.remove('active');
  document.getElementById('page-chat').classList.add('active');
}
// --- IMAGE HANDLING ---
function handleImage(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageBase64 = e.target.result.split(',')[1];
      alert('Image loaded. Type your question about it or send to describe.');
    };
    reader.readAsDataURL(file);
  }
}
// --- VOICE RECORDING ---
function toggleRecording() {
  const btn = document.querySelector('.voice-btn');
  if (recorder && recorder.state === 'recording') {
    recorder.stop();
    audioStream.getTracks().forEach(track => track.stop());
    btn.querySelector('svg').setAttribute('fill', '#5f6368'); // reset color or icon
    return;
  }
  navigator.mediaDevices.getUserMedia({audio: true}).then(stream => {
    audioStream = stream;
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => audioBlobs.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(audioBlobs, {type: 'audio/mp3'});
      audioBlobs = [];
      const formData = new FormData();
      formData.append('model', 'whisper-1');
      formData.append('file', blob, 'recording.mp3');
      fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: 'POST',
        headers: { "Authorization": `Bearer ${API_KEY}` },
        body: formData
      }).then(res => res.json()).then(data => {
        document.getElementById('user-input').value = data.text;
        sendMessage();
      }).catch(err => alert('Transcription error: ' + err));
    };
    recorder.start();
    btn.querySelector('svg').setAttribute('fill', 'red'); // indicate recording
  }).catch(err => alert('Microphone access denied: ' + err));
}
// --- MESSAGING LOGIC ---
async function sendMessage() {
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text && !currentImageBase64) return;
  
  if (editingMessageDiv) {
    // Replace the old message
    editingMessageDiv.querySelector('.msg-text').innerText = text;
    editingMessageDiv = null;
    input.value = '';
    scrollToBottom();
    return; // Don't send to AI when editing
  }
  
  // UI Updates
  appendMessage('user', text || 'Image query');
  input.value = '';
  document.getElementById('fab-menu').classList.remove('show');
  
  let userContent = text;
  if (currentImageBase64) {
    userContent = [
      { type: "text", text: text || "Describe this image" },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${currentImageBase64}` } }
    ];
    currentImageBase64 = null;
  }
  chatHistory.push({ role: "user", content: userContent });
 
  // Show Thinking Animation
  const thinking = document.getElementById('thinking');
  thinking.style.display = 'flex';
  scrollToBottom();
  
  let model = localStorage.getItem('groqModel') || defaultModel;
  if (Array.isArray(userContent) && userContent.some(c => c.type === 'image_url') && !visionModels.includes(model)) {
    model = 'llama-3.2-11b-vision-preview';
  }
  
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: chatHistory,
        stream: true
      })
    });
    
    if (!response.ok) throw new Error('API error');
    
    thinking.style.display = 'none';
    const aiRow = appendMessage('ai', ''); // empty initial
    const textSpan = aiRow.querySelector('.msg-text');
    let reply = '';
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (let line of lines) {
        if (line.startsWith('data: ')) {
          if (line.includes('[DONE]')) continue;
          const data = JSON.parse(line.slice(6));
          const delta = data.choices[0].delta.content;
          if (delta) {
            reply += delta;
            textSpan.innerHTML = reply.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            scrollToBottom();
          }
        }
      }
    }
    chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    thinking.style.display = 'none';
    appendMessage('ai', "I'm having trouble connecting to the server. Please try again.");
  }
}
function appendMessage(sender, text) {
  const container = document.getElementById('messages');
  let rowOrDiv;
 
  if (sender === 'user') {
    rowOrDiv = document.createElement('div');
    rowOrDiv.className = 'message user';
    
    const textSpan = document.createElement('span');
    textSpan.className = 'msg-text';
    textSpan.innerText = text;
    rowOrDiv.appendChild(textSpan);
    
    const controls = document.createElement('div');
    controls.className = 'msg-controls';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✎';
    editBtn.onclick = () => editMessage(rowOrDiv, text);
    controls.appendChild(editBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '🗑';
    deleteBtn.onclick = () => deleteMessage(rowOrDiv);
    controls.appendChild(deleteBtn);
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '⎘';
    copyBtn.onclick = () => copyText(text, copyBtn);
    controls.appendChild(copyBtn);
    
    rowOrDiv.appendChild(controls);
    container.appendChild(rowOrDiv);
  } else {
    // AI Message Layout
    rowOrDiv = document.createElement('div');
    rowOrDiv.className = 'ai-msg-row';
   
    // Logo Icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'ai-icon-box';
    iconDiv.innerHTML = `<svg viewBox="0 0 100 50" width="24" height="12"><path fill="none" stroke="#9b59b6" stroke-width="8" d="M25,25 C25,38 45,38 50,25 C55,12 75,12 75,25 C75,38 55,38 50,25 C45,12 25,12 25,25 Z" /></svg>`;
   
    // Bubble + Controls
    const contentDiv = document.createElement('div');
    contentDiv.style.flex = "1";
   
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ai-bubble';
    
    const textSpan = document.createElement('span');
    textSpan.className = 'msg-text';
    textSpan.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    msgDiv.appendChild(textSpan);
    
    const controls = document.createElement('div');
    controls.className = 'msg-controls';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '⎘';
    copyBtn.onclick = () => copyText(text, copyBtn);
    controls.appendChild(copyBtn);
    
    msgDiv.appendChild(controls);
   
    // Speaker Button
    const spkBtn = document.createElement('button');
    spkBtn.className = 'speaker-btn';
    spkBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg> Listen`;
    spkBtn.onclick = () => toggleSpeech(text, spkBtn);
    contentDiv.appendChild(msgDiv);
    contentDiv.appendChild(spkBtn);
   
    rowOrDiv.appendChild(iconDiv);
    rowOrDiv.appendChild(contentDiv);
    container.appendChild(rowOrDiv);
  }
 
  scrollToBottom();
  return rowOrDiv;
}
function editMessage(div, text) {
  document.getElementById('user-input').value = text;
  editingMessageDiv = div;
}
function deleteMessage(div) {
  if (confirm('Are you sure you want to delete this message?')) {
    div.remove();
  }
}
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    setTimeout(() => {
      btn.classList.remove('copied');
    }, 2000);
  });
}
// --- TTS USING GROQ ---
function toggleSpeech(text, btn) {
  if (btn.classList.contains('active')) {
    if (currentAudio) currentAudio.pause();
    btn.classList.remove('active');
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg> Listen`;
    return;
  }
  btn.classList.add('active');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h12v12H6z"/></svg> Stop`;
  fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text
    })
  }).then(res => res.blob()).then(blob => {
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.play();
    currentAudio.onended = () => {
      btn.classList.remove('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg> Listen`;
    };
  }).catch(() => {
    btn.classList.remove('active');
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg> Listen`;
  });
}
// --- UTILITIES ---
function scrollToBottom() {
  const win = document.getElementById('chat-window');
  win.scrollTop = win.scrollHeight;
}
function checkEnter(e) {
  if (e.key === 'Enter') sendMessage();
}
async function summarizeLast() {
  const bubbles = document.querySelectorAll('.ai-bubble .msg-text');
  if (bubbles.length === 0) return alert("Nothing to summarize yet.");
 
  const lastText = bubbles[bubbles.length - 1].innerText;
  const input = document.getElementById('user-input');
 
  input.value = `Summarize this in 3 bullet points: ${lastText}`;
  sendMessage();
}