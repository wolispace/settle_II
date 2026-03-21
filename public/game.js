

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

    const renderThread = new Worker('renderThread.js');
    const logicThread = new Worker('gameLogic.js');

    function getRandomInt(max) {
    return Math.floor(Math.random() * max);
    }

    const CAMERA_X_MIN = 0;
    const CAMERA_Y_MIN = 1;
    const CAMERA_X_MAX = 2;
    const CAMERA_Y_MAX = 3;
    const MOUSE_X      = 4;
    const MOUSE_Y      = 5;
    const numBoundingCoordinates = 6;
    const boundingCoordinatesSab   = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * numBoundingCoordinates);
    // using signed int 32 so you can navigate beyond the boundaries of the map
    const boundingCoordinatesArray   = new Int32Array(boundingCoordinatesSab); 
    boundingCoordinatesArray[CAMERA_X_MAX] = window.innerWidth;
    boundingCoordinatesArray[CAMERA_Y_MAX] = window.innerHeight;

    const numElements = 1_000_000;
    const arrayOfThings1Sab   = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * numElements);
    const arrayOfThings2Sab   = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * numElements);
    const resultArraySab   = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * numElements);
    const arrayOfThings1   = new Uint32Array(arrayOfThings1Sab); 
    const arrayOfThings2   = new Uint32Array(arrayOfThings2Sab); 
    const resultArray   = new Uint32Array(resultArraySab); 

    for (let i = 0; i < numElements; i++) {
        Atomics.store(arrayOfThings1, i, getRandomInt(10_000));
        Atomics.store(arrayOfThings2, i, getRandomInt(10_000));
    }

    // console.log(arrayOfThings1Sab);
    // console.log(arrayOfThings1);
    // console.log(arrayOfThings2);
    // console.log(resultArray);

    // console.log(logicThread);
    logicThread.postMessage({
        numElements,
        arrayOfThings1Sab,
        arrayOfThings2Sab,
        resultArraySab
    });

    renderThread.postMessage({
        gameCanvasOffscreen,
        boundingCoordinatesSab,
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

    document.addEventListener('mousemove', (e)=>{
        Atomics.store(boundingCoordinatesArray, MOUSE_X, e.clientX);
        Atomics.store(boundingCoordinatesArray, MOUSE_Y, e.clientY);
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
}

document.addEventListener("DOMContentLoaded", init);