import helpers from '../helpers.js';
import { tc } from '../tickContext.js';
import { MAX_RESOURCES_PER_STACK, MAP_WIDTH, } from '../defs/constants.js';
class ResourceStacks {
    constructor() {
        this.knownResourceStacks = [];
    }
    // assuming always adding 1
    addResource(resourceId, x, y, source = null) {
        return this.addStack(resourceId, x, y).add(source);
    }
    addStack(resourceId, x, y) {
        // loop over existing resourcestacks
        let foundStack = null;
        // check if the location matches the one we're looking for
        for (let i = 0; i < this.knownResourceStacks.length; i++) {
            if (this.knownResourceStacks[i].floorLocation.x == x && this.knownResourceStacks[i].floorLocation.y == y) {
                foundStack = this.knownResourceStacks[i];
                break;
            }
        }
        if (foundStack == null) {
            // if no stack exists at the location we're looking for then create it
            foundStack = new ResourceStack(this, resourceId, x, y);
            this.knownResourceStacks.push(foundStack);
        }
        else if (foundStack.resourceId != resourceId) {
            const err = `Trying to add to a stack of a different type (e.g. wood to a stone stack), this should never happen`;
            console.error(err);
            throw new Error(err);
        }
        else if (foundStack.qty >= MAX_RESOURCES_PER_STACK) {
            const err = `Trying to add more to a stack than it can handle... this may happen so maybe shouldn't be throwing an error like this, but can't think about what that would look like right now`;
            console.error(err);
            throw new Error(err);
        }
        return foundStack;
    }
    // remove(resourceToremove) {
    // 	for (let i = 0; i < this.knownResourceStacks.length; i++) {
    // 		if (this.knownResourceStacks[i].floorLocation.x == resourceToremove.floorLocation.x
    // 			&& this.knownResourceStacks[i].floorLocation.y == resourceToremove.floorLocation.y) {
    // 			this.knownResourceStacks.splice(i, 1);
    // 			return true;
    // 		}
    // 	}
    // 	return false;
    // }
    findClosestIdleTo(x, y, resourceId) {
        let closesDistance = tc.furthestDiagonalDistance;
        let foundResource = null;
        for (let i = 0; i < this.knownResourceStacks.length; i++) {
            if (this.knownResourceStacks[i].resourceId != resourceId) {
                continue;
            }
            const tempFoundResource = this.knownResourceStacks[i].getAvailableResource();
            if (tempFoundResource == null) {
                continue;
            }
            const currentDistance = this.knownResourceStacks[i].getDistanceTo(x, y);
            if (currentDistance < closesDistance) {
                foundResource = tempFoundResource;
                closesDistance = currentDistance;
            }
        }
        return foundResource;
    }
    findResourceStackAt(x, y, resourceId) {
        for (let i = 0; i < this.knownResourceStacks.length; i++) {
            const resourceStack = this.knownResourceStacks[i];
            if (resourceStack.floorLocation.x == x
                && resourceStack.floorLocation.y == y
                && resourceStack.resourceId == resourceId) {
                return resourceStack;
            }
        }
        return null;
    }
    obliterateStack(stack) {
        for (let i = 0; i < this.knownResourceStacks.length; i++) {
            if (this.knownResourceStacks[i].floorLocation.x == stack.floorLocation.x
                && this.knownResourceStacks[i].floorLocation.y == stack.floorLocation.y) {
                if (this.knownResourceStacks[i].floorLocation.resourceId != stack.floorLocation.resourceId) {
                    const err = `It shouldn't be possible to have two stacks taking up the same tile that have different resourceIds`;
                    console.error(err);
                    throw new Error(err);
                }
                this.knownResourceStacks.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    ;
}
class ResourceStack {
    constructor(resourceStacks, resourceId, x, y) {
        this.resources = [];
        this.newResourceID = 0;
        this.owner = null;
        this.resourceStacks = resourceStacks;
        this.resourceId = resourceId;
        this.setLocation(x, y);
    }
    get qty() {
        return this.resources.length;
    }
    add(source = null) {
        const newResource = new Resource(this, source);
        this.resources.push(newResource);
        this.newResourceID++;
        this.syncVisualState();
        return newResource;
    }
    setLocation(x, y) {
        // Atomics.store(this.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(x, y, MAP_WIDTH), helpers.resourceToUint32(this));
        this.floorLocation = { x, y };
        this.syncVisualState();
    }
    getDistanceTo(x, y) {
        return tc.getHeuristicCost(x, y, this.floorLocation.x, this.floorLocation.y);
    }
    removeFromStack(resource) {
        for (let i = 0; i < this.resources.length; i++) {
            if (this.resources[i].resourceID == resource.resourceID) {
                this.resources.splice(i, 1);
                this.syncVisualState();
                if (this.resources.length == 0 && this.owner == null) {
                    tc.resourceStacks.obliterateStack(this);
                }
                return true;
            }
        }
        return false;
    }
    getAvailableResource() {
        for (let i = 0; i < this.resources.length; i++) {
            if (!this.resources[i].reservedForAction) {
                return this.resources[i];
            }
        }
        return null;
    }
    hasUnreservedResources() {
        for (let i = 0; i < this.resources.length; i++) {
            if (this.resources[i].isAvailable) {
                return true;
            }
        }
        return false;
    }
    syncVisualState() {
        Atomics.store(this.resourceStacks.drawableResourcesMapMask, helpers.get1DCoordinateFromXYCoordinate(this.floorLocation.x, this.floorLocation.y, MAP_WIDTH), helpers.resourceToUint32({
            qty: this.resources.length,
            resourceId: this.resourceId
        }));
    }
}
class Resource {
    // resourceId;
    constructor(resourceStack, source) {
        // e.g if a settler is walking to a piece of wood, nobody else can access it
        this.reservedForAction = false;
        this.resourceStack = resourceStack;
        // this.resourceId = resourceID;
        this.source = source;
        tc.doTaskMatchmake(tc.taskQueue.getTickInFuture(1));
    }
    get isAvailable() {
        return this.reservedForAction == false;
    }
    remove() {
        if (this.source) {
            this.source.resourceRemoved(this);
            this.source = null;
        }
        this.resourceStack.removeFromStack(this);
    }
}
export { ResourceStacks, ResourceStack };
