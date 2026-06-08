var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var _Building_remainingBuildSteps;
import { buildingTypes } from '../buildingTypes.js';
import { tc } from '../tickContext.js';
import { ResourceRequest, BuildRequest, FabricationRequest, DispenserFetchRequest } from './Requests.js';
import helpers from '../helpers.js';
import { MAP_WIDTH, MAX_RESOURCES_PER_STACK } from '../constants.js';
class Buildings {
    constructor() {
        this.knownBuildings = [];
        this.newBuildingID = 0;
    }
    add(buildingIndex, x, y) {
        this.knownBuildings.push(new Building(buildingIndex, x, y, this.newBuildingID));
        this.newBuildingID++;
    }
}
class Building {
    constructor(buildingIndex, x, y, id) {
        _Building_remainingBuildSteps.set(this, void 0);
        this.heldResources = {};
        this.outfeedResources = {};
        this.associatedTasks = [];
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
    get remainingBuildSteps() {
        return __classPrivateFieldGet(this, _Building_remainingBuildSteps, "f");
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
        __classPrivateFieldSet(this, _Building_remainingBuildSteps, newBuildSteps, "f");
        const bbox = buildingTypes[this.buildingIndex].bbox;
        Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[0][0], this.y + bbox[0][1], MAP_WIDTH), helpers.buildingToUint32(this, 0));
        Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[1][0], this.y + bbox[1][1], MAP_WIDTH), helpers.buildingToUint32(this, 1));
        Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[2][0], this.y + bbox[2][1], MAP_WIDTH), helpers.buildingToUint32(this, 2));
        Atomics.store(tc.buildingsMap, helpers.get1DCoordinateFromXYCoordinate(this.x + bbox[3][0], this.y + bbox[3][1], MAP_WIDTH), helpers.buildingToUint32(this, 3));
        if (__classPrivateFieldGet(this, _Building_remainingBuildSteps, "f") == 0) {
            this.cancelAllTasks();
            // clear the resources so that it's got a fresh slate upon being built
            this.heldResources = {};
            buildingTypes[this.buildingIndex].resourcesInDemand.forEach((resourceId) => {
                this.addAssociatedTask(tc.availableTasks.add(new ResourceRequest(this, resourceId), 2));
            });
        }
    }
    canBeBuilt() {
        return this.hasResources(buildingTypes[this.buildingIndex].constructionResources);
    }
    hasResources(resourceSet) {
        for (const [resourceId, resourceQty] of Object.entries(resourceSet)) {
            // if either it doesn't have any or it doesn't have enough, then early exit
            if (!this.heldResources.hasOwnProperty(resourceId) || this.heldResources[resourceId] < resourceQty) {
                return false;
            }
        }
        return true;
    }
    hasOutputFeedSpace(resourceSet) {
        for (const [resourceId, resourceQty] of Object.entries(resourceSet)) {
            // we early exit if both the output stack exists, and also it doesn't have enough space
            if (this.outfeedResources.hasOwnProperty(resourceId) && resourceQty + this.outfeedResources[resourceId] > MAX_RESOURCES_PER_STACK) {
                return false;
            }
        }
        return true;
    }
    addToHeldResources(resourceId) {
        if (!this.heldResources.hasOwnProperty(resourceId)) {
            this.heldResources[resourceId] = 1;
        }
        else {
            this.heldResources[resourceId] += 1;
        }
        console.log(resourceId);
        // if the building is not built
        if (__classPrivateFieldGet(this, _Building_remainingBuildSteps, "f") > 0) {
            if (this.canBeBuilt()) {
                // put a call out for builders to build it
                for (let i = 0; i < buildingTypes[this.buildingIndex].maxBuilders; i++) {
                    this.addAssociatedTask(tc.availableTasks.add(new BuildRequest(this), 2));
                }
            }
        }
        else {
            // if the building is built
            this.makeOperationRequestIfPossible();
        }
    }
    addToOutfeedResources(resource) {
        if (!this.outfeedResources.hasOwnProperty(resource.resourceId)) {
            this.outfeedResources[resource.resourceId] = 1;
        }
        else {
            this.outfeedResources[resource.resourceId]++;
        }
    }
    makeOperationRequestIfPossible() {
        buildingTypes[this.buildingIndex].fabrications.forEach((fabrication) => {
            if (fabrication.input == null) {
                this.addAssociatedTask(tc.availableTasks.add(new DispenserFetchRequest(this, fabrication.output), 2));
            }
            else if (this.hasResources(fabrication.input) && this.hasOutputFeedSpace(fabrication.output)) {
                this.addAssociatedTask(tc.availableTasks.add(new FabricationRequest(this, fabrication), 2));
            }
        });
    }
    removeFromHeldResources(resourceSet) {
        for (const [resourceId, resourceQty] of Object.entries(resourceSet)) {
            this.heldResources[resourceId] -= resourceQty;
        }
    }
    cancelTask(task) {
        for (let j = 0; j < this.associatedTasks.length; j++) {
            if (this.associatedTasks[j].id == task.id) {
                return this.associatedTasks.splice(j, 1)[0];
            }
        }
    }
    resourceRemoved(resource) {
        // it doesn't matter which one you remove, because they all should have this building as its source
        // and they all should be at the same location, so they're equivalent
        this.outfeedResources[resource.resourceId]--;
        this.makeOperationRequestIfPossible();
    }
}
_Building_remainingBuildSteps = new WeakMap();
export { Buildings, Building };
