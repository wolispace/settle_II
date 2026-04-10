import { 
    PLAYER_STATE_ARRAY_INDEXES, 
    HEX_RADIUS,
    MAX_MOVABLES,
    NUM_EXTRA_BITS,
    MAP_HEIGHT,
    MAP_WIDTH
} from './constants.js';
import { 
    gridCoordsFromLocalMouse, 
    getPixelCenterFromCell, 
    isWithinRenderRegion,
    getXYCoordinateFrom1DCoordinate } from './helpers.js';
import { buildings } from './buildings.js';

self.onmessage = e => {
    const { gameCanvasOffscreen, playerStateSab, movablePositionsSab, terrainMapMaskSab, scale, widthVal, heightVal } = e.data;

    const playStateArray = new Int32Array(playerStateSab); 
    const movablePositions = new Uint32Array(movablePositionsSab); 

    const ctx = gameCanvasOffscreen.getContext('2d');
    ctx.scale(scale, scale);
    // midtermCanvasContext.globalAlpha = 0.5;
    const canvasWidth = widthVal;
    const canvasHeight = heightVal;
    // console.log(widthVal);
    // console.log(width);

    

    
    // gameCanvasOffscreenContext.stroke();



    
    const terrainMapMask = new Uint32Array(terrainMapMaskSab); 
    const collisionsMapMask = new UTIN

    for (let gridIdx = 0; gridIdx < terrainMapMask.length; gridIdx++) {
        terrainMapMask[gridIdx] = Math.random() * 255;
    }

    const SQRT3_2 = 0.86602540378; 
    const dx = HEX_RADIUS * SQRT3_2; // X-offset (half of the full width)
    const dy = HEX_RADIUS * 0.5;     // Y-offset for the side points

    // let loopcount = 0;

    function step(timestamp) {
        // console.log(`---${loopcount}---`)
        // loopcount++
        // console.log(Atomics.load(playStateArray, 0));
        // console.log(Atomics.load(playStateArray, 1));
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        const leftLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MIN);
        const topLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MIN);
        const rightLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_X_MAX);
        const bottomLimit = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.CAMERA_Y_MAX);

        const mouseXAsPx = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.MOUSE_X);
        const mouseYAsPx = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.MOUSE_Y);

        const [mouseYAsCell, mouseXAsCell] = gridCoordsFromLocalMouse(mouseXAsPx, mouseYAsPx, leftLimit, topLimit, HEX_RADIUS)
        
        let buildingHighlightedCells = [];
        const currentBuildingIdx = Atomics.load(playStateArray, PLAYER_STATE_ARRAY_INDEXES.SELECTED_HOUSE_TYPE);

        if (currentBuildingIdx != -1) {
            buildingHighlightedCells = buildings[currentBuildingIdx].collisionBox.map(([x, y]) => [x + mouseXAsCell, y + mouseYAsCell]);
            // console.log(buildingHighlightedCells);
        }

        //#region - draw terrain
        
        for (let gridIdx = 0; gridIdx < terrainMapMask.length; gridIdx++) {
            
            const terrainCell = getXYCoordinateFrom1DCoordinate(gridIdx, MAP_WIDTH);

            const [centerPixelX, centerPixelY] = getPixelCenterFromCell(terrainCell.x, terrainCell.y, HEX_RADIUS);
            
            if (!isWithinRenderRegion(centerPixelX, centerPixelY, leftLimit, rightLimit, topLimit, bottomLimit)) {
                continue;
            }

            ctx.beginPath();
            // We explicitly map out the 6 points clockwise, starting from Top-Right
            ctx.moveTo(centerPixelX - leftLimit + dx, centerPixelY - topLimit - dy); // Top Right
            ctx.lineTo(centerPixelX - leftLimit + dx, centerPixelY - topLimit + dy); // Bottom Right
            ctx.lineTo(centerPixelX - leftLimit,      centerPixelY - topLimit + HEX_RADIUS);  // Bottom Point
            ctx.lineTo(centerPixelX - leftLimit - dx, centerPixelY - topLimit + dy); // Bottom Left
            ctx.lineTo(centerPixelX - leftLimit - dx, centerPixelY - topLimit - dy); // Top Left
            ctx.lineTo(centerPixelX - leftLimit,      centerPixelY - topLimit - HEX_RADIUS);  // Top Point
            ctx.closePath();

            ctx.fillStyle = `rgb(${terrainMapMask[gridIdx]},${terrainMapMask[gridIdx]},${terrainMapMask[gridIdx]})`;
            ctx.fill();

            if (terrainCell.x === mouseXAsCell && terrainCell.y === mouseYAsCell) {
                ctx.strokeStyle = 'red';
                ctx.stroke();

            } 
            
            // do we want to be doing this for every loop? Perhaps just do it once when the current selected mouse cell is being drawn
            for (let k = 0; k < buildingHighlightedCells.length; k++) {
                const currentHighlight = buildingHighlightedCells[k];
                // console.log(currentHighlight);
                if (terrainCell.x === currentHighlight[0] && terrainCell.y === currentHighlight[1]) {
                    ctx.fillStyle = `rgb(255,255,0,0.5)`;
                    ctx.fill();
                }
            }

            
            
            
        }
        //#endregion
    
        //#region - draw movables
        while (Atomics.load(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1) !== 0) {
            // console.log("tick waiting for render to be ready");
        }

        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 1);
        for (let i = 0; i < MAX_MOVABLES; i+=2) {
            
            const movableCellX = movablePositions[i];
            if (movableCellX == 0xFFFFFFFF) {
                break;
            }
            const movableCellY = movablePositions[i+1];
            if (movableCellY == 0xFFFFFFFF) {
                let err = `Something is wrong, there is a movable who has a valid X coordinate but not a valid Y coordinate`;
                console.error(err);
                // alert(err);
                break;
            }
            
            const [centerPixelX, centerPixelY] = getPixelCenterFromCell(movableCellX, movableCellY, HEX_RADIUS);

            if (!isWithinRenderRegion(centerPixelX, centerPixelY, leftLimit, rightLimit, topLimit, bottomLimit)) {
                continue;
            }

            ctx.beginPath();
            ctx.arc(
                centerPixelX - leftLimit, 
                centerPixelY - topLimit, 
                HEX_RADIUS, 
                0, 
                2 * Math.PI);
            ctx.fillStyle = `yellow`;
            ctx.fill();
        }
        //#endregion

        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);

        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

}