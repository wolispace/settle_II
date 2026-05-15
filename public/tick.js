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

const MOVE_ACTION = 1;
const PICKUP_ACTION = 2;
const DROPOFF_ACTION = 3;
const BUILD_ACTION = 4;

class AvailableTasks {
	knownTasks = [[], [], []];

	constructor() { }

	add(villagerTask, priority) {
		if (this.knownTasks[priority]) {
			this.knownTasks[priority].push(villagerTask);
			return true;
		}
		return false;
	}

	findHighestPriorityReady() {
		for (let i = 0; i < this.knownTasks.length; i++) {
			for (let j = 0; j < this.knownTasks[i].length; j++) {
				if (this.knownTasks[i][j].canBeDone) {
					return this.knownTasks[i].splice(j, 1)[0];
				}
			}
		}
		return null;
	}
}

class VillagerTask {
	constructor() {

	}
}

// a quest is single step in a quest that a movable takes on
class Action {
	// each Action has a path, but that path might just be a single location
	// e.g. the location of a building as it drops something off, or the location of a resource as it picks it up
	#atomicActions;
	// the index we're pointing at hasn't yet been executed, it's the next one to be executed
    // note that this is set before animating to that position so it might not look like we're there yet
    indexOfCurrentAtomicAction = 0;
	// uponFinished;
	// isFinishedCallback = false;

	constructor(atomicActions) {
        this.#atomicActions = atomicActions;
		// this.uponFinished = uponFinished;
    }

	

	// get currentLocationXY() {
	// 	return [this.#path[this.indexOfCurrentLocation], this.#path[this.indexOfCurrentLocation + 1]];
	// }

    get atomicActions() {
        return this.#atomicActions;
    }

	incrementAction() {
		// if (this.isFinishedMoving) {
		// 	return;
		// }
		this.atomicActions[this.indexOfCurrentAtomicAction].do();

		this.indexOfCurrentAtomicAction += 1;
	}

    // set path(path) {
    //     this.#path = path;
    //     // this.path = new Int32Array(new ArrayBuffer(6 * 2));
    //     this.indexOfCurrentLocation = 0;
    // }

	get isFinished() {
		return this.indexOfCurrentAtomicAction >= this.#atomicActions.length;
	}
}

class AtomicAction {
	actionType;
	aaParams = [];

	constructor(actionType, aaParams) {
		this.actionType = actionType;
		this.aaParams = aaParams;
	}

	do() {
		switch (this.actionType) {
			case MOVE_ACTION:
				// [x, y, movable]
				this.aaParams[2].x = this.aaParams[0];
				this.aaParams[2].y = this.aaParams[1];
				break;
			case PICKUP_ACTION:
				// [resource, movable]
				this.aaParams[0].removeFromWorld();
				console.log(resources);
				// this.aaParams[0].carriedBy = this.aaParams[1];
				this.aaParams[1].heldResource = 1;
				break;
			case DROPOFF_ACTION:
				// [movable, building]
				this.aaParams[0].heldResource = 0;
				this.aaParams[1].addToConstructionResources();
				break;
			case BUILD_ACTION:
				// [movable, building]
				console.log("BUILDING");
				this.aaParams[1].updateBuildAmount(this.aaParams[1].remainingBuildSteps - 1);
				if (this.aaParams[1].remainingBuildSteps > 0) {
					this.aaParams[0].quest[this.aaParams[0].indexOfCurrentQuestAction].indexOfCurrentAtomicAction--;
				}
				break;
			default:
				break;
		}
	}
}

class Movables {
	knownMovables = [];
	// idleMovables could exist here

	constructor() {

	}

	get hasIdle() {
		for (let i = 0; i < this.knownMovables.length; i++) {
			if (this.knownMovables[i].isIdle) {
				return true;
			}
		}
		return false;
	}

	add(movable) {
		this.knownMovables.push(movable);
	}

	findClosestIdleTo(x, y) {
		let closesDistance = furthestDiagonalDistance;
		let foundIdle = null;
		for (let i = 0; i < this.knownMovables.length; i++) {
			if (!this.knownMovables[i].isIdle) {
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
	heldResource = 0;

	x;
	y;

    constructor(x,y) {
		this.x = x;
		this.y = y;
        // this.#quest = quest;
    }

	// this maybe should be private, because you should be accessing the x and y getters individually
	// get currentLocationXY() {
	// 	// console.trace();
	// 	return [this.x, this.y];
	// }



	// get x() {
	// 	return this.currentLocationXY[0];
	// }

	// get y() {
	// 	return this.currentLocationXY[1];
	// }

    // get path() {
    //     return this.#path;
    // }

	get quest() {
		return this.#quest;
	}


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
		if (this.isIdle) {
			return;
		} 

		if (this.#quest[this.indexOfCurrentQuestAction].isFinished) {
			this.indexOfCurrentQuestAction+=1;
		} else {
			// current action still has more steps then increment its path
			this.#quest[this.indexOfCurrentQuestAction].incrementAction();
		}

		// note that we do this in both cases because if the final action only has one atomic action
		// then if we check it in the branch then it wouldn't be triggered
		if (this.isIdle) {
			doTaskMatchmake(taskQueue.getTickInFuture(1));
			// tryFindingResourceMatch(null, null, this, taskQueue.getTickInFuture(1));
		}
	}

	get isIdle() {
		// technically the the isFinished check is redundant, can't hurt to have it, 
		// but really it's the indexOfCurrentQuestAction which will get into out of bounds territory when idle
		return this.indexOfCurrentQuestAction + 1 >= this.#quest.length && this.#quest[this.indexOfCurrentQuestAction].isFinished;
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

	getTickInFuture(numTicksInFuture) {
		return (numTicksInFuture + this.taskPointer) % this.totalTicks;
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

	remove(resourceToremove) {
		console.log(resourceToremove);
		for (let i = 0; i < this.knownResources.length; i++) {
			if (this.knownResources[i].floorLocation.x == resourceToremove.floorLocation.x
				&& this.knownResources[i].floorLocation.y == resourceToremove.floorLocation.y) {
				this.knownResources.splice(i, 1);
				return true;
			}
		}
		return false;
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
	// #carriedBy = null;
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

	// set carriedBy(movable) {
	// 	if (movable == null) {
	// 		this.setLocation(this.#carriedBy.x, this.#carriedBy.y)
	// 		this.#carriedBy = null;
	// 	} else {
	// 		Atomics.store(this.resources.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(this.floorLocation.x, this.floorLocation.y, MAP_WIDTH), 0);
	// 		this.#carriedBy = movable;
	// 	}
	// }

	setLocation(x,y) {
		Atomics.store(this.resources.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(x, y, MAP_WIDTH), 1);
		this.floorLocation = { x, y };
	}


	getDistanceTo(x, y) {
		return getHeuristicCost(x, y, this.floorLocation.x, this.floorLocation.y)
	}

	removeFromWorld() {
		this.qty--;
		if (this.qty == 0) {
			this.resources.remove(this);
			Atomics.store(this.resources.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(this.floorLocation.x, this.floorLocation.y, MAP_WIDTH), 0);
		}
	}
}

class Buildings {
	knownBuildings = [];
	newBuildingID = 0;

	constructor() {}

	add(buildingIndex, x, y) {
		this.knownBuildings.push(new Building(buildingIndex, x, y, this.newBuildingID))
		this.newBuildingID++;
	}
}

class Building {
	buildingIndex;
	#remainingBuildSteps;
	x;
	y;
	id;
	heldConstructionResources = 0;

	constructor(buildingIndex, x, y, id) {	
		this.buildingIndex = buildingIndex;
		this.x = x;
		this.y = y;
		this.id = id;

		this.updateBuildAmount(buildingTypes[this.buildingIndex].buildSteps);

		// resourceRequests.add(new ResourceRequest(this, buildingTypes[this.buildingIndex].constructionResources))	
		availableTasks.add(new ResourceRequest(this, buildingTypes[this.buildingIndex].constructionResources), 2)	
		// availableTasks.add(new BuildTask(this), 2)	
	}

	get entranceX() {
		return this.x + buildingTypes[this.buildingIndex].entrance[0];
	}

	get entranceY() {
		return this.y + buildingTypes[this.buildingIndex].entrance[1];
	}

	get remainingBuildSteps() {
		return this.#remainingBuildSteps;
	}

	updateBuildAmount(newBuildSteps) {
		this.#remainingBuildSteps = newBuildSteps;
		const bbox = buildingTypes[this.buildingIndex].bbox; 

		Atomics.store(buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[0][0], this.y + bbox[0][1], MAP_WIDTH), helpers.buildingToUint32(this, 0));
		Atomics.store(buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[1][0], this.y + bbox[1][1], MAP_WIDTH), helpers.buildingToUint32(this, 1));
		Atomics.store(buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[2][0], this.y + bbox[2][1], MAP_WIDTH), helpers.buildingToUint32(this, 2));
		Atomics.store(buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[3][0], this.y + bbox[3][1], MAP_WIDTH), helpers.buildingToUint32(this, 3));
	}
	
	addToConstructionResources() {
		this.heldConstructionResources++
		if (this.heldConstructionResources == buildingTypes[this.buildingIndex].constructionResources) {
			availableTasks.add(new BuildRequest(this), 2);	
			doTaskMatchmake(taskQueue.getTickInFuture(1));
		}
	}
}

// class ResourceRequests {
// 	knownResourceRequests = [];

// 	constructor() {

// 	}

// 	add(newResourceRequest) {
// 		this.knownResourceRequests.push(newResourceRequest)
// 	}

// 	// findHighestPriority() {
// 	// 	for (let i = 0; i < this.knownResourceRequests.length; i++) {
// 	// 		if (this.knownResourceRequests[i].isAvailable) {
// 	// 			return this.knownResourceRequests[i];
// 	// 		}
// 	// 	}
// 	// 	return null;
// 	// }
// }

class ResourceRequest {
	source;
	qty;
	isTaken = false;

	constructor(source, qty) {
		this.source = source;
		this.qty = qty;

		// tryFindingResourceMatch(this, null, null, taskQueue.getTickInFuture(1));
		doTaskMatchmake(taskQueue.getTickInFuture(1))
	}

	get isAvailable() {
		return !this.isTaken;
	}

	// assume this never gets called unless there are idle villagers, so you're checking for everything else
	get canBeDone() {
		// this will need to be updated when there are more than one type of resource
		return resources.knownResources.length > 0;
	}
}

class BuildRequest {
	source;

	constructor(source) {
		this.source = source;
	}

	canBeDone() {
		return this.source.heldConstructionResources == buildingTypes[this.source.buildingIndex].constructionResources;
	}
}


const totalTicks = MAX_SCHEDULE_DURATION_MS/TICK_PERIOD_MS;

let taskQueue = new TaskQueue(totalTicks);
let movables = new Movables()
let resources = new Resources();
let buildings = new Buildings();
// let resourceRequests = new ResourceRequests();
let availableTasks = new AvailableTasks();

// this is the distance diagonally NE/SW in which each diagonal cell isn't a single step away
const furthestDiagonalDistance = MAP_WIDTH + MAP_HEIGHT ;

function doTaskMatchmake(tickToAssignTo) {
	taskQueue.addTask(tickToAssignTo, new Task((i)=>{

		if (!movables.hasIdle) {
			return;
		}
		
		// there is someone idle so find a task for them to do
		const villagerTask = availableTasks.findHighestPriorityReady();
		if (villagerTask == null) {
			return;
		}

		if (villagerTask instanceof ResourceRequest) {
			// request for resource = find closest villager/resource

			const resource = resources.findClosestTo(villagerTask.source.entranceX, villagerTask.source.entranceY);
			// this would be redundant if we had two separate arrays for knownResources and availableResources
			if (resource == null) {
				return;
			}

			const movable = movables.findClosestIdleTo(resource.floorLocation.x, resource.floorLocation.y)
			// this would be redundant if we had two separate arrays for knownMovables and idleMovables
			if (movable == null) {
				return;
			}

			//#region - generate quest for idle villager

			// note that we reseve the resource immediately because if we queue it in an action then 
			// multiple people might try and claim it for themselves at a later time
			resource.reservedForAction = true;
			villagerTask.isTaken = true;
			movable.quest = [
				new Action(aStarMovable(movable.x, movable.y, resource.floorLocation.x, resource.floorLocation.y, movable)),
				new Action([new AtomicAction(PICKUP_ACTION, [resource, movable])]),
				new Action(aStarMovable(resource.floorLocation.x, resource.floorLocation.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
				new Action([new AtomicAction(DROPOFF_ACTION, [movable, villagerTask.source])]),
			]
			//#endregion

		} else if (villagerTask instanceof BuildRequest) {
			// build = find cosest villager

			const movable = movables.findClosestIdleTo(villagerTask.source.entranceX, villagerTask.source.entranceY)
			// this would be redundant if we had two separate arrays for knownMovables and idleMovables
			if (movable == null) {
				return;
			}

			movable.quest = [
				new Action(aStarMovable(movable.x, movable.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
				new Action([new AtomicAction(BUILD_ACTION, [movable, villagerTask.source])]),
			]
		}


		


	}));
}

// function tryFindingResourceMatch(resourceRequest, resource, movable, tickToAssignTo) {
// 	taskQueue.addTask(tickToAssignTo, new Task((i)=>{

// 		if (resourceRequest == null) {
// 			resourceRequest = resourceRequests.findHighestPriority();
// 			// this would be redundant if we had two separate arrays for knownResourceRequests and availableResourceRequests
// 			if (resourceRequest == null) {
// 				return;
// 			}
// 		}

// 		if (resource == null) {
// 			resource = resources.findClosestTo(resourceRequest.source.entranceX, resourceRequest.source.entranceY);
// 			// this would be redundant if we had two separate arrays for knownResources and availableResources
// 			if (resource == null) {
// 				return;
// 			}
// 		}

// 		if (movable == null) {
// 			movable = movables.findClosestIdleTo(resource.floorLocation.x, resource.floorLocation.y)
// 			// this would be redundant if we had two separate arrays for knownMovables and idleMovables
// 			if (movable == null) {
// 				return;
// 			}
// 		}

// 		//#region - generate quest for idle villager

// 		// note that we reseve the resource immediately because if we queue it in an action then 
// 		// multiple people might try and claim it for themselves at a later time
// 		resource.reservedForAction = true;
// 		resourceRequest.isTaken = true;
// 		movable.quest = [
// 			new Action(aStarMovable(movable.x, movable.y, resource.floorLocation.x, resource.floorLocation.y, movable)),
// 			new Action([new AtomicAction(PICKUP_ACTION, [resource, movable])]),
// 			new Action(aStarMovable(resource.floorLocation.x, resource.floorLocation.y, resourceRequest.source.entranceX, resourceRequest.source.entranceY, movable)),
// 			new Action([new AtomicAction(DROPOFF_ACTION, [resource, movable])]),
// 		]
// 		//#endregion
// 	}));
// }

function aStarMovable(initialX, initialY, targetX, targetY, movable) {
	let atomicActions = doAStar(initialX, initialY, targetX, targetY);
	for (let i = 0; i < atomicActions.length; i++) {
		atomicActions[i].aaParams.push(movable);
	}
	return atomicActions;
}

function doAStar(currentMovablePositionX, currentMovablePositionY, targetX, targetY) {
	const targetFlatIdx = helpers.get1DCoordinateFromXYCoordinate(targetX, targetY, MAP_WIDTH);

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
		let path = [new AtomicAction(MOVE_ACTION, [currentMovablePositionX, currentMovablePositionY])];

		let idx = pathLength;
		let currentFlatIdx = targetFlatIdx;

		while (idx > 0) {
			const {x,y} = helpers.getXYCoordinateFrom1DCoordinate(currentFlatIdx, MAP_WIDTH);
			// path[idx * 2] = x;
			// path[idx * 2 + 1] = y;
			path[idx] = new AtomicAction(MOVE_ACTION, [x, y]);
			currentFlatIdx = depthParentHeap[currentFlatIdx * 2 + 1];
			idx--;
		}

		return path; 
	} 
	console.error(`No path found`);
	return null;

}

let movablePositions; 
let gameState;
let collisionsMapMask;
let buildingsMap;

self.onmessage = e => {
	if (e.data.isNewTickTask) {
		// console.log(`>>>>`)
		// console.log(e.data.messageToUser)
		if (e.data.messageToUser.actionType == 'placeBuilding') {
			buildings.add(e.data.messageToUser.currentBuildingIdx, e.data.messageToUser.x, e.data.messageToUser.y)
			// console.log(buildings);
		}

		return;
	} 
	
    const { movablePositionsSab, gameStateSab, collisionsMapMaskSab, drawableResourcesMapMaskSab, buildingsMapSab } = e.data;

    movablePositions   = new Uint32Array(movablePositionsSab); 
    gameState = new Uint32Array(gameStateSab);
    collisionsMapMask = new Uint8Array(collisionsMapMaskSab);
	resources.drawableResourcesMapMask = new Uint32Array(drawableResourcesMapMaskSab);
	buildingsMap = new Uint32Array(buildingsMapSab)

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

		// check if the movablePositions SAB is accessible
        while (Atomics.load(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1) !== 0) {
            // console.log("tick waiting for render to be ready");
        }

		// lock the movablePositions SAB while working with it
        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 1);

        for (let i = 0; i < movables.knownMovables.length; i++) {
            // share the current position with the render thread
			// let currentPosition = movables.knownMovables[i].currentLocationXY;
            
			movables.knownMovables[i].incrementQuest();

			// since each movable doesn't know where it sits in the movablePositions SAB, 
			// we update that here instead of putting it inside of incrementQuest
            movablePositions[i*2] = movables.knownMovables[i].x;
            movablePositions[i*2+1] = movables.knownMovables[i].y;
        }

        // unlock the movablePositions SAB now that we're done with it
        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);
    }, 500);

	taskQueue.addTask(0, moveAllMovablesTask);
        

    let movableOne = new Movable(0,0);
	movables.add(movableOne)
	movableOne.quest = [new Action([
		new AtomicAction(MOVE_ACTION, [0,0, movableOne])
	])]
	
	let movableTwo = new Movable(7,1);
	movables.add(movableTwo)
	movableTwo.quest = [new Action([
		new AtomicAction(MOVE_ACTION, [7,1, movableTwo]),
		new AtomicAction(MOVE_ACTION, [6,1, movableTwo]),
		new AtomicAction(MOVE_ACTION, [5,1, movableTwo]),
		new AtomicAction(MOVE_ACTION, [4,1, movableTwo]),
		new AtomicAction(MOVE_ACTION, [3,1, movableTwo]),
		new AtomicAction(MOVE_ACTION, [2,1, movableTwo]),
		new AtomicAction(MOVE_ACTION, [1,1, movableTwo])
	])];

	let movableThree = new Movable(7,2);
	movables.add(movableThree)
	movableThree.quest = [new Action([
		new AtomicAction(MOVE_ACTION, [7,2, movableThree]),
		new AtomicAction(MOVE_ACTION, [6,2, movableThree]),
		new AtomicAction(MOVE_ACTION, [5,2, movableThree]),
		new AtomicAction(MOVE_ACTION, [4,2, movableThree]),
		new AtomicAction(MOVE_ACTION, [3,2, movableThree]),
		new AtomicAction(MOVE_ACTION, [2,2, movableThree]),
		new AtomicAction(MOVE_ACTION, [1,2, movableThree])
	])];
   

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