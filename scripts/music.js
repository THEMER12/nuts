document.addEventListener('DOMContentLoaded', () => {

    const songCards = document.querySelectorAll('.song-card');

    songCards.forEach(card => {

        card.addEventListener('click', () => {

            const img = card.querySelector('#data-song img');

            const songData = {
                audio: card.getAttribute('data-song'),
                lyrics: card.getAttribute('data-lyrics'),
                cover: img ? img.getAttribute('src') : ''
            };

            localStorage.setItem(
                'currentSong',
                JSON.stringify(songData)
            );

            window.location.href = 'page/player.html';

        });

    });


    const audioPlayer = document.getElementById('audio-player');
    const lyricsContainer = document.getElementById('lyrics-container');
    const imgMusic = document.getElementById('img-music');
    const titleMusic = document.getElementById('title-music');

    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const seekSlider = document.getElementById('seek-slider');
    const currentTimeElem = document.getElementById('current-time');
    const durationTimeElem = document.getElementById('duration-time');

    if (audioPlayer) {

        const localData = localStorage.getItem('currentSong');

        if (localData) {

            const songData = JSON.parse(localData);

            audioPlayer.src = songData.audio;

        if (imgMusic && songData.cover) {
            imgMusic.src = '/' + songData.cover;
        }

            if (titleMusic && songData.audio) {

                const fileName = decodeURIComponent(
                    songData.audio.split('/').pop()
                );

                titleMusic.textContent = fileName
                    .replace(/\.flac$/i, '')
                    .replace(/\.mp3$/i, '');

            }

            let lineasLetra = [];
            let indiceActual = -1;

            fetch(songData.lyrics)
                .then(res => {

                    if (!res.ok) {
                        throw new Error('Error al cargar JSON');
                    }

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

                    if (lyricsContainer) {
                        lyricsContainer.textContent = 'Letra no disponible';
                    }

                });

            setTimeout(() => {

                audioPlayer.play().catch(e => {
                    console.log('Autoplay bloqueado:', e);
                });

            }, 1000);


            function revisarTiempoReal() {

                if (!audioPlayer || !lyricsContainer) {
                    return;
                }

                const tiempoActual = audioPlayer.currentTime;

                if (lineasLetra.length > 0) {

                    let nuevoIndice = -1;

                    for (let i = 0; i < lineasLetra.length; i++) {

                        if (tiempoActual >= lineasLetra[i].tiempo) {
                            nuevoIndice = i;
                        } else {
                            break;
                        }

                    }

                    if (
                        nuevoIndice !== indiceActual &&
                        nuevoIndice !== -1
                    ) {

                        indiceActual = nuevoIndice;

                        actualizarLetraPantalla(
                            lineasLetra[indiceActual].texto
                        );

                    }

                }

                if (audioPlayer.duration) {

                    const progress =
                        (tiempoActual / audioPlayer.duration) * 100;

                    if (seekSlider) {
                        seekSlider.value = progress;
                    }

                    if (currentTimeElem) {
                        currentTimeElem.textContent =
                            formatTime(tiempoActual);
                    }

                }

                requestAnimationFrame(revisarTiempoReal);

            }


            function actualizarLetraPantalla(texto) {

                if (lyricsContainer.innerHTML === texto) {
                    return;
                }

                lyricsContainer.style.transition =
                    'opacity 0.2s ease';

                lyricsContainer.style.opacity = '0';

                setTimeout(() => {

                    lyricsContainer.innerHTML = texto;
                    lyricsContainer.style.opacity = '1';

                }, 120);

            }


            if (playPauseBtn) {

                playPauseBtn.addEventListener('click', () => {

                    if (audioPlayer.paused) {

                        audioPlayer.play();

                    } else {

                        audioPlayer.pause();

                    }

                });

            }


            audioPlayer.addEventListener(
                'loadedmetadata',
                () => {

                    if (durationTimeElem) {

                        durationTimeElem.textContent =
                            formatTime(audioPlayer.duration);

                    }

                }
            );


            audioPlayer.addEventListener('play', () => {

                if (playIcon && pauseIcon) {

                    playIcon.classList.add('hidden');
                    pauseIcon.classList.remove('hidden');

                }

                iniciarAnalizadorAudio();

            });


            audioPlayer.addEventListener('pause', () => {

                if (playIcon && pauseIcon) {

                    playIcon.classList.remove('hidden');
                    pauseIcon.classList.add('hidden');

                }

            });


            if (seekSlider) {

                seekSlider.addEventListener('input', () => {

                    if (audioPlayer.duration) {

                        const seekTo =
                            (seekSlider.value / 100) *
                            audioPlayer.duration;

                        audioPlayer.currentTime = seekTo;

                    }

                });

            }

        }

    }


    function transformarTiempo(str) {

        const [minutos, segundos] = str.split(':');

        return (
            parseInt(minutos, 10) * 60
        ) + parseFloat(segundos);

    }


    function formatTime(seconds) {

        if (isNaN(seconds)) {
            return '00:00';
        }

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return (
            `${mins < 10 ? '0' : ''}${mins}:` +
            `${secs < 10 ? '0' : ''}${secs}`
        );

    }


    const canvas = document.getElementById('fire');

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext('2d');

    const MIN_FIRE_HEIGHT = 10;
    const MAX_FIRE_HEIGHT = 600;
    const BAR_WIDTH = 1;
    const BAR_GAP = 0;

    let width = 0;
    let height = 0;
    let baseY = 0;
    let bars = [];

    let audioContext = null;
    let analyser = null;
    let source = null;
    let dataArray = null;
    let audioInicializado = false;


    function resize() {

        const dpr = window.devicePixelRatio || 1;

        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );

        baseY = height;

        crearBarras();

    }


    window.addEventListener('resize', resize);


    function crearBarras() {

        bars = [];

        const cantidad = Math.ceil(
            width / (BAR_WIDTH + BAR_GAP)
        );

        for (let i = 0; i < cantidad; i++) {

            bars.push({

                height: MIN_FIRE_HEIGHT,

                targetHeight: MIN_FIRE_HEIGHT,

                phase: Math.random() * Math.PI * 2,

                speed:
                    0.02 +
                    Math.random() * 0.04,

                randomness:
                    0.75 +
                    Math.random() * 0.5

            });

        }

    }


    function iniciarAnalizadorAudio() {

        if (
            audioInicializado ||
            !audioPlayer
        ) {
            return;
        }

        try {

            audioInicializado = true;

            audioContext = new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

            analyser = audioContext.createAnalyser();

            analyser.fftSize = 512;

            analyser.smoothingTimeConstant = 0.82;

            const bufferLength =
                analyser.frequencyBinCount;

            dataArray =
                new Uint8Array(bufferLength);

            source =
                audioContext.createMediaElementSource(
                    audioPlayer
                );

            source.connect(analyser);

            analyser.connect(
                audioContext.destination
            );

            if (
                audioContext.state ===
                'suspended'
            ) {

                audioContext.resume();

            }

        } catch (error) {

            console.error(
                'Error al iniciar el analizador:',
                error
            );

        }

    }


    function obtenerFrecuencia(inicio, fin) {

        if (
            !analyser ||
            !dataArray
        ) {
            return 0;
        }

        let total = 0;
        let cantidad = 0;

        for (
            let i = inicio;
            i <= fin;
            i++
        ) {

            total += dataArray[i];
            cantidad++;

        }

        if (cantidad === 0) {
            return 0;
        }

        return total / cantidad / 255;

    }


    function dibujarLlama(
        x,
        altura,
        index,
        tiempo
    ) {

        const barra = bars[index];

        const movimiento =
            Math.sin(
                tiempo *
                barra.speed +
                barra.phase
            ) * 7;

        const alturaFinal =
            Math.max(
                MIN_FIRE_HEIGHT,
                altura + movimiento
            );

        const ancho = BAR_WIDTH;
        const y = baseY;

        const gradient =
            ctx.createLinearGradient(
                0,
                y - alturaFinal,
                0,
                y
            );

        gradient.addColorStop(
            0,
            'rgba(255,255,255,0.02)'
        );

        gradient.addColorStop(
            0.20,
            'rgba(255,255,255,0.10)'
        );

        gradient.addColorStop(
            0.45,
            'rgba(255,255,255,0.30)'
        );

        gradient.addColorStop(
            0.70,
            'rgba(255,255,255,0.60)'
        );

        gradient.addColorStop(
            1,
            'rgba(255,255,255,0.95)'
        );

        ctx.fillStyle = gradient;

        ctx.beginPath();

        ctx.moveTo(x, y);

        ctx.lineTo(
            x,
            y - alturaFinal * 0.42
        );

        ctx.quadraticCurveTo(
            x + ancho * 0.05,
            y - alturaFinal * 0.72,
            x + ancho * 0.48,
            y - alturaFinal
        );

        ctx.quadraticCurveTo(
            x + ancho * 0.78,
            y - alturaFinal * 0.72,
            x + ancho,
            y - alturaFinal * 0.40
        );

        ctx.lineTo(
            x + ancho,
            y
        );

        ctx.closePath();

        ctx.fill();

    }


    function animarFuego(tiempo) {

        requestAnimationFrame(animarFuego);

        ctx.clearRect(
            0,
            0,
            width,
            height
        );

        if (
            analyser &&
            dataArray
        ) {

            analyser.getByteFrequencyData(
                dataArray
            );

        }

        const cantidad = bars.length;

        for (
            let i = 0;
            i < cantidad;
            i++
        ) {

            const porcentaje =
                i / cantidad;

            const inicio =
                Math.floor(
                    porcentaje *
                    dataArray.length *
                    0.65
                );

            const fin =
                Math.floor(
                    inicio +
                    dataArray.length *
                    0.025
                );

            let intensidad =
                obtenerFrecuencia(
                    inicio,
                    Math.min(
                        fin,
                        dataArray.length - 1
                    )
                );

            const pesoGraves =
                1.5 -
                porcentaje * 0.55;

            intensidad *= pesoGraves;

            const alturaObjetivo =
                MIN_FIRE_HEIGHT +
                intensidad *
                MAX_FIRE_HEIGHT *
                bars[i].randomness;

            bars[i].targetHeight =
                Math.max(
                    MIN_FIRE_HEIGHT,
                    Math.min(
                        MAX_FIRE_HEIGHT,
                        alturaObjetivo
                    )
                );

            if (
                bars[i].targetHeight >
                bars[i].height
            ) {

                bars[i].height +=
                    (
                        bars[i].targetHeight -
                        bars[i].height
                    ) * 0.25;

            } else {

                bars[i].height +=
                    (
                        bars[i].targetHeight -
                        bars[i].height
                    ) * 0.08;

            }

            const x =
                i *
                (BAR_WIDTH + BAR_GAP);

            dibujarLlama(
                x,
                bars[i].height,
                i,
                tiempo
            );

        }

    }


    resize();

    animarFuego(0);

});