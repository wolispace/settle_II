
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

    const hexRadius = 20;

    
    // gameCanvasOffscreenContext.stroke();

    const numElements = 2000;
    const grid = {x: numElements, y: numElements};
    

    const gridSab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT * grid.x * grid.y);
    const gridArray = new Uint32Array(gridSab); 
    console.log(gridArray);
    console.log(gridArray.length);
    for (let gridIdx = 0; gridIdx < gridArray.length; gridIdx++) {
        gridArray[gridIdx] = Math.random() * 255;
    }

    function step(timestamp) {
        // console.log(Atomics.load(boundingCoordinatesArray, 0));
        // console.log(Atomics.load(boundingCoordinatesArray, 1));
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        const leftLimit = Atomics.load(boundingCoordinatesArray, 0);
        const topLimit = Atomics.load(boundingCoordinatesArray, 1);
        const rightLimit = Atomics.load(boundingCoordinatesArray, 2);
        const bottomLimit = Atomics.load(boundingCoordinatesArray, 3);

        const mouseX = Atomics.load(boundingCoordinatesArray, 4);
        const mouseY = Atomics.load(boundingCoordinatesArray, 5);
        
        for (let gridIdx = 0; gridIdx < gridArray.length; gridIdx++) {
            
            const gridX = Math.floor(gridIdx/grid.x);
            const gridY = gridIdx % grid.x;
            const centerX = gridX * hexRadius * 2 + hexRadius + gridY * hexRadius ;
            const centerY = gridY * hexRadius * 1.73205080757 + hexRadius;
            if (centerX > leftLimit 
                && centerX < rightLimit 
                && centerY > topLimit
                && centerY < bottomLimit) {

                ctx.beginPath();
                ctx.arc(
                    centerX - leftLimit, 
                    centerY - topLimit, 
                    hexRadius, 
                    0, 
                    2 * Math.PI);
                ctx.fillStyle = `rgb(${gridArray[gridIdx]},${gridArray[gridIdx]},${gridArray[gridIdx]})`;
                ctx.fill();

                if (mouseX + leftLimit >= centerX - hexRadius 
                    && mouseY + topLimit > centerY - hexRadius
                    && mouseX + leftLimit < centerX + hexRadius 
                    && mouseY + topLimit < centerY + hexRadius
                ) {
                    ctx.strokeStyle = 'red';
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);

}