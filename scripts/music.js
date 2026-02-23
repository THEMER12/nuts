const coverSvg = document.getElementById('cover-svg');
const music = document.getElementById('music');
const container = document.getElementById('player-container');
const lyricsDiv = document.getElementById('lyrics');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

let lyricsData = [];
let activeLyric = "";

let audioCtx;
let analyser;
let dataArray;
let bufferLength;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

fetch('/music/Lil Peep_LIVE FOREVER_04_Nuts_lines.json')
    .then(response => response.json())
    .then(data => {
        lyricsData = data.transcription.map(item => ({
            text: item.text.trim(),
            from: item.offsets.from / 1000,
            to: item.offsets.to / 1000
        }));
    })
    .catch(err => console.error("Error cargando JSON:", err));

coverSvg.addEventListener('click', () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        
        const source = audioCtx.createMediaElementSource(music);
        source.connect(analyser);
        analyser.connect(audioCtx.destination); // Enviar el sonido a los altavoces
        
        analyser.fftSize = 256; 
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    music.play();
    
    container.classList.add('opacity-0', 'scale-90', 'pointer-events-none');
    setTimeout(() => {
        container.classList.add('hidden');
        lyricsDiv.classList.remove('opacity-0');
        lyricsDiv.classList.add('opacity-100');
    }, 500);

    requestAnimationFrame(updateLoop);
});

function updateLoop() {
    const currentTime = music.currentTime;
    const currentLine = lyricsData.find(line => currentTime >= line.from && currentTime <= line.to);
    const newText = currentLine ? currentLine.text : '';

    if (activeLyric !== newText) {
        activeLyric = newText;
        lyricsDiv.style.opacity = 0;
        setTimeout(() => {
            lyricsDiv.textContent = activeLyric;
            lyricsDiv.style.opacity = activeLyric ? 1 : 0;
        }, 150);
    }

    if (analyser) {
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] * 1.5; 

            ctx.fillStyle = `rgba(255, 255, 255, ${barHeight / 400})`;
            ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1; 
        }

        const bass = dataArray[2]; 
        if (activeLyric) {
            const glowAmount = bass / 3; 
            lyricsDiv.style.textShadow = `0px 0px ${glowAmount}px rgba(252, 191, 73, ${bass / 255})`;
        }
    }

    if (!music.paused && !music.ended) {
        requestAnimationFrame(updateLoop);
    }
}