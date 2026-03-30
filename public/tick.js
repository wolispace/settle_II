import { 
    MAX_MOVABLES,
    NUM_EXTRA_BITS
} from './constants.js';


class Movable {
    path;
    index = 0;

    constructor(path) {
        this.path = path;
        // this.path = new Int32Array(new ArrayBuffer(6 * 2));
    }
}


self.onmessage = e => {
    const { movablePositionsSab } = e.data;

    const movablePositions   = new Uint32Array(movablePositionsSab); 
// NORTH_EAST	0	−1
// EAST	    +1	0
// SOUTH_EAST	+1	+1
// SOUTH_WEST	0	+1
// WEST	    −1	0
// NORTH_WEST	−1	−1
    
    // let dummyVillager = new Movable([5,3,5,2,4,2,3,2,2,2,2,1]);
    // let dummyVillager2 = new Movable([10,1,9,1,8,1]);
    // let movables = [dummyVillager2, dummyVillager];

    let movables = [];
    let numPeople = 20_000;
    let testRange = 1000;
    let pathLength = 100;
    for (let i = 0; i < numPeople; i++) {
        let path = [Math.floor(Math.random()*testRange), Math.floor(Math.random()*testRange)]
        // console.log("========")
        // console.log(`Starting at: ${path[0], path[1]}`)
        for (let i = 0; i < pathLength; i++) {
            // console.log(i);
            let offset = Math.random();
            if (offset > 0.5) {
                offset = 1;
            } else {
                offset = -1;
            }
            if (Math.random() > 0.5) {
                // console.log(`setting ${i*2+2} = ${path[i*2]}`)

                path[i*2+2] = Math.max(path[i*2] + offset, 0);
                path[i*2+2+1] = path[i*2+1]
            } else {
                path[i*2+2] = path[i*2] 
                path[i*2+2+1] = Math.max(path[i*2+1] + offset, 0);
            }
        }
        movables.push(new Movable(path));
    }
    // console.log(movables);

    function tick(params) {
        // console.log('---tick---')
        const startTime = performance.now();

        while (Atomics.load(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1) !== 0) {
            // console.log("tick waiting for render to be ready");
        }

        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 1);
        for (let i = 0; i < movables.length; i++) {
            
            if (movables[i].index >= movables[i].path.length) {
                continue;
            } 

            movablePositions[i*2] = movables[i].path[movables[i].index];
            movablePositions[i*2+1] = movables[i].path[movables[i].index + 1];
            movables[i].index+=2;
        }
        // atomic commands act as a memory fence around non-sequential commands (which are faster)
        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);
        const endTime = performance.now();
        console.log(`Tick duration: ${endTime - startTime} ms`);
    }

    tick();
    let refVar = setInterval(tick, 500);


    // 
    
    // for (let i = 0; i < numElements; i++) {   
    //     Atomics.store(resultArray, i, Atomics.load(arrayOfThings1, i) + Atomics.load(arrayOfThings2, i));
    // }
    
    // const endTime = performance.now();
    
    // console.log(`Execution time when running in worker: ${endTime - startTime} ms`);
    // console.log(arrayOfThings1);
    // console.log(arrayOfThings2);
    // console.log(resultArray);
}