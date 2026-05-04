export const buildingTypes = [
    {
        name: 'woodcutter',
        collisionBox: [
                [0,  0], [-1,  0], [1,  0], 
                [0, -1], [-1, -1], [1, -1],
                [0, -2], [-1, -2], [1, -2],
                [0, -3], 
                [0, -4], 
                [0, -5],
            ],
		entrance: [0, 1],
		constructionResources: 3
    },
    {
        name: 'sawmill',
        collisionBox: [
                [0,  0], [-1,  0], [1,  0], 
                [0, -1], [-1, -1], [1, -1],
                [0, -2], [-1, -2], [1, -2],
            ],
		entrance: [0, 1],
		constructionResources: 1
    }
]