document.addEventListener('DOMContentLoaded', () => {
    // index
    const songCards = document.querySelectorAll('.song-card');

    songCards.forEach(card => {
        card.addEventListener('click', () => {
            const songData = {
                audio: card.getAttribute('data-song'),
                lyrics: card.getAttribute('data-lyrics')
            };
            localStorage.setItem('currentSong', JSON.stringify(songData));
            window.location.href = 'page/player.html';
        });
    });

    // player
    const audioPlayer = document.getElementById('audio-player');
    const lyricsContainer = document.getElementById('lyrics-container');

    if (audioPlayer) {
        const localData = localStorage.getItem('currentSong');
        const songData = JSON.parse(localData);
        audioPlayer.src = songData.audio;

        let lineasLetra = [];
        let indiceActual = -1;

        fetch(songData.lyrics)
            .then(res => {
                if (!res.ok) throw new Error('Error al cargar JSON');
                return res.json();
            })
            .then(data => {
                lineasLetra = data.lyrics_and_bass_analysis
                    .map(item => ({
                        tiempo: transformarTiempo(item.timestamp),
                        texto: item.lyrics
                    }))
                    .sort((a, b) => a.tiempo - b.tiempo);
                
                revisarTiempoReal();
            })
            .catch(err => {
                console.error(err);
                if (lyricsContainer) lyricsContainer.textContent = "Letra no disponible";
            });

        setTimeout(() => {
            audioPlayer.play();
        }, 1000);

        function revisarTiempoReal() {
            if (!audioPlayer || !lyricsContainer || lineasLetra.length === 0) return;

            const tiempoActual = audioPlayer.currentTime;
            let nuevoIndice = -1;

            for (let i = 0; i < lineasLetra.length; i++) {
                if (tiempoActual >= lineasLetra[i].tiempo) {
                    nuevoIndice = i;
                } else {
                    break;
                }
            }

            if (nuevoIndice !== indiceActual && nuevoIndice !== -1) {
                indiceActual = nuevoIndice;
                actualizarLetraPantalla(lineasLetra[indiceActual].texto);
            }

            requestAnimationFrame(revisarTiempoReal);
        }

        function actualizarLetraPantalla(texto) {
            if (lyricsContainer.innerHTML === texto) return;

            lyricsContainer.style.transition = "opacity 0.2s ease";
            lyricsContainer.style.opacity = "0";

            setTimeout(() => {
                lyricsContainer.innerHTML = texto;
                lyricsContainer.style.opacity = "1";
            }, 120);
        }
    }

    function transformarTiempo(str) {
        const [minutos, segundos] = str.split(':');
        return (parseInt(minutos, 10) * 60) + parseFloat(segundos);
    }
});