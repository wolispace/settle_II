import { 
    MAX_MOVABLES,
    NUM_EXTRA_BITS,
    MAX_SCHEDULE_DURATION_MS,
    TICK_PERIOD_MS,
    MAP_WIDTH,
    MAP_HEIGHT,
    DIRECTIONS
} from './constants.js';
import helpers from './helpers.js';

class Movable {
    path;
    index = 0;

    constructor(path) {
        this.path = path;
        // this.path = new Int32Array(new ArrayBuffer(6 * 2));
    }

    get targetPosition() {
        // this feels messy, could be updated to be more dynamic in case the path array structure changes
        return [this.path[this.path.length - 2] , this.path[this.path.length - 1]];
    }
}

class Task {
    todo;
    rescheduleDurationInTicks;
    
    constructor(todo, rescheduleDurationInMs) {
        this.todo = todo;
        if (rescheduleDurationInMs >= MAX_SCHEDULE_DURATION_MS) {
            throw new Error(`Can't add a rescheduleDurationInMs (${rescheduleDurationInMs}) longer than ${MAX_SCHEDULE_DURATION_MS}`);   
        }
        this.rescheduleDurationInTicks = rescheduleDurationInMs/TICK_PERIOD_MS;
    }
}

// class ListMinBucketQueue {
//     buckets = [];
//     handles = []

//     constructor(maxNumberOfIds) {
//         buckets = new Array(4);
//     }
// }


// find distance between two points
function getHeuristicCost(sx, sy, tx, ty) {
		const dx = (tx - sx);
		const dy = (ty - sy);
		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		if (dx * dy > 0) { // dx and dy go in the same direction
			if (absDx > absDy) {
				return absDx;
			} else {
				return absDy;
			}
		} else {
			return absDx + absDy;
		}
	}


self.onmessage = e => {
    const { movablePositionsSab, gameStateSab, collisionsMapMaskSab } = e.data;

    const movablePositions   = new Uint32Array(movablePositionsSab); 
    const gameState = new Uint32Array(gameStateSab);
    const collisionsMapMask = new Uint8Array(collisionsMapMaskSab);


    function doAStar(movable, targetX, targetY) {
        console.log(`Doing A* towards ${targetX}, ${targetY}`);
        if (helpers.xyCellOutOfBounds(targetX, targetY, MAP_WIDTH, MAP_HEIGHT)) {
            console.error(`Target is out of bounds`)
            return null;
        }


        const targetFlatIdx = helpers.get1DCoordinateFromXYCoordinate(targetX, targetY, MAP_WIDTH);
        console.log(targetFlatIdx);
        // check if target is reachable
        if (collisionsMapMask[targetFlatIdx] > 0) {
            console.error(`Collision, can't walk into a collision`)
            return null;
        }  

        const startFlatIdx =  helpers.get1DCoordinateFromXYCoordinate(movable.path[movable.index], movable.path[movable.index + 1], MAP_WIDTH);

        // in the 2015 code they had these permanently stored as 
        // global variables shared for each A* for efficiency they're not creating/deleteing arrays all the time
        const closedBitSet = new Array(MAP_WIDTH * MAP_HEIGHT);
        const openBitSet = new Array(MAP_WIDTH * MAP_HEIGHT);

        // this is our four buckets (a ListMinBucketQueue), need to implement
        // let open = [[],[],[],[]];

        let found = false;
        let depthParentHeap = new Array(MAP_WIDTH * MAP_HEIGHT * 2);
        depthParentHeap[startFlatIdx * 2]     =  0; // num steps from start
        depthParentHeap[startFlatIdx * 2 + 1] = -1; // previous cell was non-existant

        let costs = new Array(MAP_WIDTH * MAP_HEIGHT);
        costs[startFlatIdx] = 0;

        // open.insert(startFlatIdx, getHeuristicCost(startX, startY, targetX, targetY));
        openBitSet[startFlatIdx] = 1;

        let openIsEmpty = false;
        // open
        while (!openIsEmpty) {
            let currentFlatIdx = 0 //open.deleteMin();

            const {x,y} = helpers.getXYCoordinateFrom1DCoordinate(currentFlatIdx, MAP_WIDTH);
            closedBitSet[currentFlatIdx] = 1;

            if (targetFlatIdx == currentFlatIdx) {
                found = true;
                break;
            }

            let currentPositionCosts = costs[currentFlatIdx];

            // could be optimised to a regular for loop?
            for (const [key, value] of Object.entries(DIRECTIONS)) {
                const neighbourX = x + value[0];
                const neighbourY = y + value[1];

                if (helpers.xyCellOutOfBounds(neighbourX, neighbourY, MAP_WIDTH, MAP_HEIGHT)) {
                    continue;
                }

                const neighbourFlatIdx =  helpers.get1DCoordinateFromXYCoordinate(neighbourX, neighbourY, MAP_WIDTH);
                // we've already searched this cell and don't want to search it again
                if (closedBitSet[neighbourFlatIdx] == 1) {
                    continue;
                }

                const newCosts = currentPositionCosts //+ Map.getCost();

                // ideally could be re-written so that you've got an early exit in the case when newcosts is not larger than oldCosts
                // because the logic when you're updating values is mostly the same in both branches of this "if"
                if (openBitSet[neighbourFlatIdx]) {
                    // we've already seen this cell so check if this is a shorter path to it
                    const oldCosts = costs[neighbourFlatIdx];

                    if (newCosts < oldCosts) {
                        costs[neighbourFlatIdx] = newCosts;
                        // current depth is 1 larger than previous cell
                        depthParentHeap[neighbourFlatIdx * 2    ] = depthParentHeap[currentFlatIdx * 2] + 1;
                        // link to previous cell, saying "this is where I came from"
                        depthParentHeap[neighbourFlatIdx * 2 + 1] = currentFlatIdx;

                        // find distance between neighbour and target position
                        const heuristicCosts = getHeuristicCost(neighbourX, neighbourY, targetX, targetY);
                        // open.increasedPriority(neighbourFlatIdx, oldCosts + heuristicCosts, newCosts + heuristicCosts)
                    }

                } else {
                    // we haven't seen this cell already, so fill in its values as default
                    costs[neighbourFlatIdx] = newCosts;
                    // current depth is 1 larger than previous cell
                    depthParentHeap[neighbourFlatIdx * 2    ] = depthParentHeap[currentFlatIdx * 2] + 1;
                    // link to previous cell, saying "this is where I came from"
                    depthParentHeap[neighbourFlatIdx * 2 + 1] = currentFlatIdx;

                    openBitSet[neighbourFlatIdx] = 1;

                    // find distance between neighbour and target position
                    const heuristicCosts = getHeuristicCost(neighbourX, neighbourY, targetX, targetY);
                    // open.insert(neighbourFlatIdx, newCosts + heuristicCosts)

                    // Map.markAsOpen();
                }

            }
            
            openIsEmpty = true;
        }

        if (found) {
            const pathLength = depthParentHeap[targetFlatIdx * 2];
            let path = [];

            let idx = pathLength;
            let currentFlatIdx = targetFlatIdx;

            while (idx > 0) {
                idx--;
                const {x,y} = helpers.getXYCoordinateFrom1DCoordinate(currentFlatIdx, MAP_WIDTH);
                path[idx * 2] = x;
                path[idx * 2 + 1] = y;
                currentFlatIdx = depthParentHeap[currentFlatIdx * 2 + 1];
            }

            movable.path = path;
            return movable; 
        } 
        return null;

    }
    
    // let dummyVillager = new Movable([5,3,5,2,4,2,3,2,2,2,2,1]);
    // let dummyVillager2 = new Movable([10,1,9,1,8,1]);
    // let movables = [dummyVillager2, dummyVillager];

    const moveAllMovablesTask = new Task((i)=>{
        // console.log(`it's time to move all movables`)

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
    }, 750);

    const totalTicks = MAX_SCHEDULE_DURATION_MS/TICK_PERIOD_MS;
    const tasks = new Array(totalTicks);
    tasks[0] = [moveAllMovablesTask];
    let taskPointer = 0;

    let movables = [new Movable([0,0])];
    movables.push(new Movable([5,1, 4,1, 3,1, 2,1, 1,1]));
    movables.push(new Movable([5,2, 4,2, 3,2, 2,2, 1,2]));
   

    //#region - add 20_000 people and have them wander randomly
    
    // let numPeople = 20_000;
    // let testRange = 1000;
    // let pathLength = 100;
    // for (let i = 0; i < numPeople; i++) {
    //     let path = [Math.floor(Math.random()*testRange), Math.floor(Math.random()*testRange)]
    //     // console.log("========")
    //     // console.log(`Starting at: ${path[0], path[1]}`)
    //     for (let i = 0; i < pathLength; i++) {
    //         // console.log(i);
    //         let offset = Math.random();
    //         if (offset > 0.5) {
    //             offset = 1;
    //         } else {
    //             offset = -1;
    //         }
    //         if (Math.random() > 0.5) {
    //             // console.log(`setting ${i*2+2} = ${path[i*2]}`)

    //             path[i*2+2] = Math.max(path[i*2] + offset, 0);
    //             path[i*2+2+1] = path[i*2+1]
    //         } else {
    //             path[i*2+2] = path[i*2] 
    //             path[i*2+2+1] = Math.max(path[i*2+1] + offset, 0);
    //         }
    //     }
    //     movables.push(new Movable(path));
    // }
    // console.log(movables);
    //#endregion

    function tick(params) {
        // console.log('---tick---')
        const startTime = performance.now();

        // this should be in the scheduled tasks for a future tick, not implemented immediately
        if (Atomics.load(gameState, 0) == 1) {
            console.log('game is paused, skipping tick')
            return;
        }

        //#region - for debug: check if each players position is different from their target position
        [1,2].forEach((currentDebugUserIndex)=>{
            const currentTargetPositionAsXYCoordinate = movables[currentDebugUserIndex].targetPosition
            // console.log(currentTargetPositionAsXYCoordinate)
            const currentTargetPositionAs1DCorrdinate = helpers.get1DCoordinateFromXYCoordinate(currentTargetPositionAsXYCoordinate[0], currentTargetPositionAsXYCoordinate[1], MAP_WIDTH)
            // console.log(currentTargetPositionAs1DCorrdinate);
            const currentGameStateTargetPosition = Atomics.load(gameState, currentDebugUserIndex);
            // console.log(currentGameStateTargetPosition)
            // if old target position doesn't match new target position, target position has changed, and the path should be recalculated
            if (currentTargetPositionAs1DCorrdinate != currentGameStateTargetPosition) {
                // maybe should be just converting the currentGameStateTargetPosition into XY straight off the bat
                // instead of doing two converstions.
                const {x,y} = helpers.getXYCoordinateFrom1DCoordinate(currentGameStateTargetPosition, MAP_WIDTH)
                
                // calculate bucketed A*
                doAStar(movables[currentDebugUserIndex], x, y)
            }
        })
        //#endregion

        let currentTickTasks = tasks[taskPointer];
        
        for (let i = 0; i < currentTickTasks?.length; i++) {
            currentTickTasks[i].todo();

            if (currentTickTasks[i].rescheduleDurationInTicks) {
                const nextPointerPosition = (taskPointer + currentTickTasks[i].rescheduleDurationInTicks) % totalTicks;
                if (tasks[nextPointerPosition] == undefined) {
                    tasks[nextPointerPosition] = [];
                }
                tasks[nextPointerPosition].push(currentTickTasks[i]);
            }
        }

        tasks[taskPointer] = [];
        taskPointer = (taskPointer+1) % totalTicks;
        
        
        const endTime = performance.now();
        // console.log(`Tick duration: ${endTime - startTime} ms`);
    }

    tick();
    let refVar = setInterval(tick, TICK_PERIOD_MS);


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