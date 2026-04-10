import { 
    PLAYER_STATE_ARRAY_INDEXES, 
    HEX_RADIUS,
    MAX_MOVABLES,
    NUM_EXTRA_BITS,
    MAP_HEIGHT,
    MAP_WIDTH
} from './constants.js';
import { 
    gridCoordsFromLocalMouse,
    convertCollisionBoxToLocalCoordinates,
    get1DCoordinateFromXYCoordinate
} from './helpers.js';
import { buildings } from './buildings.js';

const pauseButton = document.querySelector('#pauseButton');
const tempAddWoodcutterButton = document.querySelector('#tempAddWoodcutterButton');
const tempAddSawmillButton = document.querySelector('#tempAddSawmillButton');


// Set actual size in memory (scaled to account for extra pixel density).
const scale = window.devicePixelRatio; // Change to 1 on retina screens to see blurry canvas.

function fullScreenCanvas(elem) {
	// elem.width = window.innerWidth;
	// elem.height = window.innerHeight;
	
	// all of this is done to make it look good on mobile
	// var size = window.innerWidth;
	elem.style.width = window.innerWidth + "px";
	elem.style.height = window.innerHeight + "px";

	elem.width = Math.floor(window.innerWidth * scale);
	elem.height = Math.floor(window.innerHeight * scale);
	
}

function init() { 

    // for testing only, to be removed, allow users to set their index
    window.me = 1;

    const gameCanvas = document.querySelector('#gameCanvas');

    console.log(gameCanvas);

    fullScreenCanvas(gameCanvas);

    if (!gameCanvas.getContext) {                           
        alert('cant get the canvas context??');
        return;
    } 

    const canvasBoundingBbox  = gameCanvas.getBoundingClientRect();
    const gameCanvasOffscreen = gameCanvas.transferControlToOffscreen();

    const renderThread = new Worker('renderThread.js', { type: 'module' });
    const tickThread = new Worker('tick.js', { type: 'module' });

    function getRandomInt(max) {
    return Math.floor(Math.random() * max);
    }

    const playerStateSab   = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * (Math.max(...Object.values(PLAYER_STATE_ARRAY_INDEXES)) + 1));
    // using signed int 32 so you can navigate beyond the boundaries of the map
    const playStateArray   = new Int32Array(playerStateSab); 
    playStateArray[PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MAX] = window.innerWidth;
    playStateArray[PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MAX] = window.innerHeight;
    playStateArray[PLAYER_STATE_ARRAY_INDEXES.SELECTED_HOUSE_TYPE] = -1;

    const movablePositionsSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * (MAX_MOVABLES * 2 + NUM_EXTRA_BITS));
    const movablePositions = new Uint32Array(movablePositionsSab); 
    movablePositions.fill(0xFFFFFFFF);
    Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);

    // 0: paused
    // 1: Wallace position
    // 2: Josh position
    const gameStateSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * 3);
    const gameState = new Uint32Array(gameStateSab);
    Atomics.store(gameState, 0, 0);
    Atomics.store(gameState, 1, 21);
    Atomics.store(gameState, 2, 41);

    const terrainMapMaskSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * MAP_WIDTH * MAP_HEIGHT);
    const collisionsMapMaskSab = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * MAP_WIDTH * MAP_HEIGHT);
    const collisionsMapMask = new Uint8Array(collisionsMapMaskSab);
    collisionsMapMask.fill(0);

    tickThread.postMessage({
        movablePositionsSab,
        gameStateSab
    });

    renderThread.postMessage({
        gameCanvasOffscreen,
        playerStateSab,
        movablePositionsSab,
        terrainMapMaskSab,
        collisionsMapMaskSab,
        scale,
        widthVal  : window.innerWidth,
        heightVal : window.innerHeight,
    }, [gameCanvasOffscreen]);


    const scrollSpeed = 5;
    document.addEventListener('keydown', (e)=>{
        if (e.key == "ArrowDown") {
            Atomics.add(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MIN, scrollSpeed)
            Atomics.add(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MAX, scrollSpeed)           
        } else if (e.key == "ArrowUp") {
            Atomics.sub(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MIN, scrollSpeed)
            Atomics.sub(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MAX, scrollSpeed)
        } else if (e.key == "ArrowLeft") {
            Atomics.sub(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MIN, scrollSpeed)
            Atomics.sub(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MAX, scrollSpeed)
        } else if (e.key == "ArrowRight") {
            Atomics.add(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MIN, scrollSpeed)
            Atomics.add(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MAX, scrollSpeed)
        }
        // console.log(playStateArray)
    })

    gameCanvas.addEventListener('mousemove', (e)=>{
        Atomics.store(playStateArray, PLAYER_STATE_ARRAY_INDEXES.MOUSE_X, e.clientX);
        Atomics.store(playStateArray, PLAYER_STATE_ARRAY_INDEXES.MOUSE_Y, e.clientY);
    })

    gameCanvas.addEventListener('click', (e)=>{
        const leftLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MIN);
        const topLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MIN);

        let [y, x] = gridCoordsFromLocalMouse(e.clientX, e.clientY, leftLimit, topLimit, HEX_RADIUS)
        console.log(`${x}, ${y}`)
        
        const currentBuildingIdx = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.SELECTED_HOUSE_TYPE);
        if (currentBuildingIdx != -1) {
            const buildingHighlightedCells = convertCollisionBoxToLocalCoordinates(buildings[currentBuildingIdx].collisionBox, x, y)
            let allCellsAreValid = true;
            for (let i = 0; i < buildingHighlightedCells.length; i++) {
                const currentCell = buildingHighlightedCells[i];
                if (currentCell[0] < 0 || 
                    currentCell[0] > MAP_WIDTH || 
                    currentCell[1] < 0 || 
                    currentCell[1] > MAP_HEIGHT) {
                    allCellsAreValid = false;
                    break;
                }
                const current1DCoordinate = get1DCoordinateFromXYCoordinate(buildingHighlightedCells[i][0], buildingHighlightedCells[i][1], MAP_WIDTH);
                if (Atomics.load(collisionsMapMask, current1DCoordinate) == 1) {
                    allCellsAreValid = false;
                    break;
                }                
            }
            if (allCellsAreValid) {
                // add all cells to collision map mask
                for (let i = 0; i < buildingHighlightedCells.length; i++) {
                    // console.log(buildingHighlightedCells[i]);
                    const current1DCoordinate = get1DCoordinateFromXYCoordinate(buildingHighlightedCells[i][0], buildingHighlightedCells[i][1], MAP_WIDTH);
                    // console.log(current1DCoordinate);
                    Atomics.store(collisionsMapMask, current1DCoordinate, 1);
                }
                console.log(collisionsMapMask);
            }

            Atomics.store(playStateArray, PLAYER_STATE_ARRAY_INDEXES.SELECTED_HOUSE_TYPE, -1);
        } else {
            // for debugging purposes only, to be removed later
            Atomics.store(gameState, window.me, get1DCoordinateFromXYCoordinate(x, y, MAP_WIDTH));
            console.log(gameState);
        }

    })

    // const startTime = performance.now();

    // for (let i = 0; i < arrayOfThings1.length; i++) {
    //     resultArray[i]  = arrayOfThings1[i] + arrayOfThings2[i];
    // }

    // const endTime = performance.now();

    // console.log(`Execution time when running in main thread: ${endTime - startTime} ms`);
    // console.log(arrayOfThings1);
    // console.log(arrayOfThings2);
    // console.log(resultArray);

    pauseButton.addEventListener('click', ()=>{
        console.log('clicked pause')
        if (Atomics.load(gameState, 0) == 0) {
            console.log('pausing game')
            Atomics.store(gameState, 0, 1);
            pauseButton.textContent = '>';
        } else {
            console.log('unpausing game')
            Atomics.store(gameState, 0, 0);
            pauseButton.textContent = '||';
        }
    })

    tempAddWoodcutterButton.addEventListener('click', ()=>{
        console.log('clicked tempAddWoodcutterButton');
        Atomics.store(playStateArray, PLAYER_STATE_ARRAY_INDEXES.SELECTED_HOUSE_TYPE, 0);
    })

    tempAddSawmillButton.addEventListener('click', ()=>{
        console.log(`clicked tempAddSawmillButton`);
        Atomics.store(playStateArray, PLAYER_STATE_ARRAY_INDEXES.SELECTED_HOUSE_TYPE, 1);
    })
}

document.addEventListener("DOMContentLoaded", init);