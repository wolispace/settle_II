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
var _Movable_quest;
import { tc } from '../tickContext.js';
import { FabricationRequest, DispenserFetchRequest } from './Requests.js';
class Movables {
    // idleMovables could exist here
    constructor() {
        this.knownMovables = [];
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
        let closesDistance = tc.furthestDiagonalDistance;
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
    constructor(x, y, id) {
        _Movable_quest.set(this, []);
        this.indexOfCurrentQuestAction = 0;
        this.heldResource = null;
        this.x = x;
        this.y = y;
        this.id = id;
        // initialises the movable in an idle state (including the indexOfCurrentQuestAction) 
        this.makeIdle();
    }
    get quest() {
        return __classPrivateFieldGet(this, _Movable_quest, "f");
    }
    set quest(quest) {
        __classPrivateFieldSet(this, _Movable_quest, quest, "f");
        this.indexOfCurrentQuestAction = 0;
    }
    clearQuestOnly() {
        __classPrivateFieldSet(this, _Movable_quest, [], "f");
        this.indexOfCurrentQuestAction = 1;
    }
    makeIdle() {
        this.y++;
        this.task = undefined;
        this.clearQuestOnly();
        tc.doTaskMatchmake(tc.taskQueue.getTickInFuture(1));
    }
    incrementQuest() {
        // if they have a step to do then do it, but if they don't then don't
        if (this.isFinishedWithQuest) {
            return;
        }
        // if (!this.#quest[this.indexOfCurrentQuestAction]) {
        // 	console.log('hmm no quest?');
        // }
        __classPrivateFieldGet(this, _Movable_quest, "f")[this.indexOfCurrentQuestAction].incrementAction();
        // we use ?. here because in the process of incrementing the action, we may be deleting the current quest that the movable is working on 
        // (e.g. building a building, and the building is done so the task gets cancelled)
        if (__classPrivateFieldGet(this, _Movable_quest, "f")[this.indexOfCurrentQuestAction]?.isFinished) {
            this.indexOfCurrentQuestAction += 1;
        }
        // the fabrication request needs to force end itself, it doesn't naturally end upon doing actionable steps because there's a timer gap
        if (this.isFinishedWithQuest && !(this.task instanceof FabricationRequest) && !(this.task instanceof DispenserFetchRequest)) {
            this.task?.cancel();
        }
    }
    get isFinishedWithQuest() {
        return this.indexOfCurrentQuestAction >= __classPrivateFieldGet(this, _Movable_quest, "f").length;
    }
    get isIdle() {
        return this.task == undefined; // && this.isFinishedWithQuest //&& this.#quest[this.indexOfCurrentQuestAction].isFinished;
    }
    getDistanceTo(x, y) {
        return tc.getHeuristicCost(x, y, this.x, this.y);
    }
}
_Movable_quest = new WeakMap();
export { Movables, Movable };
