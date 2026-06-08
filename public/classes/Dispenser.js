// class Dispensers {
// 	knownDispensers = [];
// 	drawableDispensersMapMask;
// 	constructor() {
// 	}
// 	add(resourceId, x, y, source = null) {
// 		let newResource = new Resource(this, resourceId, x, y, source)
// 		this.knownResources.push(newResource)
// 		return newResource;
// 	}
// 	remove(resourceToremove) {
// 		console.log(resourceToremove);
// 		for (let i = 0; i < this.knownResources.length; i++) {
// 			if (this.knownResources[i].floorLocation.x == resourceToremove.floorLocation.x
// 				&& this.knownResources[i].floorLocation.y == resourceToremove.floorLocation.y) {
// 				this.knownResources.splice(i, 1);
// 				return true;
// 			}
// 		}
// 		return false;
// 	}
// 	findClosestTo(x, y, resourceId) {
// 		let closesDistance = furthestDiagonalDistance;
// 		let foundResource = null;
// 		for (let i = 0; i < this.knownResources.length; i++) {
// 			if (this.knownResources[i].resourceId != resourceId) {
// 				continue;
// 			}
// 			if (!this.knownResources[i].isAvailable) {
// 				continue;
// 			}
// 			const currentDistance = this.knownResources[i].getDistanceTo(x, y);
// 			if (currentDistance < closesDistance) {
// 				foundResource = this.knownResources[i];
// 				closesDistance = currentDistance;
// 			}
// 		}
// 		return foundResource;
// 	}
// }
// class Dispenser {
// 	constructor() {
// 	}
// }
