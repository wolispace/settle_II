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




// const startTime = performance.now();

// for (let i = 0; i < arrayOfThings1.length; i++) {
//     resultArray[i]  = arrayOfThings1[i] + arrayOfThings2[i];
// }

// const endTime = performance.now();

// console.log(`Execution time when running in main thread: ${endTime - startTime} ms`);
// console.log(arrayOfThings1);
// console.log(arrayOfThings2);
// console.log(resultArray);