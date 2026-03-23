export function gridCoordsFromLocalMouse(mouseX, mouseY, leftLimit, topLimit, hexRadius) {
    const worldX = mouseX + leftLimit;
    const worldY = mouseY + topLimit;

    const fracY = (worldY - hexRadius) / (hexRadius * 1.73205080757);
    const fracX = (worldX - hexRadius - fracY * hexRadius) / (hexRadius * 2);

    const frac_q = fracX;
    const frac_r = fracY;
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
    return [
        terrainCellX * HEX_RADIUS * 2 + HEX_RADIUS + terrainCellY * HEX_RADIUS, 
        terrainCellY * HEX_RADIUS * 1.73205080757 + HEX_RADIUS
    ];
}

export function isWithinRenderRegion(centerPixelX, centerPixelY, leftLimit, rightLimit, topLimit, bottomLimit) {
    return centerPixelX > leftLimit 
        && centerPixelX < rightLimit 
        && centerPixelY > topLimit
        && centerPixelY < bottomLimit
}