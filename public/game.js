import { 
    CAMERA_X_MIN, 
    CAMERA_Y_MIN, 
    CAMERA_X_MAX, 
    CAMERA_Y_MAX, 
    MOUSE_X, 
    MOUSE_Y, 
    HEX_RADIUS,
    MAX_MOVABLES,
    NUM_EXTRA_BITS
} from './constants.js';
import { gridCoordsFromLocalMouse } from './helpers.js';

let pauseButton = document.querySelector('#pauseButton');
let tempAddBuildingButton = document.querySelector('#tempAddBuildingButton');


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

    const numBoundingCoordinates = 6;
    const boundingCoordinatesSab   = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * numBoundingCoordinates);
    // using signed int 32 so you can navigate beyond the boundaries of the map
    const boundingCoordinatesArray   = new Int32Array(boundingCoordinatesSab); 
    boundingCoordinatesArray[CAMERA_X_MAX] = window.innerWidth;
    boundingCoordinatesArray[CAMERA_Y_MAX] = window.innerHeight;

    const movablePositionsSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * (MAX_MOVABLES * 2 + NUM_EXTRA_BITS));
    const movablePositions = new Uint32Array(movablePositionsSab); 
    movablePositions.fill(0xFFFFFFFF);
    Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);

    const gameStateSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * 1);
    const gameState = new Uint32Array(gameStateSab);
    Atomics.store(gameState, 0, 0);

    tickThread.postMessage({
        movablePositionsSab,
        gameStateSab
    });

    renderThread.postMessage({
        gameCanvasOffscreen,
        boundingCoordinatesSab,
        movablePositionsSab,
        scale,
        widthVal  : window.innerWidth,
        heightVal : window.innerHeight,
    }, [gameCanvasOffscreen]);


    const scrollSpeed = 5;
    document.addEventListener('keydown', (e)=>{
        if (e.key == "ArrowDown") {
            Atomics.add(boundingCoordinatesArray, CAMERA_Y_MIN, scrollSpeed)
            Atomics.add(boundingCoordinatesArray, CAMERA_Y_MAX, scrollSpeed)           
        } else if (e.key == "ArrowUp") {
            Atomics.sub(boundingCoordinatesArray, CAMERA_Y_MIN, scrollSpeed)
            Atomics.sub(boundingCoordinatesArray, CAMERA_Y_MAX, scrollSpeed)
        } else if (e.key == "ArrowLeft") {
            Atomics.sub(boundingCoordinatesArray, CAMERA_X_MIN, scrollSpeed)
            Atomics.sub(boundingCoordinatesArray, CAMERA_X_MAX, scrollSpeed)
        } else if (e.key == "ArrowRight") {
            Atomics.add(boundingCoordinatesArray, CAMERA_X_MIN, scrollSpeed)
            Atomics.add(boundingCoordinatesArray, CAMERA_X_MAX, scrollSpeed)
        }
        // console.log(boundingCoordinatesArray)
    })

    gameCanvas.addEventListener('mousemove', (e)=>{
        Atomics.store(boundingCoordinatesArray, MOUSE_X, e.clientX);
        Atomics.store(boundingCoordinatesArray, MOUSE_Y, e.clientY);
    })

    gameCanvas.addEventListener('click', (e)=>{
        const leftLimit = Atomics.load(boundingCoordinatesArray, CAMERA_X_MIN);
        const topLimit = Atomics.load(boundingCoordinatesArray, CAMERA_Y_MIN);

        let [y, x] = gridCoordsFromLocalMouse(e.clientX, e.clientY, leftLimit, topLimit, HEX_RADIUS)
        console.log(`${x}, ${y}`)
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

    tempAddBuildingButton.addEventListener('click', ()=>{
        console.log('clicked tempAddBuildingButton')
    })
}

document.addEventListener("DOMContentLoaded", init);