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
		constructionResources: {
			2: 3,
			1: 3
		},
		buildSteps: 20,
		maxBuilders: 10,
		fabrications: [{
			input: null, 
			output: 0,
			durationInMs: 2000 
		}],
		outputLocations: {},
		resourcesInDemand: []
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
		constructionResources: {
			2: 1,
			1: 1
		},
		buildSteps: 3,
		maxBuilders: 2,
		fabrications: [{
			input: {
				0: 1
			}, 
			output: {
				2: 1
			},
			durationInMs: 2000
		}],
		outputLocations: {
			2: [1, 1]
		},
		resourcesInDemand: [0]
    }
]