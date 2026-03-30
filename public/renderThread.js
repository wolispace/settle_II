import { 
    CAMERA_X_MIN, 
    CAMERA_Y_MIN, 
    CAMERA_X_MAX, 
    CAMERA_Y_MAX, 
    MOUSE_X, 
    MOUSE_Y, 
    HEX_RADIUS,
    MAX_MOVABLES,
    NUM_EXTRA_BITS
} from './constants.js';
import { gridCoordsFromLocalMouse, getPixelCenterFromCell, isWithinRenderRegion } from './helpers.js';

self.onmessage = e => {
    const { gameCanvasOffscreen, boundingCoordinatesSab, movablePositionsSab, scale, widthVal, heightVal } = e.data;

    const boundingCoordinatesArray = new Int32Array(boundingCoordinatesSab); 
    const movablePositions = new Uint32Array(movablePositionsSab); 

    const ctx = gameCanvasOffscreen.getContext('2d');
    ctx.scale(scale, scale);
    // midtermCanvasContext.globalAlpha = 0.5;
    const canvasWidth = widthVal;
    const canvasHeight = heightVal;
    // console.log(widthVal);
    // console.log(width);

    

    
    // gameCanvasOffscreenContext.stroke();

    const numElements = 2000;
    const grid = {x: numElements, y: numElements};
    

    const gridSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * grid.x * grid.y);
    const gridArray = new Uint32Array(gridSab); 

    for (let gridIdx = 0; gridIdx < gridArray.length; gridIdx++) {
        gridArray[gridIdx] = Math.random() * 255;
    }

    const SQRT3_2 = 0.86602540378; 
    const dx = HEX_RADIUS * SQRT3_2; // X-offset (half of the full width)
    const dy = HEX_RADIUS * 0.5;     // Y-offset for the side points

    // let loopcount = 0;

    function step(timestamp) {
        // console.log(`---${loopcount}---`)
        // loopcount++
        // console.log(Atomics.load(boundingCoordinatesArray, 0));
        // console.log(Atomics.load(boundingCoordinatesArray, 1));
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        const leftLimit = Atomics.load(boundingCoordinatesArray, CAMERA_X_MIN);
        const topLimit = Atomics.load(boundingCoordinatesArray, CAMERA_Y_MIN);
        const rightLimit = Atomics.load(boundingCoordinatesArray, CAMERA_X_MAX);
        const bottomLimit = Atomics.load(boundingCoordinatesArray, CAMERA_Y_MAX);

        const mouseX = Atomics.load(boundingCoordinatesArray, MOUSE_X);
        const mouseY = Atomics.load(boundingCoordinatesArray, MOUSE_Y);

        let [y, x] = gridCoordsFromLocalMouse(mouseX, mouseY, leftLimit, topLimit, HEX_RADIUS)
        
        for (let gridIdx = 0; gridIdx < gridArray.length; gridIdx++) {
            
            const terrainCellX = Math.floor(gridIdx/grid.x);
            const terrainCellY = gridIdx % grid.x;

            const [centerPixelX, centerPixelY] = getPixelCenterFromCell(terrainCellX, terrainCellY, HEX_RADIUS);
            
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

            ctx.fillStyle = `rgb(${gridArray[gridIdx]},${gridArray[gridIdx]},${gridArray[gridIdx]})`;
            ctx.fill();

            if (terrainCellX === x && terrainCellY === y) {
                ctx.strokeStyle = 'red';
                ctx.stroke();
            } 
        }
    
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

        Atomics.store(movablePositions, MAX_MOVABLES * 2 + NUM_EXTRA_BITS - 1, 0);

        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

}