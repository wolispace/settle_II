Settle IID (maybe)

Next steps:
- put a single "character" in
- give the single character a predefined path to follow
- in the logic thread, create a game loop, which runs every 25ms and processes a queue of tasks
- every 3 game loops, update the players position along their a path
- render the characters position in the animation loop
- scale it up so you now have 20_000 characters following their path


- put a HUD in allowing you to place a building
- define coordinates for building cells relative to current mouse position
- upon selecting a building, highlight the cells relative to the current mouse position
- add a second building type/size so that what we are developing is dynamic
- make an grid that stores building data
- upon clicking to build, add the currently selected building data to the currently selected location
- permanently draw that building at that location from now on
- for testing, make a button to allow you to identify a target destination for the character
- implement bucketed A* algorithm to find a path for character between current location and new location
- highlight all cells on the path to the target



Later steps:
- implement zooming