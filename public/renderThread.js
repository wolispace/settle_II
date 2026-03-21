
self.onmessage = e => {
    const { gameCanvasOffscreen, boundingCoordinatesSab, scale, widthVal, heightVal } = e.data;

    const boundingCoordinatesArray = new Int32Array(boundingCoordinatesSab); 
    

    ctx = gameCanvasOffscreen.getContext('2d');
    ctx.scale(scale, scale);
    // midtermCanvasContext.globalAlpha = 0.5;
    canvasWidth = widthVal;
    canvasHeight = heightVal;
    // console.log(widthVal);
    // console.log(width);

    const hexRadius = 10;

    
    // gameCanvasOffscreenContext.stroke();

    const numElements = 10;
    const grid = {x: numElements, y: numElements};

    const gridSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * grid.x * grid.y);
    const gridArray = new Uint32Array(gridSab); 
    console.log(gridArray);
    console.log(gridArray.length);

    function step(timestamp) {
        // console.log(Atomics.load(boundingCoordinatesArray, 0));
        // console.log(Atomics.load(boundingCoordinatesArray, 1));
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        
        for (let gridIdx = 0; gridIdx < gridArray.length; gridIdx++) {
            const i = Math.floor(gridIdx/grid.x);
            const j = gridIdx % grid.x;
            ctx.beginPath();
            ctx.arc(
                i * hexRadius * 2 + hexRadius + j * hexRadius - Atomics.load(boundingCoordinatesArray, 0), 
                j * hexRadius * 1.73205080757 + hexRadius - Atomics.load(boundingCoordinatesArray, 1), 
                hexRadius, 
                0, 
                2 * Math.PI);
            ctx.fillStyle = "wheat";
            ctx.fill();
        }
        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

}