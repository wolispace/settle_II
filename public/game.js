

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
        scale,
        widthVal  : window.innerWidth,
        heightVal : window.innerHeight,
    }, [gameCanvasOffscreen]);




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