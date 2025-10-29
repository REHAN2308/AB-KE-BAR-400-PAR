// Canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('scoreDisplay');
const highScoreDisplay = document.getElementById('highScore');
const restartButton = document.getElementById('restartButton');

// Game state
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
highScoreDisplay.textContent = highScore;

// Images
const images = {
    bird: null,
    building: null
};

let imagesLoaded = false;

// Audio
const gameMusic = new Audio('bird flying.mp3');
gameMusic.loop = true; // Loop the music during gameplay
gameMusic.volume = 0.9; // Set volume to 50%

const gameOverMusic = new Audio('waha modi.mp3');
gameOverMusic.loop = false; // Play once when game ends
gameOverMusic.volume = 0.9; // Set volume to 90%

// Audio unlock flag for mobile browsers
let audioUnlocked = false;

// Function to unlock audio on first user interaction
async function unlockAudio() {
    if (!audioUnlocked) {
        console.log('Unlocking audio...');
        // Play and immediately pause both audio files to unlock audio context
        const unlockPromises = [
            gameMusic.play().then(() => {
                gameMusic.pause();
                gameMusic.currentTime = 0;
            }).catch(e => console.log('Game music unlock failed:', e)),
            
            gameOverMusic.play().then(() => {
                gameOverMusic.pause();
                gameOverMusic.currentTime = 0;
            }).catch(e => console.log('Game over music unlock failed:', e))
        ];
        
        await Promise.all(unlockPromises);
        audioUnlocked = true;
        console.log('All audio unlocked successfully!');
    }
}
// Set canvas size
function resizeCanvas() {
    const maxWidth = 480;
    const maxHeight = 640;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const scale = Math.min(
        windowWidth / maxWidth,
        windowHeight / maxHeight,
        1
    );
    
    canvas.width = maxWidth * scale;
    canvas.height = maxHeight * scale;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Bird object
const bird = {
    x: 100,
    y: canvas.height / 2,
    width: 40,
    height: 40,
    velocity: 0,
    gravity: 0.18,
    jumpStrength: -4.5,
    rotation: 0,
    
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        // Rotate bird based on velocity
        const maxRotation = Math.PI / 4;
        this.rotation = Math.max(-maxRotation, Math.min(maxRotation, this.velocity * 0.05));
        ctx.rotate(this.rotation);
        
        if (images.bird && imagesLoaded) {
            ctx.drawImage(images.bird, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Fallback: draw simple bird shape
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            
            // Eye
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(this.width / 4, -this.height / 4, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Beak
            ctx.fillStyle = '#FF8C00';
            ctx.beginPath();
            ctx.moveTo(this.width / 2, 0);
            ctx.lineTo(this.width / 2 + 10, -3);
            ctx.lineTo(this.width / 2 + 10, 3);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
    },
    
    update() {
        this.velocity += this.gravity;
        this.y += this.velocity;
        
        // Keep bird in bounds
        if (this.y < 0) {
            this.y = 0;
            this.velocity = 0;
        }
        
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.velocity = 0;
            if (gameState === 'playing') {
                endGame();
            }
        }
    },
    
    jump() {
        this.velocity = this.jumpStrength;
    },
    
    reset() {
        this.x = 100;
        this.y = canvas.height / 2;
        this.velocity = 0;
        this.rotation = 0;
    }
};

// Pipes (buildings) array
const pipes = [];
const pipeWidth = 200;
const pipeGap = 250;
const pipeSpeed = 1.8;
let frameCount = 0;

function createPipe() {
    const minHeight = 50;
    const maxHeight = canvas.height - pipeGap - minHeight;
    const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
    
    pipes.push({
        x: canvas.width,
        topHeight: topHeight,
        bottomY: topHeight + pipeGap,
        bottomHeight: canvas.height - (topHeight + pipeGap),
        counted: false
    });
}

function drawPipes() {
    pipes.forEach(pipe => {
        // Draw top pipe (building)
        if (images.building && imagesLoaded) {
            // Draw building image upside down for top pipe
            ctx.save();
            ctx.translate(pipe.x + pipeWidth, 0);
            ctx.scale(-1, 1);
            ctx.rotate(Math.PI);
            ctx.drawImage(images.building, -pipeWidth, -pipe.topHeight, pipeWidth, pipe.topHeight);
            ctx.restore();
        } else {
            // Fallback: draw simple rectangles
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 3;
            ctx.strokeRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        }
        
        // Draw bottom pipe (building)
        if (images.building && imagesLoaded) {
            ctx.drawImage(images.building, pipe.x, pipe.bottomY, pipeWidth, pipe.bottomHeight);
        } else {
            // Fallback: draw simple rectangles
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(pipe.x, pipe.bottomY, pipeWidth, pipe.bottomHeight);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 3;
            ctx.strokeRect(pipe.x, pipe.bottomY, pipeWidth, pipe.bottomHeight);
        }
    });
}

function updatePipes() {
    // Create new pipes
    if (frameCount % 150 === 0) {
        createPipe();
    }
    
    // Move and remove pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= pipeSpeed;
        
        // Check if bird passed the pipe - score when pipe's right edge passes bird's center
        const pipeRightEdge = pipes[i].x + pipeWidth;
        const birdCenter = bird.x + bird.width / 2;
        
        if (!pipes[i].counted && pipeRightEdge < birdCenter) {
            pipes[i].counted = true;
            score++;
            scoreDisplay.textContent = score;
            console.log('Score increased! Current score:', score, 'Pipe passed at x:', pipes[i].x);
        }
        
        // Remove off-screen pipes
        if (pipes[i].x + pipeWidth < 0) {
            pipes.splice(i, 1);
        }
        
        // Check collision
        if (checkCollision(pipes[i])) {
            endGame();
        }
    }
}

function checkCollision(pipe) {
    // Hitbox collision detection
    const birdLeft = bird.x + 5; // Small margin for better gameplay
    const birdRight = bird.x + bird.width - 5;
    const birdTop = bird.y + 5;
    const birdBottom = bird.y + bird.height - 5;
    
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + pipeWidth;
    
    // Check if bird is horizontally aligned with pipe
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Check if bird hits top or bottom pipe
        if (birdTop < pipe.topHeight || birdBottom > pipe.bottomY) {
            return true;
        }
    }
    
    return false;
}

// Game loop
function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'playing') {
        frameCount++;
        bird.update();
        updatePipes();
    }
    
    drawPipes();
    bird.draw();
    
    requestAnimationFrame(gameLoop);
}

// Game control functions
async function startGame() {
    // Ensure audio is unlocked before starting
    if (!audioUnlocked) {
        await unlockAudio();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    gameState = 'playing';
    score = 0;
    frameCount = 0;
    pipes.length = 0;
    bird.reset();
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    scoreDisplay.textContent = score;
    
    // Stop game over music if playing
    if (gameOverMusic) {
        gameOverMusic.pause();
        gameOverMusic.currentTime = 0;
    }
    
    // Play game music
    gameMusic.currentTime = 0; // Reset to start
    gameMusic.play().catch(e => {
        console.log('Audio play failed:', e);
        // If play fails, try unlocking again
        audioUnlocked = false;
    });
    
    console.log('Game started! Bird position:', bird.x, bird.y);
    console.log('Score reset to:', score);
}

function endGame() {
    if (gameState !== 'playing') return;
    
    gameState = 'gameOver';
    
    console.log('Game Over! Final score:', score);
    
    // Stop game music
    gameMusic.pause();
    gameMusic.currentTime = 0;
    
    // Play game over music when available
    if (gameOverMusic) {
        gameOverMusic.currentTime = 0;
        gameOverMusic.play().catch(e => console.log('Game over audio play failed:', e));
    }
    
    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }
    
    scoreDisplay.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    
    console.log('Game over screen should be visible now');
    console.log('gameOverScreen classes:', gameOverScreen.classList);
}

// Input handlers
async function handleInput() {
    // Unlock audio on first interaction and wait for it to complete
    if (!audioUnlocked) {
        await unlockAudio();
        // Small delay to ensure audio context is fully ready on mobile
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (gameState === 'start') {
        startGame();
    } else if (gameState === 'playing') {
        bird.jump();
    }
}

// Touch and click events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
});

canvas.addEventListener('click', handleInput);

startScreen.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
});

startScreen.addEventListener('click', handleInput);

restartButton.addEventListener('touchstart', async (e) => {
    e.preventDefault();
    await unlockAudio(); // Unlock audio before restarting
    await startGame();
});

restartButton.addEventListener('click', async (e) => {
    e.preventDefault();
    await unlockAudio(); // Unlock audio before restarting
    await startGame();
});

// Keyboard support (for desktop testing)
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleInput();
    }
});

// Load images
function loadImages() {
    const birdImg = new Image();
    const buildingImg = new Image();
    
    let loadedCount = 0;
    
    function checkAllLoaded() {
        loadedCount++;
        if (loadedCount === 2) {
            imagesLoaded = true;
            console.log('All images loaded successfully');
        }
    }
    
    birdImg.onload = () => {
        images.bird = birdImg;
        checkAllLoaded();
    };
    
    birdImg.onerror = () => {
        console.log('Bird image not found, using fallback graphics');
        checkAllLoaded();
    };
    
    buildingImg.onload = () => {
        images.building = buildingImg;
        checkAllLoaded();
    };
    
    buildingImg.onerror = () => {
        console.log('Building image not found, using fallback graphics');
        checkAllLoaded();
    };
    
    // Try to load images from assets folder
    birdImg.src = 'modi ji.png';
    buildingImg.src = 'blocking objects.jpg';
}

// Initialize game
loadImages();
gameLoop();

// Test if MODI.png is accessible
const testImg = new Image();
testImg.onload = () => console.log('MODI.png loaded successfully!');
testImg.onerror = () => console.error('Failed to load MODI.png - check if file exists');
testImg.src = 'MODI.png';
