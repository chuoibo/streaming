const textOutput = document.getElementById('text-output');
const audioPlayer = document.getElementById('audio-player');

let audioQueue = [];
let isPlaying = false;

// Create EventSource for SSE endpoint
const eventSource = new EventSource('http://127.0.0.1:8000/stream-tts');

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
};

// Function to update text and queue audio
function updateTTS(data) {
    // Update text display
    const paragraph = document.createElement('p');
    paragraph.textContent = data.text;
    textOutput.appendChild(paragraph);

    // Convert hex string to audio blob and add to queue with duration
    const audioBytes = hexToBytes(data.audio);
    const blob = new Blob([audioBytes], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(blob);
    
    audioQueue.push({ url: audioUrl, duration: data.duration });
    playNextAudio();
}

// Play audio sequentially
function playNextAudio() {
    if (isPlaying || audioQueue.length === 0) return;

    isPlaying = true;
    const nextAudio = audioQueue.shift();
    audioPlayer.src = nextAudio.url;
    
    audioPlayer.play().then(() => {
        audioPlayer.onended = () => {
            isPlaying = false;
            URL.revokeObjectURL(audioPlayer.src); // Clean up memory
            playNextAudio(); // Play the next in queue
        };
    }).catch(error => {
        console.error('Audio playback failed:', error);
        isPlaying = false;
        playNextAudio(); // Try next audio on error
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