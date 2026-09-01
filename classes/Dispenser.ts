import { tc } from '../tickContext.js';
import helpers from '../helpers.js';
import {
	MAP_WIDTH
} from '../defs/constants.js';

class Dispensers {
	knownDispensers: Record<number, Array<Dispenser>> = {};
	drawableDispensersMapMask;

	constructor() {

	}

	add(dispenser) {
		if (!this.knownDispensers.hasOwnProperty(dispenser.resourceId)) {
			this.knownDispensers[dispenser.resourceId] = [];
		}
		this.knownDispensers[dispenser.resourceId].push(dispenser);
		return dispenser;
	}

	remove(dispenser) {
		for (let i = 0; i < this.knownDispensers[dispenser.resourceId].length; i++) {
			if (this.knownDispensers[dispenser.resourceId][i].x == dispenser.x
				&& this.knownDispensers[dispenser.resourceId][i].y == dispenser.y) {
					this.knownDispensers[dispenser.resourceId].splice(i, 1);
				return true;
			}
		}
		return false;
	}

	findClosestTo(x, y, resourceId): Dispenser | null {
		let closesDistance = tc.furthestDiagonalDistance;
		let foundDispenser: Dispenser | null = null;
		for (let i = 0; i < this.knownDispensers[resourceId].length; i++) {
			if (!this.knownDispensers[resourceId][i].isAvailable) {
				continue;
			}
			const currentDistance = this.knownDispensers[resourceId][i].getDistanceTo(x, y);
			if (currentDistance < closesDistance) {
				foundDispenser = this.knownDispensers[resourceId][i];
				closesDistance = currentDistance;
			}
		}
		return foundDispenser;
	}
}

class Dispenser {
	x;
	y;
	resourceId;
	qty;
	taskReservedFor;

	constructor(x, y, resourceId, qty) {
		this.x = x;
		this.y = y;
		this.resourceId = resourceId;
		this.qty = qty;

		Atomics.store(tc.worldObjectsMap, helpers.get1DCoordinateFromXYCoordinate(this.x, this.y, MAP_WIDTH), this.resourceId);
	}

	get isAvailable() {
		return this.taskReservedFor == undefined;
	}

	reduce() {
		this.qty--
		if (this.qty <= 0) {
			Atomics.store(tc.worldObjectsMap, helpers.get1DCoordinateFromXYCoordinate(this.x, this.y, MAP_WIDTH), 0xFFFFFFFF);
			tc.dispensers.remove(this);
		}
	}

	getDistanceTo(x, y) {
		return tc.getHeuristicCost(x, y, this.x, this.y)
	}
}

export { Dispensers, Dispenser };