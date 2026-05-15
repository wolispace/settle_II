export const buildingTypes = [
    {
        name: 'woodcutter',
		// the collissionBox and the bbox should be defined for you using a building creator dev tool, not hand-coded ideally
        collisionBox: [
                [0,  0], [-1,  0], [1,  0], 
                [0, -1], [-1, -1], [1, -1],
                [0, -2], [-1, -2], [1, -2],
                [0, -3], 
                [0, -4], 
                [0, -5],
            ],
		bbox: [[-1, -5], [1, -5], [-1, 0], [1,0]],
		entrance: [0, 1],
		constructionResources: 3,
		buildSteps: 20
    },
    {
        name: 'sawmill',
        collisionBox: [
                [0,  0], [-1,  0], [1,  0], 
                [0, -1], [-1, -1], [1, -1],
                [0, -2], [-1, -2], [1, -2],
            ],
		bbox: [[-1, -2], [1, -2], [-1, 0], [1,0]],
		entrance: [0, 1],
		constructionResources: 1,
		buildSteps: 3
    }
]