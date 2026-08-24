import { buildingTypes } from '../buildingTypes.js';
import { tc } from '../tickContext.js';
import { ResourceRequest, BuildRequest, FabricationRequest, DispenserFetchRequest } from './Requests.js';
import helpers from '../helpers.js';
import {
	MAP_WIDTH,
	MAX_RESOURCES_PER_STACK
} from '../constants.js';

class Buildings {
	knownBuildings: Array<Building> = [];
	newBuildingID = 0;

	constructor() { }

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
	heldResources = {};
	outfeedResources = {};
	associatedTasks = [];
	

	constructor(buildingIndex, x, y, id) {
		this.buildingIndex = buildingIndex;
		this.x = x;
		this.y = y;
		this.id = id;

		this.updateBuildAmount(buildingTypes[this.buildingIndex].buildSteps);

		for (const [resourceId, resourceQty] of Object.entries(buildingTypes[this.buildingIndex].constructionResources)) {
			for (let i = 0; i < resourceQty; i++) {
				this.addAssociatedTask(tc.availableTasks.add(new ResourceRequest(this, resourceId), 2));
			}
		}
	}

	get entranceX() {
		return this.x + buildingTypes[this.buildingIndex].entrance[0];
	}

	get entranceY() {
		return this.y + buildingTypes[this.buildingIndex].entrance[1];
	}

	getInfeedXY(resourceId) {
		// ideally in the future we would check if the inputLocations has that resourceId as a key, but can't be bothered right now
		let relativePositionArray = buildingTypes[this.buildingIndex].inputLocations[resourceId]
		return [this.x + relativePositionArray[0], this.y + relativePositionArray[1]]
	}

	getOutfeedXY(resourceId) {
		// ideally in the future we would check if the outputLocations has that resourceId as a key, but can't be bothered right now
		let relativePositionArray = buildingTypes[this.buildingIndex].outputLocations[resourceId]
		return [this.x + relativePositionArray[0], this.y + relativePositionArray[1]]
	}

	get remainingBuildSteps() {
		return this.#remainingBuildSteps;
	}

	// we may want the ability to cancel some types of tasks in the future, but not clear when we would want to do this so not implementing right now
	cancelAllTasks() {
		for (let i = this.associatedTasks.length - 1; i >= 0; i--) {
			// if (this.associatedTasks[i].assignedTo) {
			this.associatedTasks[i].cancel();
			// }
		}
		this.associatedTasks = [];
	}

	addAssociatedTask(potentialTask) {
		if (potentialTask) {
			this.associatedTasks.push(potentialTask);
		}
	}

	updateBuildAmount(newBuildSteps) {
		this.#remainingBuildSteps = newBuildSteps;
		const bbox = buildingTypes[this.buildingIndex].bbox;

		Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[0][0], this.y + bbox[0][1], MAP_WIDTH), helpers.buildingToUint32(this, 0));
		Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[1][0], this.y + bbox[1][1], MAP_WIDTH), helpers.buildingToUint32(this, 1));
		Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[2][0], this.y + bbox[2][1], MAP_WIDTH), helpers.buildingToUint32(this, 2));
		Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[3][0], this.y + bbox[3][1], MAP_WIDTH), helpers.buildingToUint32(this, 3));

		if (this.#remainingBuildSteps == 0) {
			this.cancelAllTasks();
			
			// clear the resources so that it's got a fresh slate upon being built
			// this.heldResources = {};
			this.removeFromHeldResources(buildingTypes[this.buildingIndex].constructionResources)

			
			if (buildingTypes[this.buildingIndex].fabrications[0].input == null) {
				this.addAssociatedTask(tc.availableTasks.add(new DispenserFetchRequest(this, buildingTypes[this.buildingIndex].fabrications[0].output), 2));
			} else {
				// as a reminder: resourcesInDemand shouldn't be generated on the fly because
				// there might be several buildings with coal as input, and we don't want to request coal multiple times in those cases
				// and it saves us from having to do static/constant calculations upon each building being built 
				buildingTypes[this.buildingIndex].resourcesInDemand.forEach((resourceId)=>{
					for (let i = 0; i < MAX_RESOURCES_PER_STACK; i++) {
						this.addAssociatedTask(tc.availableTasks.add(new ResourceRequest(this, resourceId), 2));
					}
				})
			}
			
		}
	}

	canBeBuilt() {
		return this.hasResources(buildingTypes[this.buildingIndex].constructionResources);
	}

	hasResources(resourceSet: Record<number, number>) {
		for (const [resourceId, resourceQty] of Object.entries(resourceSet)) {
			// if either it doesn't have any or it doesn't have enough, then early exit
			if (!this.heldResources.hasOwnProperty(resourceId) || this.heldResources[resourceId] < resourceQty) {
				return false;
			}
		}
		return true;
	}

	hasOutputFeedSpace(resourceSet: Record<number, number>) {
		for (const [resourceId, resourceQty] of Object.entries(resourceSet)) {
			// we early exit if both the output stack exists, and also it doesn't have enough space
			if (this.outfeedResources.hasOwnProperty(resourceId) && resourceQty + this.outfeedResources[resourceId].qty > MAX_RESOURCES_PER_STACK) {
				return false;
			}
		}
		return true;
	}

	addToHeldResources(resourceId) {
		if (!this.heldResources.hasOwnProperty(resourceId)) {
			this.heldResources[resourceId] = 1;
		} else {
			this.heldResources[resourceId] += 1;
		}
		let infeedXY = this.getInfeedXY(resourceId);
		Atomics.store(tc.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(infeedXY[0], infeedXY[1], MAP_WIDTH), helpers.resourceToUint32({
			qty: this.heldResources[resourceId],
			resourceId: resourceId
		}));
		console.log(resourceId);
		// if the building is not built
		if (this.#remainingBuildSteps > 0) {
			if (this.canBeBuilt()) {
				// put a call out for builders to build it
				for (let i = 0; i < buildingTypes[this.buildingIndex].maxBuilders; i++) {
					this.addAssociatedTask(tc.availableTasks.add(new BuildRequest(this), 2));
				}
			}
		} else {
			// if the building is built
			this.makeOperationRequestIfPossible();

			// if (this.heldResources[resourceId] < 8) {
			// 	this.addAssociatedTask(tc.availableTasks.add(new DispenserFetchRequest(this, buildingTypes[this.buildingIndex].fabrications[0].output), 2));
			// }
		}
	}

	addToOutfeedResources(resourceId) {
		//#region add it to the outfeed
		let [x,y] = this.getOutfeedXY(resourceId);
		if (!this.outfeedResources.hasOwnProperty(resourceId)) {
			this.outfeedResources[resourceId] = tc.resourceStacks.add(resourceId, x, y, this).resourceStack;
		} else {

			const foundResourceStack = tc.resourceStacks.findResourceStackAt(x, y, resourceId);
			if (!foundResourceStack) {
				tc.resourceStacks.add(resourceId, x, y, this);
			} else {
				foundResourceStack.add();
			}
		}
		//#endregion

		// Atomics.store(tc.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(x,y, MAP_WIDTH), helpers.resourceToUint32({
		// 	qty: this.outfeedResources[resourceId].qty,
		// 	resourceId: resourceId
		// }));

		//#region make new dispense fetch request if appropriate

		// do we have space at the ouput?
		// if (this.outfeedResources[resourceId] < MAX_RESOURCES_PER_STACK) {
		// 	this.makeOperationRequestIfPossible();
		// }
		//#endregion
	}

	// do whatever you do as a building
	makeOperationRequestIfPossible() {

		// only one operation request can be active at a time, so quit if one is already existing 
		for (let i = 0; i < this.associatedTasks.length; i++) {
			if (this.associatedTasks[i] instanceof DispenserFetchRequest ||
				this.associatedTasks[i] instanceof FabricationRequest) {
				return null;
			}
		}

		for (let i = 0; i < buildingTypes[this.buildingIndex].fabrications.length; i++) {
			const fabrication = buildingTypes[this.buildingIndex].fabrications[i];
			if (fabrication.input == null) {
				const fabricationOutputObj = {};
				fabricationOutputObj[fabrication.output as any] = 1;
				if (this.hasOutputFeedSpace(fabricationOutputObj)) {
					this.addAssociatedTask(tc.availableTasks.add(new DispenserFetchRequest(this, fabrication.output), 2));
					// we can only have one operation request at a time, and we've just added one so get outta here
					return;
				}	
			} else if (this.hasResources(fabrication.input) && this.hasOutputFeedSpace(fabrication.output as any)) {
				this.addAssociatedTask(tc.availableTasks.add(new FabricationRequest(this, fabrication), 2));
				// we can only have one operation request at a time, and we've just added one so get outta here
				return;
			}
			
		}
	}

	removeFromHeldResources(resourceSet: Record<number, number>) {
		for (const [resourceId, resourceQty] of Object.entries(resourceSet)) {
			this.heldResources[resourceId] -= resourceQty;
			let infeedXY = this.getInfeedXY(resourceId);
			if (this.heldResources[resourceId] == 0) {
				Atomics.store(tc.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(infeedXY[0], infeedXY[1], MAP_WIDTH), 0xFFFFFFFF);
			} else {
				// console.log("!!!!");
				// console.log('!!!', this.heldResources);
				Atomics.store(tc.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(infeedXY[0], infeedXY[1], MAP_WIDTH), helpers.resourceToUint32({
					qty: this.heldResources[resourceId],
					resourceId: resourceId
				}));
			}
		}
	}

	// removeFromOutfeedResources(resourceSet: Record<number, number>) {
	// 	for (const [resourceId, resourceQty] of Object.entries(resourceSet)) {
	// 		// this.outfeedResources[resourceId] -= resourceQty;
	// 		let outfeedXY = this.getOutfeedXY(resourceId);
	// 		// if (this.outfeedResources[resourceId].qty == 0) {
	// 		// 	Atomics.store(tc.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(outfeedXY[0], outfeedXY[1], MAP_WIDTH), 0xFFFFFFFF);
	// 		// } else {
	// 			// Atomics.store(tc.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(outfeedXY[0], outfeedXY[1], MAP_WIDTH), helpers.resourceToUint32({
	// 			// 	qty: this.outfeedResources[resourceId].qty,
	// 			// 	resourceId: resourceId
	// 			// }));
	// 		// }
	// 	}
	// }

	cancelTask(task) {
		for (let j = 0; j < this.associatedTasks.length; j++) {
			if (this.associatedTasks[j].id == task.id) {
				this.associatedTasks.splice(j, 1)[0];
				break;
			}
		}

		// if you've finished doing one of the operation requests for the building, queue up another one
		if (task instanceof DispenserFetchRequest ||
			task instanceof FabricationRequest) {
			this.makeOperationRequestIfPossible();
		}
	}

	resourceRemoved(resource) {
		// it doesn't matter which one you remove, because they all should have this building as its source
		// and they all should be at the same location, so they're equivalent
		// this.outfeedResources[resource.resourceStack.resourceId]--;
		const objToBeRemoved = {};
		objToBeRemoved[resource.resourceStack.resourceId] = 1;
		this.removeFromHeldResources(objToBeRemoved)
		this.makeOperationRequestIfPossible();
	}
}

export { Buildings, Building };