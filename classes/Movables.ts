import { tc } from '../tickContext.js';
import { ResourceRequest, BuildRequest, FabricationRequest, DispenserFetchRequest } from './Requests.js';

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

	#quest = [];
	indexOfCurrentQuestAction = 0;
	heldResource = null;

	x;
	y;
	id;
	task;

	constructor(x, y, id) {
		this.x = x;
		this.y = y;
		this.id = id;
		// initialises the movable in an idle state (including the indexOfCurrentQuestAction) 
		this.makeIdle();
	}



	get quest() {
		return this.#quest;
	}


	set quest(quest) {
		this.#quest = quest;
		this.indexOfCurrentQuestAction = 0;
	}

	clearQuestOnly() {
		this.#quest = [];
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
		this.#quest[this.indexOfCurrentQuestAction].incrementAction();

		// we use ?. here because in the process of incrementing the action, we may be deleting the current quest that the movable is working on 
		// (e.g. building a building, and the building is done so the task gets cancelled)
		if (this.#quest[this.indexOfCurrentQuestAction]?.isFinished) {
			this.indexOfCurrentQuestAction += 1;
		}

		// the fabrication request needs to force end itself, it doesn't naturally end upon doing actionable steps because there's a timer gap
		if (this.isFinishedWithQuest && !(this.task instanceof FabricationRequest) && !(this.task instanceof DispenserFetchRequest)) {
			this.task?.cancel();
		}
	}

	get isFinishedWithQuest() {
		return this.indexOfCurrentQuestAction >= this.#quest.length;
	}

	get isIdle() {
		return this.task == undefined // && this.isFinishedWithQuest //&& this.#quest[this.indexOfCurrentQuestAction].isFinished;
	}

	getDistanceTo(x, y) {
		return tc.getHeuristicCost(x, y, this.x, this.y)
	}
}

export { Movables, Movable };