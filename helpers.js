export default {
    gridCoordsFromLocalMouse(mouseX, mouseY, leftLimit, topLimit, hexRadius) {
        const SQRT3 = 1.73205080757;
        const worldX = mouseX + leftLimit;
        const worldY = mouseY + topLimit;
        const frac_r = (worldY - hexRadius) / (hexRadius * 1.5);
        const frac_q = (worldX - hexRadius - frac_r * hexRadius * SQRT3 / 2) / (hexRadius * SQRT3);
        const frac_s = -frac_q - frac_r;
        let x = Math.round(frac_q);
        let y = Math.round(frac_r);
        let s = Math.round(frac_s);
        const q_diff = Math.abs(x - frac_q);
        const r_diff = Math.abs(y - frac_r);
        const s_diff = Math.abs(s - frac_s);
        if (q_diff > r_diff && q_diff > s_diff) {
            x = -y - s;
        }
        else if (r_diff > s_diff) {
            y = -x - s;
        }
        else {
            s = -x - y;
        }
        return [y, x];
    },
    getPixelCenterFromCell(terrainCellX, terrainCellY, HEX_RADIUS) {
        const SQRT3 = 1.73205080757;
        return [
            terrainCellX * HEX_RADIUS * SQRT3 + terrainCellY * HEX_RADIUS * SQRT3 / 2 + HEX_RADIUS,
            terrainCellY * HEX_RADIUS * 1.5 + HEX_RADIUS
        ];
    },
    isWithinRenderRegion(centerPixelX, centerPixelY, leftLimit, rightLimit, topLimit, bottomLimit) {
        return centerPixelX > leftLimit
            && centerPixelX < rightLimit
            && centerPixelY > topLimit
            && centerPixelY < bottomLimit;
    },
    getXYCoordinateFrom1DCoordinate(index, mapWidth) {
        return {
            y: Math.floor(index / mapWidth),
            x: index % mapWidth
        };
    },
    get1DCoordinateFromXYCoordinate(x, y, mapWidth) {
        return y * mapWidth + x;
    },
    convertCollisionBoxToLocalCoordinates(collisionBox, targetX, targetY) {
        return collisionBox.map(([x, y]) => [x + targetX, y + targetY]);
    },
    xyCellOutOfBounds(x, y, mapWidth, mapHeight) {
        if (x < 0
            || x >= mapWidth
            || y < 0
            || y >= mapHeight) {
            // console.error(`Target is out of bounds`)
            return true;
        }
        return false;
    },
    buildingToUint32(building, cornerIndex) {
        return (((cornerIndex & 0b11) << 30) | // 2 bits shifted by 30 (bits 30-31)
            ((building.buildingIndex & 0xFF) << 22) | // 8 bits shifted by 22 (bits 22-29)
            ((building.remainingBuildSteps & 0xFF) << 14) | // 8 bits shifted by 14 (bits 14-21)
            (building.id & 0x3FFF) // 14 bits at the bottom (bits 0-13)
        ) >>> 0; // Force unsigned 32-bit integer
    },
    uint32ToBuilding(n) {
        return [
            (n >>> 30) & 0b11,
            (n >>> 22) & 0xFF,
            (n >>> 14) & 0xFF,
            n & 0x3FFF // id (14 bits)
        ];
    },
    resourceToUint32(resource) {
        const qty = resource.qty & 0b111; // 3 bits
        const resourceId = (resource.resourceId & 0x1FFFFFFF) << 3; // 29 bits shifted left 3
        return (resourceId | qty) >>> 0; // Force unsigned 32-bit
    },
    uint32ToResource(n) {
        return [
            (n >>> 3) & 0x1FFFFFFF,
            n & 0b111
        ];
    }
};
