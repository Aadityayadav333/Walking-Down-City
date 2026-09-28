/* ============================================================
   WALKING QUEST
   GPS + STEP COUNTER + COINS + SCORE + MISSIONS
============================================================ */


/* ============================================================
   GAME STATE
============================================================ */

let gameStarted = false;

let watchId = null;

let currentDirection = null;

let currentLevel = 1;

let levelCompleted = false;


/* ============================================================
   PLAYER
============================================================ */

let playerX = 50;

let playerY = 50;


/* ============================================================
   STEPS / DISTANCE
============================================================ */

let stepCount = 0;

let walkingDistance = 0;

let gpsDistance = 0;


// Approximate distance represented by one step
const STEP_LENGTH = 0.70;


// Game movement per real-world metre
const PIXELS_PER_METER = 3;


/* ============================================================
   SCORE
============================================================ */

let score = 0;

let coinsCollected = 0;


/* ============================================================
   COINS
============================================================ */

const coins = [
    "coin1",
    "coin2",
    "coin3",
    "coin4",
    "coin5"
];


// Track which coins have already been collected
const collectedCoins = new Set();


/* ============================================================
   MISSION
============================================================ */

let missionDistance = 100;

let missionStartDistance = 0;


/* ============================================================
   GPS
============================================================ */

let previousPosition = null;

const MAX_GPS_ACCURACY = 200;


/* ============================================================
   STEP DETECTION
============================================================ */

let gravityX = 0;

let gravityY = 0;

let gravityZ = 0;

const GRAVITY_ALPHA = 0.8;

let accelerationHistory = [];

const SMOOTHING_SAMPLES = 5;

const STEP_THRESHOLD = 1.25;

const MIN_STEP_INTERVAL = 300;

let lastStepTime = 0;

let previousAcceleration = 0;

let stepArmed = true;

let motionEnabled = false;


/* ============================================================
   INITIALIZATION
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initializeGame
);


function initializeGame() {

    console.log(
        "Walking Quest initialized."
    );


    updateAllUI();

    updatePlayerPosition();

    updateMission();

    updateStatus(
        "Ready to start your journey."
    );


    setupCoinButtons();


    // Make sure coins are visible
    coins.forEach(
        coinId => {

            const coin =
                document.getElementById(
                    coinId
                );

            if (coin) {

                coin.style.display =
                    "flex";
            }
        }
    );
}


/* ============================================================
   COIN BUTTON SETUP
============================================================ */

function setupCoinButtons() {

    coins.forEach(
        coinId => {

            const coin =
                document.getElementById(
                    coinId
                );

            if (!coin) {
                return;
            }


            // Clicking a coin manually can also
            // collect it during desktop testing.
            coin.addEventListener(
                "click",
                function () {

                    collectCoin(
                        coinId
                    );

                }
            );
        }
    );
}


/* ============================================================
   DIRECTION
============================================================ */

function setDirection(
    direction
) {

    if (levelCompleted) {

        updateStatus(
            "Level completed! Press Reset to play again."
        );

        return;
    }


    currentDirection =
        direction;


    const directionElement =
        document.getElementById(
            "direction"
        );


    if (directionElement) {

        directionElement.textContent =
            direction.toUpperCase();
    }


    console.log(
        "Direction:",
        direction
    );
}


/* ============================================================
   START GAME
============================================================ */

async function startGame() {

    if (gameStarted) {

        updateStatus(
            "Game is already running."
        );

        return;
    }


    if (levelCompleted) {

        updateStatus(
            "Level completed! Reset to play again."
        );

        return;
    }


    gameStarted = true;


    updateStatus(
        "Starting GPS and step counter..."
    );


    // Start motion tracking
    await enableMotionTracking();


    // Start GPS
    if (navigator.geolocation) {

        watchId =
            navigator.geolocation.watchPosition(

                handleLocation,

                handleLocationError,

                {
                    enableHighAccuracy: true,

                    maximumAge: 2000,

                    timeout: 30000
                }

            );
    }


    updateStatus(
        "Game running — choose a direction and walk!"
    );


    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.textContent =
            "🚶 Walking...";
    }
}


/* ============================================================
   ENABLE MOTION TRACKING
============================================================ */

async function enableMotionTracking() {

    if (!window.DeviceMotionEvent) {

        console.warn(
            "DeviceMotionEvent is not supported."
        );


        updateStatus(
            "Motion sensor unavailable. GPS mode active."
        );

        return;
    }


    // Some browsers require permission
    if (
        typeof DeviceMotionEvent.requestPermission ===
        "function"
    ) {

        try {

            const permission =
                await DeviceMotionEvent.requestPermission();


            if (permission !== "granted") {

                console.warn(
                    "Motion permission denied."
                );


                updateStatus(
                    "Motion permission denied. GPS still active."
                );

                return;
            }

        }
        catch (error) {

            console.error(
                "Motion permission error:",
                error
            );

            return;
        }
    }


    window.addEventListener(
        "devicemotion",
        handleMotion,
        true
    );


    motionEnabled = true;


    console.log(
        "Motion tracking enabled."
    );
}


/* ============================================================
   ACCELEROMETER
============================================================ */

function handleMotion(
    event
) {

    if (!gameStarted) {
        return;
    }


    const acceleration =
        event.accelerationIncludingGravity;


    if (!acceleration) {
        return;
    }


    const x =
        acceleration.x || 0;

    const y =
        acceleration.y || 0;

    const z =
        acceleration.z || 0;


    // Remove gravity
    gravityX =
        GRAVITY_ALPHA * gravityX +
        (1 - GRAVITY_ALPHA) * x;

    gravityY =
        GRAVITY_ALPHA * gravityY +
        (1 - GRAVITY_ALPHA) * y;

    gravityZ =
        GRAVITY_ALPHA * gravityZ +
        (1 - GRAVITY_ALPHA) * z;


    const linearX =
        x - gravityX;

    const linearY =
        y - gravityY;

    const linearZ =
        z - gravityZ;


    const magnitude =

        Math.sqrt(

            linearX * linearX +

            linearY * linearY +

            linearZ * linearZ

        );


    accelerationHistory.push(
        magnitude
    );


    if (
        accelerationHistory.length >
        SMOOTHING_SAMPLES
    ) {

        accelerationHistory.shift();
    }


    const average =

        accelerationHistory.reduce(

            (sum, value) =>
                sum + value,

            0

        ) /
        accelerationHistory.length;


    detectStep(
        average
    );
}


/* ============================================================
   STEP DETECTION
============================================================ */

function detectStep(
    acceleration
) {

    const now =
        Date.now();


    const rising =
        acceleration >
        previousAcceleration;


    const aboveThreshold =
        acceleration >
        STEP_THRESHOLD;


    if (

        rising &&

        aboveThreshold &&

        stepArmed &&

        now - lastStepTime >
        MIN_STEP_INTERVAL

    ) {

        registerStep();

        lastStepTime =
            now;

        stepArmed =
            false;
    }


    if (
        acceleration <
        STEP_THRESHOLD * 0.5
    ) {

        stepArmed =
            true;
    }


    previousAcceleration =
        acceleration;
}


/* ============================================================
   REGISTER STEP
============================================================ */

function registerStep() {

    if (!gameStarted) {
        return;
    }


    if (levelCompleted) {
        return;
    }


    stepCount++;


    walkingDistance =
        stepCount *
        STEP_LENGTH;


    updateAllUI();


    console.log(
        `Step ${stepCount} | ${walkingDistance.toFixed(1)}m`
    );


    // Move player
    moveCharacter(
        STEP_LENGTH
    );


    // Check coins
    checkCoinCollisions();


    // Check goal
    checkGoalCollision();


    // Update mission
    updateMission();
}


/* ============================================================
   MOVE PLAYER
============================================================ */

function moveCharacter(
    distance
) {

    if (
        !currentDirection
    ) {

        console.log(
            "Step detected but no direction selected."
        );

        return;
    }


    const movement =
        distance *
        PIXELS_PER_METER;


    switch (
        currentDirection
    ) {

        case "up":

            playerY -= movement;

            break;


        case "down":

            playerY += movement;

            break;


        case "left":

            playerX -= movement;

            break;


        case "right":

            playerX += movement;

            break;
    }


    // Keep player inside map
    playerX =
        Math.max(
            2,
            Math.min(
                98,
                playerX
            )
        );


    playerY =
        Math.max(
            2,
            Math.min(
                98,
                playerY
            )
        );


    updatePlayerPosition();


    console.log(
        "Player:",
        playerX.toFixed(1),
        playerY.toFixed(1)
    );
}


/* ============================================================
   UPDATE PLAYER POSITION
============================================================ */

function updatePlayerPosition() {

    const player =
        document.getElementById(
            "player"
        );


    if (!player) {
        return;
    }


    player.style.left =
        `${playerX}%`;


    player.style.bottom =
        `${playerY}%`;
}


/* ============================================================
   COIN COLLISION DETECTION
============================================================ */

function checkCoinCollisions() {

    const player =
        document.getElementById(
            "player"
        );


    if (!player) {
        return;
    }


    const playerRect =
        player.getBoundingClientRect();


    coins.forEach(
        coinId => {

            if (
                collectedCoins.has(
                    coinId
                )
            ) {

                return;
            }


            const coin =
                document.getElementById(
                    coinId
                );


            if (!coin) {
                return;
            }


            const coinRect =
                coin.getBoundingClientRect();


            if (
                rectanglesOverlap(
                    playerRect,
                    coinRect
                )
            ) {

                collectCoin(
                    coinId
                );
            }

        }
    );
}


/* ============================================================
   RECTANGLE COLLISION
============================================================ */

function rectanglesOverlap(
    rect1,
    rect2
) {

    return (

        rect1.left <
        rect2.right &&

        rect1.right >
        rect2.left &&

        rect1.top <
        rect2.bottom &&

        rect1.bottom >
        rect2.top

    );
}


/* ============================================================
   COLLECT COIN
============================================================ */

function collectCoin(
    coinId
) {

    if (
        collectedCoins.has(
            coinId
        )
    ) {

        return;
    }


    const coin =
        document.getElementById(
            coinId
        );


    if (!coin) {
        return;
    }


    collectedCoins.add(
        coinId
    );


    coinsCollected++;


    // Coin reward
    score += 50;


    // Hide coin
    coin.style.display =
        "none";


    // Visual notification
    showNotification(
        "🪙 +50",
        "coin"
    );


    updateAllUI();


    updateMission();


    console.log(
        `Collected ${coinId}`
    );


    console.log(
        `Coins: ${coinsCollected}`
    );


    console.log(
        `Score: ${score}`
    );
}


/* ============================================================
   GOAL COLLISION
============================================================ */

function checkGoalCollision() {

    if (levelCompleted) {
        return;
    }


    const player =
        document.getElementById(
            "player"
        );


    const goal =
        document.getElementById(
            "goal"
        );


    if (
        !player ||
        !goal
    ) {

        return;
    }


    const playerRect =
        player.getBoundingClientRect();


    const goalRect =
        goal.getBoundingClientRect();


    if (
        rectanglesOverlap(
            playerRect,
            goalRect
        )
    ) {

        completeLevel();
    }
}


/* ============================================================
   COMPLETE LEVEL
============================================================ */

function completeLevel() {

    if (levelCompleted) {
        return;
    }


    levelCompleted =
        true;


    gameStarted =
        false;


    // Stop sensors
    if (
        watchId !== null
    ) {

        navigator.geolocation.clearWatch(
            watchId
        );

        watchId = null;
    }


    window.removeEventListener(
        "devicemotion",
        handleMotion,
        true
    );


    // Completion reward
    const completionBonus =
        100;


    score +=
        completionBonus;


    updateAllUI();


    // Update mission
    const mission =
        document.getElementById(
            "mission"
        );


    const missionProgress =
        document.getElementById(
            "missionProgress"
        );


    if (mission) {

        mission.textContent =
            "🎉 Level Complete!";
    }


    if (missionProgress) {

        missionProgress.textContent =
            `You reached the finish and earned +${completionBonus} bonus points!`;
    }


    updateStatus(
        "🎉 Level Complete! Great job!"
    );


    showNotification(
        `🏁 LEVEL COMPLETE! +${completionBonus}`,
        "level"
    );


    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.textContent =
            "🏆 Level Complete";
    }


    // Add visual completion effect
    const goal =
        document.getElementById(
            "goal"
        );


    if (goal) {

        goal.style.transform =
            "scale(1.3)";

        goal.style.filter =
            "drop-shadow(0 0 15px gold)";
    }


    console.log(
        "LEVEL COMPLETE"
    );


    console.log(
        "Final score:",
        score
    );
}


/* ============================================================
   MISSION
============================================================ */

function updateMission() {

    const mission =
        document.getElementById(
            "mission"
        );


    const missionProgress =
        document.getElementById(
            "missionProgress"
        );


    if (!missionProgress) {
        return;
    }


    if (levelCompleted) {

        if (mission) {

            mission.textContent =
                "🎉 Level Complete!";
        }

        missionProgress.textContent =
            "You completed the mission.";

        return;
    }


    const remaining =
        Math.max(
            0,
            missionDistance -
            walkingDistance
        );


    if (mission) {

        mission.textContent =
            "Reach the finish flag";
    }


    missionProgress.textContent =

        `Walk ${Math.ceil(remaining)} meters more to complete the level.`;
}


/* ============================================================
   UPDATE ALL UI
============================================================ */

function updateAllUI() {

    updateScore();

    updateSteps();

    updateDistance();

    updateWalkingDistance();

    updateGPSDistance();

    updateCoins();

    updateLevel();

    updateMission();
}


/* ============================================================
   SCORE
============================================================ */

function updateScore() {

    const element =
        document.getElementById(
            "score"
        );


    if (element) {

        element.textContent =
            score;
    }
}


/* ============================================================
   STEPS
============================================================ */

function updateSteps() {

    const element =
        document.getElementById(
            "steps"
        );


    if (element) {

        element.textContent =
            stepCount;
    }
}


/* ============================================================
   DISTANCE
============================================================ */

function updateDistance() {

    const element =
        document.getElementById(
            "distance"
        );


    if (element) {

        element.textContent =
            walkingDistance.toFixed(1);
    }
}


/* ============================================================
   WALKING DISTANCE
============================================================ */

function updateWalkingDistance() {

    const element =
        document.getElementById(
            "walkingDistance"
        );


    if (element) {

        element.textContent =
            walkingDistance.toFixed(1);
    }
}


/* ============================================================
   GPS DISTANCE
============================================================ */

function updateGPSDistance() {

    const element =
        document.getElementById(
            "gpsDistance"
        );


    if (element) {

        element.textContent =
            gpsDistance.toFixed(1);
    }
}


/* ============================================================
   COINS
============================================================ */

function updateCoins() {

    const element =
        document.getElementById(
            "coins"
        );


    if (element) {

        element.textContent =
            coinsCollected;
    }


    const extraElement =
        document.getElementById(
            "coinsCollected"
        );


    if (extraElement) {

        extraElement.textContent =
            coinsCollected;
    }
}


/* ============================================================
   LEVEL
============================================================ */

function updateLevel() {

    const element =
        document.getElementById(
            "level"
        );


    if (element) {

        element.textContent =
            currentLevel;
    }
}


/* ============================================================
   GPS
============================================================ */

function handleLocation(
    position
) {

    const latitude =
        position.coords.latitude;


    const longitude =
        position.coords.longitude;


    const accuracy =
        position.coords.accuracy;


    updateGPSAccuracy(
        accuracy
    );


    if (
        previousPosition === null
    ) {

        previousPosition = {

            latitude:
                latitude,

            longitude:
                longitude

        };


        return;
    }


    const distance =
        calculateDistance(

            previousPosition.latitude,

            previousPosition.longitude,

            latitude,

            longitude

        );


    previousPosition = {

        latitude:
            latitude,

        longitude:
            longitude

    };


    // Only accept reasonable GPS movement
    if (
        distance >= 3 &&
        distance <= 20
    ) {

        gpsDistance +=
            distance;


        updateGPSDistance();


        console.log(
            "GPS distance:",
            gpsDistance.toFixed(1),
            "m"
        );
    }
}


/* ============================================================
   HAVERSINE DISTANCE
============================================================ */

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R =
        6371000;


    const lat1Rad =
        lat1 *
        Math.PI /
        180;


    const lat2Rad =
        lat2 *
        Math.PI /
        180;


    const deltaLat =
        (
            lat2 - lat1
        ) *
        Math.PI /
        180;


    const deltaLon =
        (
            lon2 - lon1
        ) *
        Math.PI /
        180;


    const a =

        Math.sin(
            deltaLat / 2
        ) ** 2

        +

        Math.cos(
            lat1Rad
        )

        *

        Math.cos(
            lat2Rad
        )

        *

        Math.sin(
            deltaLon / 2
        ) ** 2;


    const c =

        2 *

        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(
                1 - a
            )

        );


    return R * c;
}


/* ============================================================
   GPS ACCURACY UI
============================================================ */

function updateGPSAccuracy(
    accuracy
) {

    const element =
        document.getElementById(
            "gpsAccuracy"
        );


    if (element) {

        element.textContent =
            `${accuracy.toFixed(1)} m`;
    }


    const dot =
        document.getElementById(
            "gpsDot"
        );


    if (!dot) {
        return;
    }


    if (accuracy <= 20) {

        dot.style.background =
            "#22c55e";

    }

    else if (accuracy <= 50) {

        dot.style.background =
            "#f59e0b";

    }

    else {

        dot.style.background =
            "#ef4444";
    }
}


/* ============================================================
   STATUS
============================================================ */

function updateStatus(
    message
) {

    const status =
        document.getElementById(
            "status"
        );


    if (status) {

        status.textContent =
            message;
    }
}


/* ============================================================
   NOTIFICATION
============================================================ */

function showNotification(
    message,
    type = "normal"
) {

    // Remove old notification
    const old =
        document.getElementById(
            "gameNotification"
        );


    if (old) {

        old.remove();
    }


    const notification =
        document.createElement(
            "div"
        );


    notification.id =
        "gameNotification";


    notification.textContent =
        message;


    notification.style.position =
        "fixed";


    notification.style.left =
        "50%";


    notification.style.top =
        "50%";


    notification.style.transform =
        "translate(-50%, -50%) scale(0.7)";


    notification.style.zIndex =
        "9999";


    notification.style.padding =
        "14px 22px";


    notification.style.borderRadius =
        "16px";


    notification.style.fontSize =
        "18px";


    notification.style.fontWeight =
        "800";


    notification.style.color =
        "#ffffff";


    notification.style.background =
        type === "level"
            ? "#1769aa"
            : "#d99b00";


    notification.style.boxShadow =
        "0 12px 35px rgba(0,0,0,0.25)";


    notification.style.opacity =
        "0";


    notification.style.transition =
        "all 0.25s ease";


    document.body.appendChild(
        notification
    );


    requestAnimationFrame(
        () => {

            notification.style.opacity =
                "1";

            notification.style.transform =
                "translate(-50%, -50%) scale(1)";
        }
    );


    setTimeout(
        () => {

            notification.style.opacity =
                "0";

            notification.style.transform =
                "translate(-50%, -50%) scale(0.8)";


            setTimeout(
                () => {

                    notification.remove();

                },
                250
            );

        },
        type === "level"
            ? 2500
            : 900
    );
}


/* ============================================================
   STOP GAME
============================================================ */

function stopGame() {

    if (
        watchId !== null
    ) {

        navigator.geolocation.clearWatch(
            watchId
        );

        watchId = null;
    }


    window.removeEventListener(
        "devicemotion",
        handleMotion,
        true
    );


    motionEnabled =
        false;


    gameStarted =
        false;


    updateStatus(
        "Game paused."
    );


    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.textContent =
            "🚶 Resume Walking";
    }


    console.log(
        "Game stopped."
    );
}


/* ============================================================
   RESET GAME
============================================================ */

function resetGame() {

    stopGame();


    // Reset player
    playerX =
        50;

    playerY =
        50;


    // Reset counters
    stepCount =
        0;

    walkingDistance =
        0;

    gpsDistance =
        0;

    score =
        0;

    coinsCollected =
        0;


    currentDirection =
        null;


    currentLevel =
        1;


    levelCompleted =
        false;


    previousPosition =
        null;


    collectedCoins.clear();


    // Reset accelerometer
    gravityX =
        0;

    gravityY =
        0;

    gravityZ =
        0;

    accelerationHistory =
        [];

    previousAcceleration =
        0;

    lastStepTime =
        0;

    stepArmed =
        true;


    // Show all coins again
    coins.forEach(
        coinId => {

            const coin =
                document.getElementById(
                    coinId
                );


            if (coin) {

                coin.style.display =
                    "flex";

                coin.style.opacity =
                    "1";
            }
        }
    );


    // Reset goal appearance
    const goal =
        document.getElementById(
            "goal"
        );


    if (goal) {

        goal.style.transform =
            "";

        goal.style.filter =
            "";
    }


    // Reset direction
    const direction =
        document.getElementById(
            "direction"
        );


    if (direction) {

        direction.textContent =
            "None";
    }


    // Reset button
    const startButton =
        document.getElementById(
            "startButton"
        );


    if (startButton) {

        startButton.textContent =
            "🚶 Start Walking";
    }


    updatePlayerPosition();

    updateAllUI();

    updateGPSAccuracy(
        999
    );


    updateStatus(
        "Game reset. Ready for a new journey."
    );


    console.log(
        "Game completely reset."
    );
}


/* ============================================================
   KEYBOARD CONTROLS
   Useful for desktop testing
============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "ArrowUp") {

            setDirection("up");
        }

        else if (
            event.key === "ArrowDown"
        ) {

            setDirection("down");
        }

        else if (
            event.key === "ArrowLeft"
        ) {

            setDirection("left");
        }

        else if (
            event.key === "ArrowRight"
        ) {

            setDirection("right");
        }

    }
);
