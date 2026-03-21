
self.onmessage = e => {
    const { gameCanvasOffscreen, scale, widthVal, heightVal } = e.data;

    ctx = gameCanvasOffscreen.getContext('2d');
    ctx.scale(scale, scale);
    // midtermCanvasContext.globalAlpha = 0.5;
    canvasWidth = widthVal;
    canvasHeight = heightVal;
    // console.log(widthVal);
    // console.log(width);

    const hexRadius = 10;

    
    // gameCanvasOffscreenContext.stroke();

    const numElements = 2000;
    const grid = {x: numElements, y: numElements};

    
    for (let i = 0; i < grid.x; i++) {
        for (let j = 0; j < grid.y; j++) {
            ctx.beginPath();
            ctx.arc(
                i * hexRadius * 2 + hexRadius + j * hexRadius, 
                j * hexRadius * 1.73205080757 + hexRadius , 
                hexRadius, 
                0, 
                2 * Math.PI);
            ctx.fillStyle = "wheat";
            ctx.fill();
        }
        
    }
    

}