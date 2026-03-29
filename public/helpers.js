export function gridCoordsFromLocalMouse(mouseX, mouseY, leftLimit, topLimit, hexRadius) {
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
}

export function getPixelCenterFromCell(terrainCellX, terrainCellY, HEX_RADIUS) {
    const SQRT3 = 1.73205080757;
    return [
        terrainCellX * HEX_RADIUS * SQRT3 + terrainCellY * HEX_RADIUS * SQRT3 / 2 + HEX_RADIUS,
        terrainCellY * HEX_RADIUS * 1.5 + HEX_RADIUS
    ];
}

export function isWithinRenderRegion(centerPixelX, centerPixelY, leftLimit, rightLimit, topLimit, bottomLimit) {
    return centerPixelX > leftLimit 
        && centerPixelX < rightLimit 
        && centerPixelY > topLimit
        && centerPixelY < bottomLimit
}