
self.onmessage = e => {
    const { numElements, arrayOfThings1Sab, arrayOfThings2Sab, resultArraySab } = e.data;

    const arrayOfThings1   = new Uint32Array(arrayOfThings1Sab); 
    const arrayOfThings2   = new Uint32Array(arrayOfThings2Sab); 
    const resultArray   = new Uint32Array(resultArraySab); 

    // console.log('Worker received data:', numElements, arrayOfThings1, arrayOfThings2, resultArray);


    const startTime = performance.now();
    
    for (let i = 0; i < numElements; i++) {   
        Atomics.store(resultArray, i, Atomics.load(arrayOfThings1, i) + Atomics.load(arrayOfThings2, i));
    }
    
    const endTime = performance.now();
    
    console.log(`Execution time when running in worker: ${endTime - startTime} ms`);
    // console.log(arrayOfThings1);
    // console.log(arrayOfThings2);
    // console.log(resultArray);
}