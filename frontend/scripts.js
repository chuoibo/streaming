const textOutput = document.getElementById('text-output');
const audioPlayer = document.getElementById('audio-player');
const queryInput = document.getElementById('query-input');
const startBtn = document.getElementById('start-btn');

let audioQueue = [];
let isPlaying = false;
let eventSource = null;

startBtn.addEventListener('click', startStreaming);

function startStreaming() {
    if (eventSource) {
        eventSource.close(); // Close any existing connection
    }

    const query = encodeURIComponent(queryInput.value.trim());
    if (!query) {
        alert('Please enter a query');
        return;
    }

    eventSource = new EventSource(`${window.location.origin}/stream-tts?query=${query}`);

    eventSource.onopen = () => {
        console.log('EventSource connected');
        textOutput.innerText = '';
        audioPlayer.src = '';
        audioQueue = [];
        isPlaying = false;
    };

    eventSource.addEventListener('ttsUpdate', function (event) {
        const data = JSON.parse(event.data);
        console.log('TTS Update:', data);
        updateTTS(data);
    });

    eventSource.onerror = (error) => {
        console.error('EventSource failed', error);
        eventSource.close();
    };
}

function updateTTS(data) {
    const paragraph = document.createElement('p');
    paragraph.textContent = data.text;
    textOutput.appendChild(paragraph);

    const audioBytes = hexToBytes(data.audio);
    const blob = new Blob([audioBytes], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(blob);
    
    audioQueue.push({ url: audioUrl, duration: data.duration });
    playNextAudio();
}

function playNextAudio() {
    if (isPlaying || audioQueue.length === 0) return;

    isPlaying = true;
    const nextAudio = audioQueue.shift();
    audioPlayer.src = nextAudio.url;
    
    audioPlayer.play().then(() => {
        audioPlayer.onended = () => {
            isPlaying = false;
            URL.revokeObjectURL(audioPlayer.src);
            playNextAudio();
        };
    }).catch(error => {
        console.error('Audio playback failed:', error);
        isPlaying = false;
        playNextAudio();
    });
}

// Helper function to convert hex string to bytes
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}