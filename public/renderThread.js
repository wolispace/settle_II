import { PLAYER_STATE_ARRAY_INDEXES, HEX_RADIUS, MAX_MOVABLES, NUM_EXTRA_BITS, MAP_WIDTH } from './constants.js';
import helpers from './helpers.js';
import { buildingTypes } from './buildingTypes.js';
function drawHex(ctx, centerPixelX, leftLimit, hexWidthHalf, centerPixelY, topLimit, hexHeight) {
    ctx.beginPath();
    ctx.moveTo(centerPixelX - leftLimit + hexWidthHalf, centerPixelY - topLimit - hexHeight); // Top Right
    ctx.lineTo(centerPixelX - leftLimit + hexWidthHalf, centerPixelY - topLimit + hexHeight); // Bottom Right
    ctx.lineTo(centerPixelX - leftLimit, centerPixelY - topLimit + HEX_RADIUS); // Bottom Point
    ctx.lineTo(centerPixelX - leftLimit - hexWidthHalf, centerPixelY - topLimit + hexHeight); // Bottom Left
    ctx.lineTo(centerPixelX - leftLimit - hexWidthHalf, centerPixelY - topLimit - hexHeight); // Top Left
    ctx.lineTo(centerPixelX - leftLimit, centerPixelY - topLimit - HEX_RADIUS); // Top Point
    ctx.closePath();
}
self.onmessage = async (e) => {
    const { gameCanvasOffscreen, playerStateSab, movablePositionsSab, terrainMapMaskSab, worldObjectsMapSab, collisionsMapMaskSab, drawableResourcesMapMaskSab, buildingsMapSab, scale, widthVal, heightVal } = e.data;
    const worldObjectsMap = new Uint32Array(worldObjectsMapSab);
    const playStateArray = new Int32Array(playerStateSab);
    const movablePositions = new Uint32Array(movablePositionsSab);
    const drawableResourcesMapMask = new Uint32Array(drawableResourcesMapMaskSab);
    const buildingsMap = new Uint32Array(buildingsMapSab);
    const ctx = gameCanvasOffscreen.getContext('2d');
    ctx.scale(scale, scale);
    // midtermCanvasContext.globalAlpha = 0.5;
    const canvasWidth = widthVal;
    const canvasHeight = heightVal;
    // console.log(widthVal);
    // console.log(width);
    // gameCanvasOffscreenContext.stroke();
    const terrainMapMask = new Uint32Array(terrainMapMaskSab);
    const collisionsMapMask = new Uint8Array(collisionsMapMaskSab);
    for (let gridIdx = 0; gridIdx < terrainMapMask.length; gridIdx++) {
        terrainMapMask[gridIdx] = Math.random() * 10; //* 5 + 250;
    }
    const SQRT3_2 = 0.86602540378;
    const hexWidthHalf = HEX_RADIUS * SQRT3_2; // X-offset (half of the full width)
    const hexHeight = HEX_RADIUS * 0.5; // Y-offset for the side points
    let debug = 0;
    // let loopcount = 0;
    // 1. Fetch the image data from the network
    const response = await fetch("https://jproj.xyz/settle/images/tree_02.png");
    // const response = await fetch("https://mdn.github.io/shared-assets/images/examples/rhino.jpg");
    const blob = await response.blob();
    // 2. Decode the blob into a worker-compatible ImageBitmap
    const imgBitmap = await createImageBitmap(blob);
    function step(timestamp) {
        const buildingsSeenThisStep = new Set();
        // console.log(`---${loopcount}---`)
        // loopcount++
        // console.log(Atomics.load(playStateArray, 0));
        // console.log(Atomics.load(playStateArray, 1));
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        const leftLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MIN);
        const topLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MIN);
        const rightLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MAX);
        const bottomLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MAX);
        const mouseXAsPx = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.MOUSE_X);
        const mouseYAsPx = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.MOUSE_Y);
        const [mouseYAsCell, mouseXAsCell] = helpers.gridCoordsFromLocalMouse(mouseXAsPx, mouseYAsPx, leftLimit, topLimit, HEX_RADIUS);
        let buildingHighlightedCells = [];
        const currentBuildingIdx = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.SELECTED_HOUSE_TYPE);
        if (currentBuildingIdx != -1) {
            buildingHighlightedCells = helpers.convertCollisionBoxToLocalCoordinates(buildingTypes[currentBuildingIdx].collisionBox, mouseXAsCell, mouseYAsCell);
            // console.log(buildingHighlightedCells);
        }
        //#region - draw terrain
        for (let gridIdx = 0; gridIdx < terrainMapMask.length; gridIdx++) {
            const currentCellXY = helpers.getXYCoordinateFrom1DCoordinate(gridIdx, MAP_WIDTH);
            const [centerPixelX, centerPixelY] = helpers.getPixelCenterFromCell(currentCellXY.x, currentCellXY.y, HEX_RADIUS);
            if (!helpers.isWithinRenderRegion(centerPixelX, centerPixelY, leftLimit, rightLimit, topLimit, bottomLimit)) {
                continue;
            }
            drawHex(ctx, centerPixelX, leftLimit, hexWidthHalf, centerPixelY, topLimit, hexHeight);
            ctx.fillStyle = `rgb(${152 - terrainMapMask[gridIdx]}, ${217 - terrainMapMask[gridIdx]}, ${134 - terrainMapMask[gridIdx]})`;
            // ctx.fillStyle = `rgb(${terrainMapMask[gridIdx]},${terrainMapMask[gridIdx]},${terrainMapMask[gridIdx]})`;
            ctx.fill();
            if (currentCellXY.x === mouseXAsCell && currentCellXY.y === mouseYAsCell) {
                ctx.strokeStyle = 'red';
                ctx.stroke();
            }
            // do we want to be doing this for every loop? Perhaps just do it once when the current selected mouse cell is being drawn
            for (let k = 0; k < buildingHighlightedCells.length; k++) {
                const currentHighlight = buildingHighlightedCells[k];
                // console.log(currentHighlight);
                if (currentCellXY.x === currentHighlight[0] && currentCellXY.y === currentHighlight[1]) {
                    ctx.fillStyle = `rgb(255, 183, 0, 0.8)`;
                    ctx.fill();
                }
            }
            if (Atomics.load(collisionsMapMask, gridIdx) == 1) {
                // if (debug < 9) {
                // //     console.log()
                //     console.log(gridIdx)
                //     debug += 1;
                // }
                ctx.fillStyle = `rgb(77, 77, 77)`;
                ctx.fill();
            }
            const currentResourceCell = Atomics.load(drawableResourcesMapMask, gridIdx);
            if (currentResourceCell != 0xFFFFFFFF) {
                const [resourceId, resourceQty] = helpers.uint32ToResource(currentResourceCell);
                if (resourceId == 0) {
                    ctx.fillStyle = `#785d31`;
                    ctx.fill();
                }
                else if (resourceId == 1) {
                    ctx.fillStyle = `#777777`;
                    ctx.fill();
                }
                else if (resourceId == 2) {
                    ctx.fillStyle = `#e8e0bc`;
                    ctx.fill();
                }
            }
        }
        //#endregion
        //#region - draw buildings using their corners
        // note that we do this separate to the main loop, otherwise the terrain below the current cell overrides the drawing 
        for (let gridIdx = 0; gridIdx < terrainMapMask.length; gridIdx++) {
            const currentCellXY = helpers.getXYCoordinateFrom1DCoordinate(gridIdx, MAP_WIDTH);
            const currentBuildingCell = Atomics.load(buildingsMap, gridIdx);
            if (currentBuildingCell != 0xFFFFFFFF) {
                // mask out the id
                const currentBuildingID = currentBuildingCell & 0x00003FFF;
                if (!buildingsSeenThisStep.has(currentBuildingID)) {
                    const [cornerIndex, buildingIndex, remainingBuildSteps, id] = helpers.uint32ToBuilding(currentBuildingCell);
                    const calculatedOpacity = (buildingTypes[buildingIndex].buildSteps - remainingBuildSteps) / buildingTypes[buildingIndex].buildSteps;
                    const [newCenterPixelX, newCenterPixelY] = helpers.getPixelCenterFromCell(currentCellXY.x - buildingTypes[buildingIndex].bbox[cornerIndex][0], currentCellXY.y - buildingTypes[buildingIndex].bbox[cornerIndex][1], HEX_RADIUS);
                    drawHex(ctx, newCenterPixelX, leftLimit, hexWidthHalf, newCenterPixelY, topLimit, hexHeight);
                    ctx.globalAlpha = calculatedOpacity;
                    if (buildingIndex == 0) {
                        ctx.fillStyle = `white`;
                    }
                    else {
                        ctx.fillStyle = `orange`;
                    }
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    buildingsSeenThisStep.add(currentBuildingID);
                }
            }
            if (Atomics.load(worldObjectsMap, gridIdx) == 0) {
                const [centerPixelX, centerPixelY] = helpers.getPixelCenterFromCell(currentCellXY.x, currentCellXY.y, HEX_RADIUS);
                // ctx.fillStyle = `#023020`;
                // ctx.fill();
                // 85 x 122
                let treeXOffset = -hexWidthHalf * 0.75;
                let treeYOffset = -HEX_RADIUS * 1.5;
                let treeTopLeftCornerX = centerPixelX - leftLimit - hexWidthHalf + treeXOffset;
                let treeTopLeftCornerY = centerPixelY - topLimit - HEX_RADIUS + treeYOffset;
                ctx.drawImage(imgBitmap, treeTopLeftCornerX, treeTopLeftCornerY, hexWidthHalf * 3, HEX_RADIUS * 3);
                // ctx.drawImage(imgBitmap, 10, 10, hexWidthHalf, 20);
            }
        }
        //#endregion
        //#region - draw movables
        while (Atomics.load(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1) !== 0) {
            // console.log("tick waiting for render to be ready");
        }
        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 1);
        for (let i = 0; i < MAX_MOVABLES; i += 2) {
            const movableCellX = movablePositions[i];
            if (movableCellX == 0xFFFFFFFF) {
                break;
            }
            const movableCellY = movablePositions[i + 1];
            if (movableCellY == 0xFFFFFFFF) {
                let err = `Something is wrong, there is a movable who has a valid X coordinate but not a valid Y coordinate`;
                console.error(err);
                // alert(err);
                break;
            }
            const [centerPixelX, centerPixelY] = helpers.getPixelCenterFromCell(movableCellX, movableCellY, HEX_RADIUS);
            if (!helpers.isWithinRenderRegion(centerPixelX, centerPixelY, leftLimit, rightLimit, topLimit, bottomLimit)) {
                continue;
            }
            ctx.beginPath();
            ctx.arc(centerPixelX - leftLimit, centerPixelY - topLimit, HEX_RADIUS, 0, 2 * Math.PI);
            ctx.fillStyle = `red`;
            ctx.fill();
        }
        //#endregion
        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
};
