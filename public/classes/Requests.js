import { tc } from '../tickContext.js';
class ResourceRequest {
    constructor(source, resourceId) {
        this.source = source;
        this.resourceId = resourceId;
        // tryFindingResourceMatch(this, null, null, taskQueue.getTickInFuture(1));
        tc.doTaskMatchmake(tc.taskQueue.getTickInFuture(1));
    }
    // get isAvailable() {
    // 	return !this.isTaken;
    // }
    setID(id) {
        this.id = id;
    }
    // assume this never gets called unless there are idle villagers, so you're checking for everything else
    get canBeDone() {
        // this will need to be updated when there are more than one type of resource
        for (let i = 0; i < tc.resources.knownResources.length; i++) {
            if (tc.resources.knownResources[i].resourceId == this.resourceId && tc.resources.knownResources[i].isAvailable) {
                return true;
            }
        }
        return false;
    }
    cancel() {
        this.source.cancelTask(this);
        if (this.assignedTo) {
            // remove from person it was assigned to
            this.assignedTo.makeIdle();
        }
        else {
            // remove from backlog of tasks
            tc.availableTasks.cancelTask(this);
        }
    }
}
class BuildRequest {
    constructor(source) {
        this.source = source;
        tc.doTaskMatchmake(tc.taskQueue.getTickInFuture(1));
    }
    setID(id) {
        this.id = id;
    }
    get canBeDone() {
        return this.source.canBeBuilt();
    }
    cancel() {
        this.source.cancelTask(this);
        if (this.assignedTo) {
            // remove from person it was assigned to
            this.assignedTo.makeIdle();
        }
        else {
            // remove from backlog of tasks
            tc.availableTasks.cancelTask(this);
        }
    }
}
class FabricationRequest {
    constructor(source, fabricationSet) {
        this.source = source;
        this.fabricationSet = fabricationSet;
        tc.doTaskMatchmake(tc.taskQueue.getTickInFuture(1));
    }
    setID(id) {
        this.id = id;
    }
    get canBeDone() {
        return this.source.hasResources(this.fabricationSet.input);
    }
    cancel() {
        this.source.cancelTask(this);
        if (this.assignedTo) {
            // remove from person it was assigned to
            this.assignedTo.makeIdle();
        }
        else {
            // remove from backlog of tasks
            tc.availableTasks.cancelTask(this);
        }
    }
}
export { ResourceRequest, BuildRequest, FabricationRequest };
