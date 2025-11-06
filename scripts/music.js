const coverSvg = document.getElementById('cover-svg');
const music = document.getElementById('music');
const container = document.getElementById('player-container');
const lyricsDiv = document.getElementById('lyrics');

// // Estilos iniciales del div de letras
// lyricsDiv.classList.add('text-white', 'text-xl', 'text-center', 'mt-4', 'h-16', 'flex', 'items-center', 'justify-center', 'px-4');

// Animación de portada
coverSvg.addEventListener('click', () => {
    music.play();
    container.classList.add('opacity-0', 'scale-90');
    setTimeout(() => {
        container.classList.add('hidden');
    }, 500);
});

// // Cargar transcripción
// fetch('music/Lil_Peep_LIVE_FOREVER_04_Nuts.wav.json')
//     .then(response => response.json())
//     .then(data => {
//         const transcription = data.transcription;

//         // Convertimos timestamps a segundos
//         const lyrics = transcription.map(item => {
//             const fromParts = item.timestamps.from.split(/[:,]/); // ["hh","mm","ss","ms"]
//             const toParts = item.timestamps.to.split(/[:,]/);

//             const fromSec = parseInt(fromParts[0]) * 3600 +
//                             parseInt(fromParts[1]) * 60 +
//                             parseInt(fromParts[2]) +
//                             parseInt(fromParts[3]) / 1000;

//             const toSec = parseInt(toParts[0]) * 3600 +
//                           parseInt(toParts[1]) * 60 +
//                           parseInt(toParts[2]) +
//                           parseInt(toParts[3]) / 1000;

//             return {
//                 text: item.text.trim(),
//                 from: fromSec,
//                 to: toSec
//             };
//         });

//         // Función para actualizar la letra según tiempo
//         function updateLyrics() {
//             const currentTime = music.currentTime;
//             const currentLine = lyrics.find(line => currentTime >= line.from && currentTime <= line.to);

//             // Mostrar letra actual o vacío
//             lyricsDiv.textContent = currentLine && currentLine.text ? currentLine.text : '';

//             requestAnimationFrame(updateLyrics);
//         }

//         // Inicia sincronización cuando empieza la canción
//         music.addEventListener('play', () => {
//             requestAnimationFrame(updateLyrics);
//         });
//     })
//     .catch(err => console.error('Error cargando la transcripción:', err));

fetch('/music/Lil Peep_LIVE FOREVER_04_Nuts_lines.json')
     .then(response => response.json())
    .then(data => {
        const lineLyrics = convertTimestampsToSeconds(data.transcription);
        console.log(lineLyrics);

        function updateLyrics() {
            const currentTime = music.currentTime;
            const currentLine = lineLyrics.find(line => currentTime >= line.from && currentTime <= line.to);

            lyricsDiv.textContent = currentLine ? currentLine.text : '';

            requestAnimationFrame(updateLyrics);
        }
        music.addEventListener('play', () => {
            requestAnimationFrame(updateLyrics);
        });
    })
    .catch(err => console.error("Error cargando JSON:", err));



function convertTimestampsToSeconds(transcription) {
    return transcription.map(item => {
        const timeToSec = (timeStr) => {
            const [hh, mm, ss, ms] = timeStr.split(/[:,]/).map(Number);
            return hh * 3600 + mm * 60 + ss + ms / 1000;
        };

        return {
            text: item.text.trim(),
            from: timeToSec(item.timestamps.from),
            to: timeToSec(item.timestamps.to)
        };
    });
}

