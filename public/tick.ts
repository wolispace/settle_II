import {
	MAX_MOVABLES,
	NUM_EXTRA_BITS,
	MAX_SCHEDULE_DURATION_MS,
	TICK_PERIOD_MS,
	MAP_WIDTH,
	MAP_HEIGHT,
	DIRECTIONS,
	MAX_RESOURCES_PER_STACK
} from './constants.js';
import helpers from './helpers.js';
import { resourceTypes } from './resourceTypes.js';
import { buildingTypes } from './buildingTypes.js';
import { ResourceRequest, BuildRequest, FabricationRequest, DispenserFetchRequest } from './classes/Requests.js';
import { ResourceStacks, ResourceStack } from './classes/Resources.js';
import { Movables, Movable } from './classes/Movables.js';
import { Buildings, Building } from './classes/Buildings.js';
import { Dispensers, Dispenser } from './classes/Dispenser.js';

import { tc } from './tickContext.js';

const MOVE_ACTION 		= 1;
const PICKUP_ACTION 	= 2;
const DROPOFF_ACTION 	= 3;
const BUILD_ACTION 		= 4;
const FABRICATE_ACTION 	= 5;
const DISPENSE_ACTION 	= 6;
const END_ACTION 	    = 7;

class AvailableTasks {
	knownTasks:Array<Array<any>> = [[], [], []];
	latestAddedID = 0;

	constructor() { }

	add(villagerTask, priority) {
		if (this.knownTasks[priority]) {
			this.knownTasks[priority].push(villagerTask);
			villagerTask.setID(this.latestAddedID++);
			return villagerTask;
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

	cancelTask(task) {
		for (let i = 0; i < this.knownTasks.length; i++) {
			for (let j = 0; j < this.knownTasks[i].length; j++) {
				if (this.knownTasks[i][j].id == task.id) {
					return this.knownTasks[i].splice(j, 1)[0];
				}
			}
		}
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
	aaParams:any = [];

	constructor(actionType, aaParams) {
		this.actionType = actionType;
		this.aaParams = aaParams;
	}

	do() {
		if (this.actionType == MOVE_ACTION) {
			// [x, y, movable]
			this.aaParams[2].x = this.aaParams[0];
			this.aaParams[2].y = this.aaParams[1];
		} else if (this.actionType == PICKUP_ACTION) {
			// [resource, movable]
			this.aaParams[0].remove();
			// this.aaParams[0].carriedBy = this.aaParams[1];
			this.aaParams[1].heldResource = this.aaParams[0].resourceStack.resourceId;
		} else if (this.actionType == DROPOFF_ACTION) {
			// [movable, building, resourceId, dropOffToInput]
			let dropOffToInput = this.aaParams[3];
			this.aaParams[0].heldResource = null;
			if (dropOffToInput) {
				this.aaParams[1].addToHeldResources(this.aaParams[2]);
			} else {
				this.aaParams[1].addToOutfeedResources(this.aaParams[2]);
			}
			
		} else if (this.actionType == BUILD_ACTION) {
			// [movable, building]
			console.log("BUILDING");
			this.aaParams[1].updateBuildAmount(this.aaParams[1].remainingBuildSteps - 1);
			if (this.aaParams[1].remainingBuildSteps > 0) {
				this.aaParams[0].quest[this.aaParams[0].indexOfCurrentQuestAction].indexOfCurrentAtomicAction--;
			} 
		} else if (this.actionType == FABRICATE_ACTION) {
			// [movable, villagerTask]
			let movable = this.aaParams[0];
			let villagerTask = this.aaParams[1];

			// destroy the input resources
			villagerTask.source.removeFromHeldResources(villagerTask.fabricationSet.input);

			// clear the quest of the movable, but keep their task intact
			movable.clearQuestOnly();

			// schedule the creation of the resource at a later tick
			// create a task at a future tick to create the output resources and also cancel the task so the movable becomes idle again
			tc.taskQueue.addTask(tc.taskQueue.getTickInFuture(villagerTask.fabricationSet.durationInMs/TICK_PERIOD_MS), new Task((i) => {
				// create the output resource
				for (const [resourceId, resourceQty] of Object.entries(villagerTask.fabricationSet.output)) {
					
					villagerTask.source.addToOutfeedResources(resourceId);
				}
				// make new ResourceRequests to replace all of the resources that were just consumed
				for (const [resourceId, resourceQty] of Object.entries(villagerTask.fabricationSet.input) as [string, number][]) {
					for (let i = 0; i < resourceQty; i++) {
						villagerTask.source.addAssociatedTask(tc.availableTasks.add(new ResourceRequest(villagerTask.source, resourceId), 2));
					}
				}

				villagerTask.cancel();
			}))
		} else if (this.actionType == DISPENSE_ACTION) {
			// [dispenser, movable, villagerTask]
			let dispenser = this.aaParams[0];
			let movable = this.aaParams[1];
			let villagerTask = this.aaParams[2];

			
			

		
			


			// 4) pause while chopping wood
			// tc.taskQueue.addTask(tc.taskQueue.getTickInFuture(villagerTask.fabricationSet.durationInMs/TICK_PERIOD_MS), new Task((i) => {

				movable.heldResource = dispenser.resourceId;

				dispenser.reduce()
				// reset the dispenser taskReservedFor
				dispenser.taskReservedFor = null;

				// let relativePositionArray = buildingTypes[villagerTask.source.buildingIndex].outputLocations[dispenser.resourceId]
				// let newX = villagerTask.source.x + relativePositionArray[0];
				// let newY = villagerTask.source.y + relativePositionArray[1];
				// let resource = tc.resourceStacks.add(dispenser.resourceId, newX, newY, villagerTask.source);

				// clear the quest of the movable, but keep their task intact
				movable.clearQuestOnly();
				movable.quest = [
					// 5) walk to building
					new Action(aStarMovable(movable.x, movable.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
					
					
					// 6) deliver wood to output of the building
					new Action([new AtomicAction(DROPOFF_ACTION, [movable, villagerTask.source, dispenser.resourceId, false])]),
					new Action([new AtomicAction(END_ACTION, [villagerTask])])
				]
			// }));
		} else if (this.actionType == END_ACTION) {
			//[villagerTask]
			this.aaParams[0].cancel();
		}
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
		this.taskPointer = (this.taskPointer + 1) % this.totalTicks;
	}
}

class Task {
	todo;
	rescheduleDurationInTicks;

	constructor(todo, rescheduleDurationInMs = null) {
		this.todo = todo;
		if (rescheduleDurationInMs == null) {
			return;
		}
		if (rescheduleDurationInMs >= MAX_SCHEDULE_DURATION_MS) {
			throw new Error(`Can't add a rescheduleDurationInMs (${rescheduleDurationInMs}) longer than ${MAX_SCHEDULE_DURATION_MS}`);
		}
		this.rescheduleDurationInTicks = rescheduleDurationInMs / TICK_PERIOD_MS;
	}
}

class OpenBucketQueue {
	// must be a power of 2
	numBuckets = 4;
	buckets:Array<any> = [];
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
tc.getHeuristicCost = (sx, sy, tx, ty) => {
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




const totalTicks = MAX_SCHEDULE_DURATION_MS / TICK_PERIOD_MS;

tc.taskQueue = new TaskQueue(totalTicks);
tc.movables = new Movables()
tc.resourceStacks = new ResourceStacks();
tc.buildings = new Buildings();
tc.dispensers = new Dispensers();
// let resourceRequests = new ResourceRequests();
tc.availableTasks = new AvailableTasks();

// this is the distance diagonally NE/SW in which each diagonal cell isn't a single step away
tc.furthestDiagonalDistance = MAP_WIDTH + MAP_HEIGHT;

tc.doTaskMatchmake = (tickToAssignTo) => {
	tc.taskQueue.addTask(tickToAssignTo, new Task((i) => {
		// console.log("MATCHMAKING");
		// console.log(JSON.stringify(tc.availableTasks.knownTasks[2].length));


		if (!tc.movables.hasIdle) {
			return;
		}

		// there is someone idle so find a task for them to do
		const villagerTask = tc.availableTasks.findHighestPriorityReady();
		if (villagerTask == null) {
			return;
		}

		if (villagerTask instanceof ResourceRequest) {
			// request for resource = find closest villager/resource

			const resource = tc.resourceStacks.findClosestIdleTo(villagerTask.source.entranceX, villagerTask.source.entranceY, villagerTask.resourceId);
			// this would be redundant if we had two separate arrays for knownResources and availableResources
			if (resource == null) {
				return;
			}

			const movable = tc.movables.findClosestIdleTo(resource.resourceStack.floorLocation.x, resource.resourceStack.floorLocation.y)
			// this would be redundant if we had two separate arrays for knownMovables and idleMovables
			if (movable == null) {
				return;
			}

			villagerTask.assignedTo = movable;

			//#region - generate quest for idle villager

			// note that we reseve the resource immediately because if we queue it in an action then 
			// multiple people might try and claim it for themselves at a later time
			resource.reservedForAction = true;
			// villagerTask.isTaken = true;
			movable.task = villagerTask;
			let questStuff = [
				new Action(aStarMovable(movable.x, movable.y, resource.resourceStack.floorLocation.x, resource.resourceStack.floorLocation.y, movable)),
				new Action([new AtomicAction(PICKUP_ACTION, [resource, movable])]),
				new Action(aStarMovable(resource.resourceStack.floorLocation.x, resource.resourceStack.floorLocation.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
				new Action([new AtomicAction(DROPOFF_ACTION, [movable, villagerTask.source, resource.resourceStack.resourceId, true])]),
			];
			movable.quest = questStuff;
			//#endregion

		} else if (villagerTask instanceof BuildRequest) {
			// build = find cosest villager

			const movable = tc.movables.findClosestIdleTo(villagerTask.source.entranceX, villagerTask.source.entranceY)
			// this would be redundant if we had two separate arrays for knownMovables and idleMovables
			if (movable == null) {
				return;
			}

			villagerTask.assignedTo = movable;
			movable.task = villagerTask;
			movable.quest = [
				new Action(aStarMovable(movable.x, movable.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
				new Action([new AtomicAction(BUILD_ACTION, [movable, villagerTask.source])]),
			]
		} else if (villagerTask instanceof FabricationRequest) {
			const movable = tc.movables.findClosestIdleTo(villagerTask.source.entranceX, villagerTask.source.entranceY)
			// this would be redundant if we had two separate arrays for knownMovables and idleMovables
			if (movable == null) {
				return;
			}

			villagerTask.assignedTo = movable;
			movable.task = villagerTask;
			movable.quest = [
				new Action(aStarMovable(movable.x, movable.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
				new Action([new AtomicAction(FABRICATE_ACTION, [movable, villagerTask])]),
			]
		} else if (villagerTask instanceof DispenserFetchRequest) {

			const dispenser = tc.dispensers.findClosestTo(villagerTask.source.entranceX, villagerTask.source.entranceY, villagerTask.resourceId);
			// this would be redundant if we had two separate arrays for knownResources and availableResources
			if (dispenser == null) {
				return;
			}

			const movable = tc.movables.findClosestIdleTo(villagerTask.source.entranceX, villagerTask.source.entranceY)
			// this would be redundant if we had two separate arrays for knownMovables and idleMovables
			if (movable == null) {
				return;
			}

			villagerTask.assignedTo = movable;
			// 0) reserve the dispenser by giving it the villagerTask
			dispenser.taskReservedFor = villagerTask;
			
			movable.task = villagerTask;


			movable.quest = [
				// 1) walk to building (to pick up axe)
				new Action(aStarMovable(movable.x, movable.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
				// 2) walk to closest tree
				new Action(aStarMovable(villagerTask.source.entranceX, villagerTask.source.entranceY, dispenser.x, dispenser.y, movable)),
				// 3) take wood from dispenser
				new Action([new AtomicAction(DISPENSE_ACTION, [dispenser, movable, villagerTask])])
			]
			

			

			

			

			



			// const movable = tc.movables.findClosestIdleTo(villagerTask.source.entranceX, villagerTask.source.entranceY)
			// // this would be redundant if we had two separate arrays for knownMovables and idleMovables
			// if (movable == null) {
			// 	return;
			// }

			// villagerTask.assignedTo = movable;
			// // immediately destroy the input resources
			// villagerTask.source.removeFromHeldResources(villagerTask.fabricationSet.input);
			// movable.task = villagerTask;
			// movable.quest = [
			// 	new Action(aStarMovable(movable.x, movable.y, villagerTask.source.entranceX, villagerTask.source.entranceY, movable)),
			// 	new Action([new AtomicAction(FABRICATE_ACTION, [movable, villagerTask])]),
			// ]

			// //#region - generate quest for idle villager

			

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
// 			movable = tc.movables.findClosestIdleTo(resource.floorLocation.x, resource.floorLocation.y)
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

	const startFlatIdx = helpers.get1DCoordinateFromXYCoordinate(currentMovablePositionX, currentMovablePositionY, MAP_WIDTH);

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
	depthParentHeap[startFlatIdx * 2] = 0; // num steps from start
	depthParentHeap[startFlatIdx * 2 + 1] = -1; // previous cell was non-existant

	// in the 2015 code they have this assigned as a global variable, and it's only 
	// ever read after being written to so it's okay not to even clear it between timed A* is performed
	// how many steps to get to this point
	// note that these must be integers
	let gCosts = new Array(MAP_WIDTH * MAP_HEIGHT);
	// this should be redundant because the array should be initialised with all zeros
	// but it can't hurt to be explicit
	gCosts[startFlatIdx] = 0;

	open.add(startFlatIdx, tc.getHeuristicCost(currentMovablePositionX, currentMovablePositionY, targetX, targetY));
	openBitSet[startFlatIdx] = 1;

	while (open.totalCount > 0) {
		let currentFlatIdx = open.removeMin();

		const { x, y } = helpers.getXYCoordinateFrom1DCoordinate(currentFlatIdx, MAP_WIDTH);



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
			const neighbourFlatIdx = helpers.get1DCoordinateFromXYCoordinate(neighbourX, neighbourY, MAP_WIDTH);

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
					depthParentHeap[neighbourFlatIdx * 2] = depthParentHeap[currentFlatIdx * 2] + 1;
					// link to previous cell, saying "this is where I came from"
					depthParentHeap[neighbourFlatIdx * 2 + 1] = currentFlatIdx;

					// find distance between neighbour and target position
					const heuristicCosts = tc.getHeuristicCost(neighbourX, neighbourY, targetX, targetY);
					open.updateCost(neighbourFlatIdx, oldGCosts + heuristicCosts, newGCosts + heuristicCosts)
				}

			} else {
				// we haven't seen this cell already, so fill in its values as default
				gCosts[neighbourFlatIdx] = newGCosts;
				// current depth is 1 larger than previous cell
				depthParentHeap[neighbourFlatIdx * 2] = depthParentHeap[currentFlatIdx * 2] + 1;
				// link to previous cell, saying "this is where I came from"
				depthParentHeap[neighbourFlatIdx * 2 + 1] = currentFlatIdx;

				openBitSet[neighbourFlatIdx] = 1;

				// find distance between neighbour and target position
				const heuristicCosts = tc.getHeuristicCost(neighbourX, neighbourY, targetX, targetY);
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
			const { x, y } = helpers.getXYCoordinateFrom1DCoordinate(currentFlatIdx, MAP_WIDTH);
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
tc.buildingsMap;

self.onmessage = e => {
	if (e.data.isNewTickTask) {
		// console.log(`>>>>`)
		// console.log(e.data.messageToUser)
		if (e.data.messageToUser.actionType == 'placeBuilding') {
			tc.buildings.add(e.data.messageToUser.currentBuildingIdx, e.data.messageToUser.x, e.data.messageToUser.y)
		}

		return;
	}

	const { movablePositionsSab, gameStateSab, collisionsMapMaskSab, drawableResourcesMapMaskSab, buildingsMapSab, worldObjectsMapSab } = e.data;

	movablePositions = new Uint32Array(movablePositionsSab);
	gameState = new Uint32Array(gameStateSab);
	collisionsMapMask = new Uint8Array(collisionsMapMaskSab);
	tc.resourceStacks.drawableResourcesMapMask = new Uint32Array(drawableResourcesMapMaskSab);
	tc.buildingsMap = new Uint32Array(buildingsMapSab);
	tc.worldObjectsMap = new Uint32Array(worldObjectsMapSab);

	tc.resourceStacks.add(2, 3, 0);
	tc.resourceStacks.add(2, 3, 0);
	tc.resourceStacks.add(2, 10, 10);
	tc.resourceStacks.add(2, 10, 12);
	tc.resourceStacks.add(2, 11, 0);
	tc.resourceStacks.add(2, 12, 1);
	tc.resourceStacks.add(2, 13, 2);
	tc.resourceStacks.add(2, 15, 2);
	tc.resourceStacks.add(2, 8, 0);
	tc.resourceStacks.add(2, 9, 0);
	tc.resourceStacks.add(1, 3, 4);
	tc.resourceStacks.add(1, 2, 5);
	tc.resourceStacks.add(1, 1, 6);
	tc.resourceStacks.add(1, 3, 10);
	// tc.resourceStacks.add(1, 4, 11);
	// tc.resourceStacks.add(1, 5, 12);
	tc.resourceStacks.add(2, 7, 0);

	tc.resourceStacks.add(0, 20, 5);
	tc.resourceStacks.add(0, 21, 5);
	tc.resourceStacks.add(0, 22, 5);
	tc.resourceStacks.add(0, 23, 5);
	tc.resourceStacks.add(0, 24, 5);
	tc.resourceStacks.add(0, 25, 5);
	tc.resourceStacks.add(0, 26, 5);
	tc.resourceStacks.add(0, 27, 5);
	tc.resourceStacks.add(0, 28, 5);
	tc.resourceStacks.add(0, 29, 5);
	tc.resourceStacks.add(0, 30, 5);	
	tc.resourceStacks.add(0, 20, 6);
	tc.resourceStacks.add(0, 21, 6);
	tc.resourceStacks.add(0, 22, 6);
	tc.resourceStacks.add(0, 23, 6);
	tc.resourceStacks.add(0, 24, 6);
	tc.resourceStacks.add(0, 25, 6);
	tc.resourceStacks.add(0, 26, 6);
	tc.resourceStacks.add(0, 27, 6);
	tc.resourceStacks.add(0, 28, 6);
	tc.resourceStacks.add(0, 29, 6);
	tc.resourceStacks.add(0, 30, 6);	



	tc.dispensers.add(new Dispenser(15, 10, 0, 1));
	tc.dispensers.add(new Dispenser(16, 11, 0, 1));
	tc.dispensers.add(new Dispenser(15, 12, 0, 1));
	tc.dispensers.add(new Dispenser(16, 13, 0, 1));
	tc.dispensers.add(new Dispenser(17, 13, 0, 1));
	tc.dispensers.add(new Dispenser(17, 14, 0, 1));
	tc.dispensers.add(new Dispenser(18, 10, 0, 1));
	tc.dispensers.add(new Dispenser(18, 11, 0, 1));
	tc.dispensers.add(new Dispenser(18, 12, 0, 1));
	tc.dispensers.add(new Dispenser(18, 14, 0, 1));
	tc.dispensers.add(new Dispenser(19, 13, 0, 1));
	tc.dispensers.add(new Dispenser(19, 14, 0, 1));

	tc.dispensers.add(new Dispenser(2, 11, 1, 15));
	tc.dispensers.add(new Dispenser(1, 12, 1, 15));

	// let dummyVillager = new Movable([5,3,5,2,4,2,3,2,2,2,2,1]);
	// let dummyVillager2 = new Movable([10,1,9,1,8,1]);
	// let tc.movables = [dummyVillager2, dummyVillager];

	const moveAllMovablesTask = new Task((i) => {
		// console.log(`it's time to move all tc.movables`)

		// check if the movablePositions SAB is accessible
		// 0n is a bigint zero
		// while (Atomics.load(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1) !== 0n) {
		// 	console.log("tick waiting for render to be ready");
		// }

		// lock the movablePositions SAB while working with it
		Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 1);

		for (let i = 0; i < tc.movables.knownMovables.length; i++) {
			// share the current position with the render thread
			// let currentPosition = tc.movables.knownMovables[i].currentLocationXY;

			tc.movables.knownMovables[i].incrementQuest();

			// since each movable doesn't know where it sits in the movablePositions SAB, 
			// we update that here instead of putting it inside of incrementQuest
			movablePositions[i * 2] = tc.movables.knownMovables[i].x;
			movablePositions[i * 2 + 1] = tc.movables.knownMovables[i].y;
		}

		// unlock the movablePositions SAB now that we're done with it
		Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);
	}, 500);

	tc.taskQueue.addTask(0, moveAllMovablesTask);


	let movableOne = new Movable(0, 0, 1);
	tc.movables.add(movableOne)
	// movableOne.quest = [new Action([
	// 	new AtomicAction(MOVE_ACTION, [0,0, movableOne])
	// ])]

	let movableTwo = new Movable(7, 1, 2);
	tc.movables.add(movableTwo)
	// movableTwo.quest = [new Action([
	// 	new AtomicAction(MOVE_ACTION, [7,1, movableTwo]),
	// 	new AtomicAction(MOVE_ACTION, [6,1, movableTwo]),
	// 	new AtomicAction(MOVE_ACTION, [5,1, movableTwo]),
	// 	new AtomicAction(MOVE_ACTION, [4,1, movableTwo]),
	// 	new AtomicAction(MOVE_ACTION, [3,1, movableTwo]),
	// 	new AtomicAction(MOVE_ACTION, [2,1, movableTwo]),
	// 	new AtomicAction(MOVE_ACTION, [1,1, movableTwo])
	// ])];

	let movableThree = new Movable(7, 2, 3);
	tc.movables.add(movableThree)
	// movableThree.quest = [new Action([
	// 	new AtomicAction(MOVE_ACTION, [7,2, movableThree]),
	// 	new AtomicAction(MOVE_ACTION, [6,2, movableThree]),
	// 	new AtomicAction(MOVE_ACTION, [5,2, movableThree]),
	// 	new AtomicAction(MOVE_ACTION, [4,2, movableThree]),
	// 	new AtomicAction(MOVE_ACTION, [3,2, movableThree]),
	// 	new AtomicAction(MOVE_ACTION, [2,2, movableThree]),
	// 	new AtomicAction(MOVE_ACTION, [1,2, movableThree])
	// ])];

	let movableFour = new Movable(10, 8, 4);
	tc.movables.add(movableFour)

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
	//     tc.movables.push(new Movable(path));
	// }
	// console.log(tc.movables);
	//#endregion

	function tick() {
		// console.log('---tick---')
		const startTime = performance.now();

		// this should be in the scheduled tasks for a future tick, not implemented immediately
		if (Atomics.load(gameState, 0) === 1n) {
			console.log('game is paused, skipping tick')
			return;
		}

		// #region - for debug: check if each players position is different from their target position
		// [1,2].forEach((currentDebugUserIndex)=>{
		//     const currentTargetPositionAsXYCoordinate = tc.movables.knownMovables[currentDebugUserIndex].targetPosition
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
		//         let aStarReturn = doAStar(tc.movables.knownMovables[currentDebugUserIndex], x, y);
		//         console.log({aStarReturn});
		//         if (!aStarReturn) {
		//             console.error(`PAUSE`);
		//             clearInterval(refVar);
		//         }
		//     }
		// })
		//#endregion

		tc.taskQueue.doCurrentTasks();

		const endTime = performance.now();
		// console.log(`Tick duration: ${endTime - startTime} ms`);
	}

	tick();
	let refVar = setInterval(tick, TICK_PERIOD_MS);
}