import helpers from '../helpers.js';
import { tc } from '../tickContext.js';
import { MAP_WIDTH, } from '../constants.js';
class Resources {
    constructor() {
        this.knownResources = [];
    }
    add(resourceId, x, y, source = null) {
        let newResource = new Resource(this, resourceId, x, y, source);
        this.knownResources.push(newResource);
        return newResource;
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
    findClosestTo(x, y, resourceId) {
        let closesDistance = tc.furthestDiagonalDistance;
        let foundResource = null;
        for (let i = 0; i < this.knownResources.length; i++) {
            if (this.knownResources[i].resourceId != resourceId) {
                continue;
            }
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
    constructor(resources, resourceId, x, y, source = null) {
        this.qty = 1;
        // e.g if a settler is walking to a piece of wood, nobody else can access it
        this.reservedForAction = false;
        this.resources = resources;
        this.resourceId = resourceId;
        this.setLocation(x, y);
        this.source = source;
        tc.doTaskMatchmake(tc.taskQueue.getTickInFuture(1));
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
    setLocation(x, y) {
        Atomics.store(this.resources.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(x, y, MAP_WIDTH), helpers.resourceToUint32(this));
        this.floorLocation = { x, y };
    }
    getDistanceTo(x, y) {
        return tc.getHeuristicCost(x, y, this.floorLocation.x, this.floorLocation.y);
    }
    removeFromWorld() {
        this.qty--;
        if (this.source) {
            this.source.resourceRemoved(this);
            this.source = null;
        }
        if (this.qty == 0) {
            this.resources.remove(this);
            Atomics.store(this.resources.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(this.floorLocation.x, this.floorLocation.y, MAP_WIDTH), 0xFFFFFFFF);
        }
    }
}
export { Resources, Resource };
