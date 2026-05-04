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
import { buildingTypes } from './buildingTypes.js';

// a quest is single step in a quest that a movable takes on
class Action {
	// each Action has a path, but that path might just be a single location
	// e.g. the location of a building as it drops something off, or the location of a resource as it picks it up
	#path;
    // note that this is set before animating to that position so it might not look like we're there yet
    indexOfCurrentLocation = 0;
	uponFinished;
	isFinishedCallback = false;

	constructor(path, uponFinished = ()=>{}) {
        this.#path = path;
		this.uponFinished = uponFinished;
    }

	get currentLocationXY() {
		return [this.#path[this.indexOfCurrentLocation], this.#path[this.indexOfCurrentLocation + 1]];
	}

    get path() {
        return this.#path;
    }

	incrementPath() {
		if (this.isFinishedMoving) {
			return;
		}

		this.indexOfCurrentLocation += 2;
	}

    // set path(path) {
    //     this.#path = path;
    //     // this.path = new Int32Array(new ArrayBuffer(6 * 2));
    //     this.indexOfCurrentLocation = 0;
    // }

	get isFinishedMoving() {
		return this.indexOfCurrentLocation + 2 >= this.#path.length;
	}
}

class Movables {
	knownMovables = [];
	// idleMovables could exist here

	constructor() {

	}

	add(movable) {
		this.knownMovables.push(movable);
	}

	findClosestIdleTo(x, y) {
		let closesDistance = furthestDiagonalDistance;
		let foundIdle = null;
		for (let i = 0; i < this.knownMovables.length; i++) {
			if (!this.knownMovables[i].isIdle()) {
				continue;
			}
			const currentDistance = this.knownMovables[i].getDistanceTo(x, y);
			if (currentDistance < closesDistance) {
				foundIdle = this.knownMovables[i];
				closesDistance = currentDistance;
			}
		}
		return foundIdle;
	}
}

class Movable {

	#quest = [];
	indexOfCurrentQuestAction = 0;
	heldResource = null;

    constructor(quest) {
        this.#quest = quest;
    }

	// this maybe should be private, because you should be accessing the x and y getters individually
	get currentLocationXY() {
		// console.trace();
		return this.#quest[this.indexOfCurrentQuestAction].currentLocationXY;
	}

	get x() {
		return this.currentLocationXY[0];
	}

	get y() {
		return this.currentLocationXY[1];
	}

    // get path() {
    //     return this.#path;
    // }

	set quest(quest) {
		this.#quest = quest;
		this.indexOfCurrentQuestAction = 0;
	}

    // set path(path) {
    //     this.#path = path;
    //     // this.path = new Int32Array(new ArrayBuffer(6 * 2));
    //     this.indexOfCurrentLocation = 0;
    // }

	// maybe not needed if we're not testing the path planning any more
    // get targetPosition() {
    //     // this feels messy, could be updated to be more dynamic in case the path array structure changes
    //     return [this.path[this.path.length - 2] , this.path[this.path.length - 1]];
    // }

	incrementQuest() {
		// if idle, don't move to the next step
		if (this.isIdle()) {
			return;
		} 

		// if (this.x == 1 && this.y == 0) {
		// 	console.log(this);
		// }

		if (this.#quest[this.indexOfCurrentQuestAction].isFinishedMoving) {
			// console.log(`Doing uponFinished...`);
			this.#quest[this.indexOfCurrentQuestAction].uponFinished();
			this.#quest[this.indexOfCurrentQuestAction].isFinishedCallback = true;
			// only increment the quest if there are more quests to increment to
			if (this.indexOfCurrentQuestAction < this.#quest.length - 1) {
				this.indexOfCurrentQuestAction+=1;
			}
		} else {
			// current action still has more steps then increment its path
			this.#quest[this.indexOfCurrentQuestAction].incrementPath();
		}
	}

	isIdle() {
		return this.indexOfCurrentQuestAction + 1 >= this.#quest.length && this.#quest[this.indexOfCurrentQuestAction].isFinishedCallback;
	}

	getDistanceTo(x, y) {
		return getHeuristicCost(x, y, this.x, this.y)
	}
}

class TaskQueue {
	taskRingBuffer;
	totalTicks;
	taskPointer = 0;

	constructor(totalTicks) {
		this.totalTicks = totalTicks;
		this.taskRingBuffer = new Array(this.totalTicks);
	}

	get currentTickTasks() {
		return this.taskRingBuffer[this.taskPointer];
	}

	addTask(index, task) {
		if (this.taskRingBuffer[index] == undefined) {
			this.taskRingBuffer[index] = [];
		}
		this.taskRingBuffer[index].push(task);
	}

	doCurrentTasks() {
		for (let i = 0; i < this.currentTickTasks?.length; i++) {
            this.currentTickTasks[i].todo();

            if (this.currentTickTasks[i].rescheduleDurationInTicks) {
                const nextPointerPosition = (this.taskPointer + this.currentTickTasks[i].rescheduleDurationInTicks) % this.totalTicks;
				this.addTask(nextPointerPosition, this.currentTickTasks[i]);
            }
        }

		this.taskRingBuffer[this.taskPointer] = [];
        this.taskPointer = (this.taskPointer+1) % this.totalTicks;
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

class OpenBucketQueue {
    // must be a power of 2
    numBuckets = 4;
    buckets = [];
    bucketIdx = 0;
    totalCount = 0;

    constructor() {
        this.buckets = new Array(this.numBuckets);
        for (let i = 0; i < this.numBuckets; i++) {
            this.buckets[i] = [];
        }
    }

    add(val1D, cost) {
        // bitwise AND with minus 1 of a value is the same as modulo as long as numBuckets is a power of 2
        const thisIndex = cost & (this.numBuckets - 1);
        this.buckets[thisIndex].push(val1D);
        this.totalCount++;
    }

    removeMin() {
        if (this.totalCount < 1) {
            throw new Error("Can't removeMin from an empty OpenBucketQueue");
        }
        while (!(this.buckets[this.bucketIdx].length > 0)) {
            // bitwise AND with minus 1 of a value is the same as modulo as long as numBuckets is a power of 2
            this.bucketIdx = (this.bucketIdx + 1) & (this.numBuckets - 1);
        }
        this.totalCount--;
        return this.buckets[this.bucketIdx].shift();
    }

    updateCost(val1D, oldFCost, newFCost) {
        const oldBucket = this.buckets[oldFCost & (this.numBuckets - 1)];
        const newBucket = this.buckets[newFCost & (this.numBuckets - 1)];
        for (let i = 0; i < oldBucket.length; i++) {
            if (oldBucket[i] == val1D) {
                oldBucket.splice(i, 1);
                break;
            }
        }
        newBucket.push(val1D);

    }
}

// note that this must always return an integer in order to be valid
function getHeuristicCost(sx, sy, tx, ty) {
    const dx = tx - sx;
    const dy = ty - sy;
    const dz = -dx - dy;  // the implicit third axis
    // "How many steps do I need? Well, I have three debts to pay and each 
    // step pays two of them. The answer is whichever debt is largest — 
    // the other two will get paid off along the way."
    return Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
}

function cellIsWalkable(targetX, targetY, targetFlatIdx, collisionsMapMask) {
    if (helpers.xyCellOutOfBounds(targetX, targetY, MAP_WIDTH, MAP_HEIGHT)) {
        // console.error(`Target is out of bounds`)
        return false;
    }
    
    // check if target is reachable
    if (collisionsMapMask[targetFlatIdx] > 0) {
        // console.error(`Collision, can't walk into a collision`)
        return false;
    }  

	//#region - check if the target is in the same region/landmass as the movable
	//#endregion

    return true;
}


class Resources {
	knownResources = [];
	drawableResourcesMapMask;

	constructor() { }

	add(x,y) {
		this.knownResources.push(new Resource(this, x,y))
	}

	findClosestTo(x, y) {
		let closesDistance = furthestDiagonalDistance;
		let foundResource = null;
		for (let i = 0; i < this.knownResources.length; i++) {
			if (!this.knownResources[i].isAvailable) {
				continue;
			}
			const currentDistance = this.knownResources[i].getDistanceTo(x, y);
			if (currentDistance < closesDistance) {
				foundResource = this.knownResources[i];
				closesDistance = currentDistance;
			}
		}
		return foundResource;
	}
}

class Resource {
	resources;
	type = "wood";
	qty = 1;
	#carriedBy = null;
	floorLocation;
	// e.g if a settler is walking to a piece of wood, nobody else can access it
	reservedForAction = false;

	constructor(resources, x,y) {
		this.resources = resources;
		this.setLocation(x,y)
	}

	get isAvailable() {
		return this.reservedForAction == false;
	}

	set carriedBy(movable) {
		if (movable == null) {
			this.setLocation(this.#carriedBy.x, this.#carriedBy.y)
			this.#carriedBy = null;
		} else {
			Atomics.store(this.resources.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(this.floorLocation.x, this.floorLocation.y, MAP_WIDTH), 0);
			this.#carriedBy = movable;
		}
	}

	setLocation(x,y) {
		Atomics.store(this.resources.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(x, y, MAP_WIDTH), 1);
		this.floorLocation = { x, y };
	}


	getDistanceTo(x, y) {
		return getHeuristicCost(x, y, this.floorLocation.x, this.floorLocation.y)
	}
}

class Buildings {
	knownBuildings = [];

	constructor() {}

	add(buildingIndex, x, y) {
		this.knownBuildings.push(new Building(buildingIndex, x, y))
	}
}

class Building {
	buildingIndex;
	x;
	y;

	constructor(buildingIndex, x, y) {	
		this.buildingIndex = buildingIndex;
		this.x = x;
		this.y = y;

		resourceRequests.add(new ResourceRequest(this, buildingTypes[this.buildingIndex].constructionResources))	
	}

	get entranceX() {
		return this.x + buildingTypes[this.buildingIndex].entrance[0];
	}

	get entranceY() {
		return this.y + buildingTypes[this.buildingIndex].entrance[1];
	}
}

class ResourceRequests {
	knownResourceRequests = [];

	constructor() {

	}

	add(newResourceRequest) {
		this.knownResourceRequests.push(newResourceRequest)
	}
}

class ResourceRequest {
	source;
	qty;

	constructor(source, qty) {
		this.source = source;
		this.qty = qty;

		taskQueue.addTask(taskQueue.taskPointer + 4, new Task((i)=>{
			console.log(`find me ${this.qty} wood`)

			//#region - check if there are any resources, if not, do an early exit
			if (resources.knownResources.length == 0) {
				return;
			}
			//#endregion

			//#region - if there are resources, now check to see if there are any idle villager, if not do an early exit
			// probably would be more optimal to be storing an array of idle villagers instead of doing this check on the fly
			let foundIdleVillager = false;
			for (let i = 0; i < movables.knownMovables.length; i++) {
				if (movables.knownMovables[i].isIdle()) {
					foundIdleVillager = true;
					break;
				}
			}
			//#endregion

			//#region - if there are both resources and also idle villagers, assign the task to the villager
			let closestResource = resources.findClosestTo(this.source.entranceX, this.source.entranceY);
			console.log(closestResource);

			let closestIdleVillager = movables.findClosestIdleTo(closestResource.floorLocation.x, closestResource.floorLocation.y)
			console.log(closestIdleVillager);
			//#endregion

			//#region - generate quest for idle villager

			closestResource.reservedForAction = true;
			closestIdleVillager.quest = [
				new Action(doAStar(closestIdleVillager.x, closestIdleVillager.y, closestResource.floorLocation.x, closestResource.floorLocation.y)),
				new Action([closestResource.floorLocation.x, closestResource.floorLocation.y], ()=>{
					closestResource.carriedBy = closestIdleVillager;
					closestIdleVillager.heldResource = closestResource;
				}),
				new Action(doAStar(closestResource.floorLocation.x, closestResource.floorLocation.y, this.source.entranceX, this.source.entranceY)),
				new Action([this.source.entranceX, this.source.entranceY], ()=>{
					closestResource.carriedBy = null;
					closestIdleVillager.heldResource = null;
					closestResource.reservedForAction = false;
				}),
				// new Action([0, 0])
			]
			console.log(closestIdleVillager);
			//#endregion


			// while (Atomics.load(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1) !== 0) {
			// 	// console.log("tick waiting for render to be ready");
			// }
	
			// Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 1);
			// for (let i = 0; i < movables.length; i++) {
			// 	// share the current position with the render thread
			// 	movablePositions[i*2] = movables[i].path[movables[i].indexOfCurrentLocation];
			// 	movablePositions[i*2+1] = movables[i].path[movables[i].indexOfCurrentLocation + 1];
				
			// 	// do you have anywhere left to go?
			// 	if (movables[i].indexOfCurrentLocation + 2 >= movables[i].path.length) {
			// 		continue;
			// 	} 
	
			// 	// if you have anywhere left to go, go there
			// 	movables[i].indexOfCurrentLocation+=2;
			// }
			// // atomic commands act as a memory fence around non-sequential commands (which are faster)
			// Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);
		}));
	}
}


const totalTicks = MAX_SCHEDULE_DURATION_MS/TICK_PERIOD_MS;

let movables = new Movables()
let resources = new Resources();
let buildings = new Buildings();
let taskQueue = new TaskQueue(totalTicks);
let resourceRequests = new ResourceRequests();

// this is the distance diagonally NE/SW in which each diagonal cell isn't a single step away
const furthestDiagonalDistance = MAP_WIDTH + MAP_HEIGHT ;

function doAStar(currentMovablePositionX, currentMovablePositionY, targetX, targetY) {
	console.log(`Doing A* towards ${targetX}, ${targetY}`);
	const targetFlatIdx = helpers.get1DCoordinateFromXYCoordinate(targetX, targetY, MAP_WIDTH);
	console.log(targetFlatIdx);

	if (!cellIsWalkable(targetX, targetY, targetFlatIdx, collisionsMapMask)) {
		// console.error(`Not able to walk to target`)
		return null;
	}

	// const [currentMovablePositionX, currentMovablePositionY] = movable.currentLocationXY;

	const startFlatIdx =  helpers.get1DCoordinateFromXYCoordinate(currentMovablePositionX, currentMovablePositionY, MAP_WIDTH);

	// in the 2015 code they had these permanently stored as 
	// global variables shared for each A* for efficiency they're not creating/deleteing arrays all the time
	// however they clear the bit masks every time the A* is performed
	// "I have encountered this cell as a neighbour before"
	const openBitSet = new Array(MAP_WIDTH * MAP_HEIGHT);
	// "I have processed this cell and it's neighbours before"
	const closedBitSet = new Array(MAP_WIDTH * MAP_HEIGHT);
	
	// in the 2015 code they have this assigned as a global variable, and it's only 
	// ever read after being written to so it's okay not to even clear it between timed A* is performed
	const open = new OpenBucketQueue();

	let found = false;
	// in the 2015 code they have this assigned as a global variable, and it's only 
	// ever read after being written to so it's okay not to even clear it between timed A* is performed
	// note that we technically don't need two variables stored in this array
	// because the step between every path is always 1
	// and the first parameter can be derived based on the second parameter
	let depthParentHeap = new Array(MAP_WIDTH * MAP_HEIGHT * 2);
	depthParentHeap[startFlatIdx * 2]     =  0; // num steps from start
	depthParentHeap[startFlatIdx * 2 + 1] = -1; // previous cell was non-existant

	// in the 2015 code they have this assigned as a global variable, and it's only 
	// ever read after being written to so it's okay not to even clear it between timed A* is performed
	// how many steps to get to this point
	// note that these must be integers
	let gCosts = new Array(MAP_WIDTH * MAP_HEIGHT);
	// this should be redundant because the array should be initialised with all zeros
	// but it can't hurt to be explicit
	gCosts[startFlatIdx] = 0;

	open.add(startFlatIdx, getHeuristicCost(currentMovablePositionX, currentMovablePositionY, targetX, targetY));
	openBitSet[startFlatIdx] = 1;

	while (open.totalCount > 0) {
		let currentFlatIdx = open.removeMin();

		const {x,y} = helpers.getXYCoordinateFrom1DCoordinate(currentFlatIdx, MAP_WIDTH);
		
		
		
		closedBitSet[currentFlatIdx] = 1;

		if (targetFlatIdx == currentFlatIdx) {
			found = true;
			break;
		}

		let currentPositionGCosts = gCosts[currentFlatIdx];

		// could be optimised to a regular for loop?
		for (const [key, value] of Object.entries(DIRECTIONS)) {
			const neighbourX = x + value[0];
			const neighbourY = y + value[1];
			const neighbourFlatIdx =  helpers.get1DCoordinateFromXYCoordinate(neighbourX, neighbourY, MAP_WIDTH);

			if (!cellIsWalkable(neighbourX, neighbourY, neighbourFlatIdx, collisionsMapMask)) {
				continue;
			}

			const newGCosts = currentPositionGCosts + 1;

			// ideally could be re-written so that you've got an early exit in the case when newcosts is not larger than oldGCosts
			// because the logic when you're updating values is mostly the same in both branches of this "if"
			if (openBitSet[neighbourFlatIdx]) {
				// we've already seen this cell so check if this is a shorter path to it
				const oldGCosts = gCosts[neighbourFlatIdx];

				if (newGCosts < oldGCosts) {
					gCosts[neighbourFlatIdx] = newGCosts;
					// current depth is 1 larger than previous cell
					depthParentHeap[neighbourFlatIdx * 2    ] = depthParentHeap[currentFlatIdx * 2] + 1;
					// link to previous cell, saying "this is where I came from"
					depthParentHeap[neighbourFlatIdx * 2 + 1] = currentFlatIdx;

					// find distance between neighbour and target position
					const heuristicCosts = getHeuristicCost(neighbourX, neighbourY, targetX, targetY);
					open.updateCost(neighbourFlatIdx, oldGCosts + heuristicCosts, newGCosts + heuristicCosts)
				}

			} else {
				// we haven't seen this cell already, so fill in its values as default
				gCosts[neighbourFlatIdx] = newGCosts;
				// current depth is 1 larger than previous cell
				depthParentHeap[neighbourFlatIdx * 2    ] = depthParentHeap[currentFlatIdx * 2] + 1;
				// link to previous cell, saying "this is where I came from"
				depthParentHeap[neighbourFlatIdx * 2 + 1] = currentFlatIdx;

				openBitSet[neighbourFlatIdx] = 1;

				// find distance between neighbour and target position
				const heuristicCosts = getHeuristicCost(neighbourX, neighbourY, targetX, targetY);
				open.add(neighbourFlatIdx, newGCosts + heuristicCosts)
			}

		}
	}

	if (found) {
		const pathLength = depthParentHeap[targetFlatIdx * 2];
		let path = [currentMovablePositionX, currentMovablePositionY];

		let idx = pathLength;
		let currentFlatIdx = targetFlatIdx;

		while (idx > 0) {
			const {x,y} = helpers.getXYCoordinateFrom1DCoordinate(currentFlatIdx, MAP_WIDTH);
			path[idx * 2] = x;
			path[idx * 2 + 1] = y;
			currentFlatIdx = depthParentHeap[currentFlatIdx * 2 + 1];
			idx--;
		}

		// movable.quest = [new Action(path)]
		return path; 
	} 
	console.error(`No path found`);
	return null;

}

let movablePositions; 
let gameState;
let collisionsMapMask;

self.onmessage = e => {
	if (e.data.isNewTickTask) {
		console.log(`>>>>`)
		console.log(e.data.messageToUser)
		if (e.data.messageToUser.actionType == 'placeBuilding') {
			buildings.add(e.data.messageToUser.currentBuildingIdx, e.data.messageToUser.x, e.data.messageToUser.y)
			console.log(buildings);
		}

		return;
	} 
	
    const { movablePositionsSab, gameStateSab, collisionsMapMaskSab, drawableResourcesMapMaskSab } = e.data;

    movablePositions   = new Uint32Array(movablePositionsSab); 
    gameState = new Uint32Array(gameStateSab);
    collisionsMapMask = new Uint8Array(collisionsMapMaskSab);
	resources.drawableResourcesMapMask = new Uint32Array(drawableResourcesMapMaskSab);

	// create a dummy piece of wood for testing
	resources.add(3,0);
	resources.add(15,2);
	resources.add(10,10);
    resources.add(10,12);
    
    // let dummyVillager = new Movable([5,3,5,2,4,2,3,2,2,2,2,1]);
    // let dummyVillager2 = new Movable([10,1,9,1,8,1]);
    // let movables = [dummyVillager2, dummyVillager];

    const moveAllMovablesTask = new Task((i)=>{
        // console.log(`it's time to move all movables`)

        while (Atomics.load(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1) !== 0) {
            // console.log("tick waiting for render to be ready");
        }

        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 1);
        for (let i = 0; i < movables.knownMovables.length; i++) {
            // share the current position with the render thread
			// let currentPosition = movables.knownMovables[i].currentLocationXY;
            movablePositions[i*2] = movables.knownMovables[i].x;
            movablePositions[i*2+1] = movables.knownMovables[i].y;
            
			movables.knownMovables[i].incrementQuest();
        }
        // atomic commands act as a memory fence around non-sequential commands (which are faster)
        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);
    }, 750);

	taskQueue.addTask(0, moveAllMovablesTask);
        

    
	movables.add(new Movable([new Action([0,0])]))
    movables.add(new Movable([new Action([7,1, 6,1, 5,1, 4,1, 3,1, 2,1, 1,1])]));
    movables.add(new Movable([new Action([7,2, 6,2, 5,2, 4,2, 3,2, 2,2, 1,2])]));
   

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

        // #region - for debug: check if each players position is different from their target position
        // [1,2].forEach((currentDebugUserIndex)=>{
        //     const currentTargetPositionAsXYCoordinate = movables.knownMovables[currentDebugUserIndex].targetPosition
        //     // console.log(currentTargetPositionAsXYCoordinate)
        //     const currentTargetPositionAs1DCorrdinate = helpers.get1DCoordinateFromXYCoordinate(currentTargetPositionAsXYCoordinate[0], currentTargetPositionAsXYCoordinate[1], MAP_WIDTH)
        //     // console.log(currentTargetPositionAs1DCorrdinate);
        //     const currentGameStateTargetPosition = Atomics.load(gameState, currentDebugUserIndex);
        //     // console.log(currentGameStateTargetPosition)
        //     // if old target position doesn't match new target position, target position has changed, and the path should be recalculated
        //     if (currentTargetPositionAs1DCorrdinate != currentGameStateTargetPosition) {
        //         console.log(currentTargetPositionAs1DCorrdinate, currentGameStateTargetPosition);
        //         // maybe should be just converting the currentGameStateTargetPosition into XY straight off the bat
        //         // instead of doing two converstions.
        //         const {x,y} = helpers.getXYCoordinateFrom1DCoordinate(currentGameStateTargetPosition, MAP_WIDTH)
                
        //         // calculate bucketed A*
        //         let aStarReturn = doAStar(movables.knownMovables[currentDebugUserIndex], x, y);
        //         console.log({aStarReturn});
        //         if (!aStarReturn) {
        //             console.error(`PAUSE`);
        //             clearInterval(refVar);
        //         }
        //     }
        // })
        //#endregion

        taskQueue.doCurrentTasks();
        
        const endTime = performance.now();
        // console.log(`Tick duration: ${endTime - startTime} ms`);
    }

    tick();
    let refVar = setInterval(tick, TICK_PERIOD_MS);
}