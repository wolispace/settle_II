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
        } else if (r_diff > s_diff) {
            y = -x - s;
        } else {
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
            && centerPixelY < bottomLimit
    },

    getXYCoordinateFrom1DCoordinate(index, mapWidth) {
        return { 
            y: Math.floor(index/mapWidth),
            x: index % mapWidth
        } 
    },

    get1DCoordinateFromXYCoordinate(x, y, mapWidth) {
        return y * mapWidth + x;
    },

    convertCollisionBoxToLocalCoordinates(collisionBox, targetX, targetY) {
        return collisionBox.map(([x, y]) => [x + targetX, y + targetY]);
    },

    xyCellOutOfBounds(x, y, mapWidth, mapHeight) {
        // check if the target is within bounds
        // this maybe should be greater than or equal to MAP_WIDTH/HEIGHT, haven't thought about it yet
        // note that this logic doesn't work, can't handle clicking to the left of the map
        // if (   targetX < 0 
        //     || targetX > MAP_WIDTH
        //     || targetY < 0 
        //     || targetY > MAP_HEIGHT) {
        //     console.error(`Target is out of bounds`)
        //     return null;
        // }
    }
};
