// ============================================================
// WALKING GAME
// GPS + ACCELEROMETER STEP DETECTION
// ============================================================


// ============================================================
// GAME STATE
// ============================================================

let currentDirection = null;

let gameStarted = false;

let watchId = null;


// ============================================================
// WALKING / STEP STATE
// ============================================================

// Total detected steps
let stepCount = 0;

// Distance calculated from steps
let walkingDistance = 0;

// Approximate average stride length
// Change this later according to your testing.
const STEP_LENGTH = 0.70;


// ============================================================
// GPS STATE
// ============================================================

let previousPosition = null;

let gpsDistance = 0;


// ============================================================
// PLAYER POSITION
// ============================================================

let playerX = 50;
let playerY = 50;


// ============================================================
// MOVEMENT SETTINGS
// ============================================================

// Game pixels per real-world metre
const PIXELS_PER_METER = 3;


// ============================================================
// GPS SETTINGS
// ============================================================

// GPS is now mainly used for monitoring.
// We don't use GPS distance for player movement,
// because that would double-count movement detected
// by the step counter.

const MAX_GPS_ACCURACY = 200;


// ============================================================
// STEP DETECTION SETTINGS
// ============================================================

// Minimum time between two detected steps.
// Prevents one foot movement from being counted
// multiple times.

const MIN_STEP_INTERVAL = 300;


// Acceleration threshold.
//
// This may need adjustment depending on your phone.
//
// Lower = easier to trigger
// Higher = harder to trigger

const STEP_THRESHOLD = 1.25;


// How many acceleration samples we keep
// for smoothing.

const SMOOTHING_SAMPLES = 5;


// ============================================================
// ACCELEROMETER STATE
// ============================================================

let gravityX = 0;
let gravityY = 0;
let gravityZ = 0;

const GRAVITY_ALPHA = 0.8;


// Smoothed acceleration magnitude
let accelerationHistory = [];


// Last detected step timestamp
let lastStepTime = 0;


// Used to detect a peak
let previousAcceleration = 0;


// Prevent repeated step detection during
// the same movement cycle.

let stepArmed = true;


// ============================================================
// MOTION PERMISSION STATE
// ============================================================

let motionEnabled = false;


// ============================================================
// DIRECTION
// ============================================================

function setDirection(direction) {

    currentDirection = direction;

    const directionElement =
        document.getElementById("direction");

    if (directionElement) {

        directionElement.textContent =
            direction.toUpperCase();
    }

    console.log(
        "Direction selected:",
        direction
    );
}


// ============================================================
// START GAME
// ============================================================

async function startGame() {

    if (gameStarted) {

        console.log(
            "Game is already running."
        );

        return;
    }


    // --------------------------------------------------------
    // Check GPS support
    // --------------------------------------------------------

    if (!navigator.geolocation) {

        updateStatus(
            "GPS is not supported by this browser."
        );

        return;
    }


    gameStarted = true;


    updateStatus(
        "Starting GPS and step counter..."
    );


    console.log(
        "Starting walking game..."
    );


    // --------------------------------------------------------
    // Start motion sensor
    // --------------------------------------------------------

    await enableMotionTracking();


    // --------------------------------------------------------
    // Start GPS
    // --------------------------------------------------------

    console.log(
        "Starting GPS..."
    );


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


    updateStatus(
        "Game running. Select a direction and walk."
    );
}


// ============================================================
// ENABLE MOTION TRACKING
// ============================================================

async function enableMotionTracking() {

    if (!window.DeviceMotionEvent) {

        console.warn(
            "DeviceMotionEvent is not supported."
        );

        updateStatus(
            "Motion sensor is not supported. GPS only."
        );

        return;
    }


    // --------------------------------------------------------
    // Some browsers require explicit permission.
    // --------------------------------------------------------

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

        } catch (error) {

            console.error(
                "Motion permission error:",
                error
            );

            return;
        }
    }


    // --------------------------------------------------------
    // Add accelerometer listener
    // --------------------------------------------------------

    window.addEventListener(
        "devicemotion",
        handleMotion,
        true
    );


    motionEnabled = true;


    console.log(
        "Accelerometer enabled."
    );
}


// ============================================================
// HANDLE ACCELEROMETER DATA
// ============================================================

function handleMotion(event) {

    if (!gameStarted) {
        return;
    }


    const acceleration =
        event.accelerationIncludingGravity;


    if (!acceleration) {
        return;
    }


    let x =
        acceleration.x || 0;

    let y =
        acceleration.y || 0;

    let z =
        acceleration.z || 0;


    // --------------------------------------------------------
    // Remove gravity
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // Calculate acceleration magnitude
    // --------------------------------------------------------

    const magnitude =

        Math.sqrt(

            linearX * linearX +

            linearY * linearY +

            linearZ * linearZ

        );


    // --------------------------------------------------------
    // Smooth the signal
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // STEP DETECTION
    // --------------------------------------------------------

    detectStep(average);
}


// ============================================================
// DETECT STEP
// ============================================================

function detectStep(acceleration) {

    const now =
        Date.now();


    // --------------------------------------------------------
    // Detect rising acceleration peak
    // --------------------------------------------------------

    const rising =
        acceleration >
        previousAcceleration;


    const aboveThreshold =
        acceleration >
        STEP_THRESHOLD;


    // --------------------------------------------------------
    // Detect step
    // --------------------------------------------------------

    if (

        rising &&

        aboveThreshold &&

        stepArmed &&

        (
            now - lastStepTime
        ) >
        MIN_STEP_INTERVAL

    ) {

        registerStep();

        lastStepTime = now;

        stepArmed = false;
    }


    // --------------------------------------------------------
    // Re-arm after acceleration drops
    // --------------------------------------------------------

    if (
        acceleration <
        STEP_THRESHOLD * 0.5
    ) {

        stepArmed = true;
    }


    previousAcceleration =
        acceleration;
}


// ============================================================
// REGISTER STEP
// ============================================================

function registerStep() {

    if (!gameStarted) {
        return;
    }


    stepCount++;


    // --------------------------------------------------------
    // Calculate walking distance
    // --------------------------------------------------------

    walkingDistance =
        stepCount * STEP_LENGTH;


    // --------------------------------------------------------
    // Update UI
    // --------------------------------------------------------

    updateStepDisplay();

    updateDistance();


    console.log(
        "STEP:",
        stepCount,
        "| Walking distance:",
        walkingDistance.toFixed(2),
        "m"
    );


    // --------------------------------------------------------
    // Move character
    // --------------------------------------------------------

    moveCharacter(STEP_LENGTH);
}


// ============================================================
// MOVE CHARACTER
// ============================================================

function moveCharacter(distance) {

    // Player cannot move without selecting
    // a direction.

    if (currentDirection === null) {

        console.log(
            "Step detected but no direction selected."
        );

        return;
    }


    // --------------------------------------------------------
    // Convert real-world metres
    // into game movement.
    // --------------------------------------------------------

    const movement =
        distance * PIXELS_PER_METER;


    console.log(
        "Game movement:",
        movement.toFixed(2),
        "pixels"
    );


    // --------------------------------------------------------
    // RIGHT
    // --------------------------------------------------------

    if (currentDirection === "right") {

        playerX += movement;
    }


    // --------------------------------------------------------
    // LEFT
    // --------------------------------------------------------

    else if (currentDirection === "left") {

        playerX -= movement;
    }


    // --------------------------------------------------------
    // UP
    // --------------------------------------------------------

    else if (currentDirection === "up") {

        playerY -= movement;
    }


    // --------------------------------------------------------
    // DOWN
    // --------------------------------------------------------

    else if (currentDirection === "down") {

        playerY += movement;
    }


    // --------------------------------------------------------
    // Keep player inside game area
    // --------------------------------------------------------

    playerX =
        Math.max(
            0,
            Math.min(100, playerX)
        );


    playerY =
        Math.max(
            0,
            Math.min(100, playerY)
        );


    updatePlayerPosition();
}


// ============================================================
// GPS LOCATION
// ============================================================

function handleLocation(position) {

    const latitude =
        position.coords.latitude;

    const longitude =
        position.coords.longitude;

    const accuracy =
        position.coords.accuracy;


    console.log(
        "--------------------------------"
    );

    console.log(
        "Latitude:",
        latitude
    );

    console.log(
        "Longitude:",
        longitude
    );

    console.log(
        "GPS Accuracy:",
        accuracy
    );


    // --------------------------------------------------------
    // Update GPS status
    // --------------------------------------------------------

    updateGPSDisplay(accuracy);


    // --------------------------------------------------------
    // Very poor GPS
    // --------------------------------------------------------

    if (
        accuracy >
        MAX_GPS_ACCURACY
    ) {

        console.warn(
            "Poor GPS accuracy:",
            accuracy.toFixed(1),
            "m"
        );
    }


    // --------------------------------------------------------
    // First GPS reading
    // --------------------------------------------------------

    if (previousPosition === null) {

        previousPosition = {

            latitude:
                latitude,

            longitude:
                longitude

        };


        console.log(
            "Initial GPS position stored."
        );


        return;
    }


    // --------------------------------------------------------
    // Calculate GPS distance
    // --------------------------------------------------------

    const distance =
        calculateDistance(

            previousPosition.latitude,

            previousPosition.longitude,

            latitude,

            longitude

        );


    console.log(
        "Raw GPS movement:",
        distance.toFixed(2),
        "m"
    );


    previousPosition = {

        latitude:
            latitude,

        longitude:
            longitude

    };


    // --------------------------------------------------------
    // Only store reasonable GPS movement.
    //
    // IMPORTANT:
    // This does NOT move the player.
    // Steps are responsible for movement.
    // --------------------------------------------------------

    if (
        distance >= 3 &&
        distance <= 20
    ) {

        gpsDistance += distance;

        console.log(
            "GPS movement accepted:",
            distance.toFixed(2),
            "m"
        );

    } else {

        console.log(
            "GPS movement ignored for movement."
        );
    }
}


// ============================================================
// HAVERSINE DISTANCE
// ============================================================

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;


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
        ) *
        Math.sin(
            deltaLat / 2
        )

        +

        Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *

        Math.sin(
            deltaLon / 2
        ) *
        Math.sin(
            deltaLon / 2
        );


    const c =

        2 *

        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(1 - a)

        );


    return R * c;
}


// ============================================================
// UPDATE PLAYER POSITION
// ============================================================

function updatePlayerPosition() {

    const player =
        document.getElementById(
            "player"
        );


    if (!player) {

        console.error(
            "Player element not found."
        );

        return;
    }


    player.style.left =
        `${playerX}%`;

    player.style.bottom =
        `${playerY}%`;
}


// ============================================================
// UPDATE DISTANCE DISPLAY
// ============================================================

function updateDistance() {

    const distanceElement =
        document.getElementById(
            "distance"
        );


    if (!distanceElement) {
        return;
    }


    distanceElement.textContent =
        walkingDistance.toFixed(1);
}


// ============================================================
// UPDATE STEP DISPLAY
// ============================================================

function updateStepDisplay() {

    const stepElement =
        document.getElementById(
            "steps"
        );


    if (!stepElement) {
        return;
    }


    stepElement.textContent =
        stepCount;
}


// ============================================================
// UPDATE GPS DISPLAY
// ============================================================

function updateGPSDisplay(
    accuracy
) {

    const gpsElement =
        document.getElementById(
            "gpsAccuracy"
        );


    if (!gpsElement) {
        return;
    }


    gpsElement.textContent =
        `${accuracy.toFixed(1)} m`;
}


// ============================================================
// UPDATE STATUS
// ============================================================

function updateStatus(
    message
) {

    const statusElement =
        document.getElementById(
            "status"
        );


    if (statusElement) {

        statusElement.textContent =
            message;
    }
}


// ============================================================
// GPS ERROR HANDLER
// ============================================================

function handleLocationError(
    error
) {

    console.error(
        "Geolocation error:",
        error
    );


    let message =
        "Unable to get your location.";


    switch (error.code) {

        case error.PERMISSION_DENIED:

            message =
                "Location permission was denied.";

            break;


        case error.POSITION_UNAVAILABLE:

            message =
                "GPS position is unavailable.";

            break;


        case error.TIMEOUT:

            message =
                "GPS request timed out. Waiting for another fix...";

            break;


        default:

            message =
                "Unknown GPS error.";

            break;
    }


    updateStatus(
        message
    );
}


// ============================================================
// STOP GAME
// ============================================================

function stopGame() {

    // --------------------------------------------------------
    // Stop GPS
    // --------------------------------------------------------

    if (
        watchId !== null
    ) {

        navigator.geolocation.clearWatch(
            watchId
        );

        watchId = null;
    }


    // --------------------------------------------------------
    // Stop accelerometer
    // --------------------------------------------------------

    window.removeEventListener(
        "devicemotion",
        handleMotion,
        true
    );


    motionEnabled = false;

    gameStarted = false;


    updateStatus(
        "Game stopped."
    );


    console.log(
        "Walking game stopped."
    );
}


// ============================================================
// RESET GAME
// ============================================================

function resetGame() {

    // --------------------------------------------------------
    // Stop sensors
    // --------------------------------------------------------

    stopGame();


    // --------------------------------------------------------
    // Reset step counter
    // --------------------------------------------------------

    stepCount = 0;


    // --------------------------------------------------------
    // Reset walking distance
    // --------------------------------------------------------

    walkingDistance = 0;


    // --------------------------------------------------------
    // Reset GPS distance
    // --------------------------------------------------------

    gpsDistance = 0;


    // --------------------------------------------------------
    // Reset GPS reference
    // --------------------------------------------------------

    previousPosition = null;


    // --------------------------------------------------------
    // Reset player
    // --------------------------------------------------------

    playerX = 50;

    playerY = 50;


    // --------------------------------------------------------
    // Reset direction
    // --------------------------------------------------------

    currentDirection = null;


    // --------------------------------------------------------
    // Reset accelerometer
    // --------------------------------------------------------

    gravityX = 0;

    gravityY = 0;

    gravityZ = 0;

    accelerationHistory = [];

    previousAcceleration = 0;

    lastStepTime = 0;

    stepArmed = true;


    // --------------------------------------------------------
    // Update UI
    // --------------------------------------------------------

    updateStepDisplay();

    updateDistance();

    updatePlayerPosition();


    const directionElement =
        document.getElementById(
            "direction"
        );


    if (directionElement) {

        directionElement.textContent =
            "None";
    }


    const gpsElement =
        document.getElementById(
            "gpsAccuracy"
        );


    if (gpsElement) {

        gpsElement.textContent =
            "--";
    }


    updateStatus(
        "Game reset. Ready to start."
    );


    console.log(
        "Game reset."
    );
}