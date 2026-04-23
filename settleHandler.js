"use strict";
var taskinatorHandler;
(function (taskinatorHandler) {
    // @ts-ignore
    const { SocketHandler } = require('./SocketHandler.js');
    // @ts-ignore
    let { JSQL } = require('./jsql.js');
    // @ts-ignore
    let dbCredentials = require('./settings.js');
    let db = new JSQL(dbCredentials);
    // need to update the firebase key if we want to validate authentication on the server
    let th = new SocketHandler("jproj.xyz/settle", null);
    // {
    // 	projectID: 745674
    // }
    // {
    // 	projectTitle: 346
    // }
    // {
    // 	taskID: 349857
    // }
    // Format the date to MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
    function getMySqlDateTime(date) {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
            `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    async function userHasPermission(firebaseUserObject, inputObj, permissionAsString) {
        if (firebaseUserObject && inputObj && permissionAsString) {
            let userData;
            console.log(inputObj);
            if (inputObj.hasOwnProperty('projectID')) {
                userData = await db.query(`SELECT u.userID
					FROM Permission p
					JOIN User u ON u.userID = p.userID
					JOIN PermissionName pn ON pn.permissionID = p.permissionID
					WHERE u.userID = ? AND p.projectID = ? AND (pn.permissionTitle = ? OR pn.permissionTitle = 'moderator');`, [firebaseUserObject.user_id, inputObj.projectID, permissionAsString]);
            }
            else if (inputObj.hasOwnProperty('projectTitle')) {
                userData = await db.query(`SELECT u.userID
					FROM Permission p
					JOIN User u ON u.userID = p.userID
					JOIN Project pr ON pr.projectID = p.projectID
					JOIN PermissionName pn ON pn.permissionID = p.permissionID
					WHERE u.userID = ? AND pr.projectTitle = ? AND (pn.permissionTitle = ? OR pn.permissionTitle = 'moderator');`, [firebaseUserObject.user_id, inputObj.projectTitle, permissionAsString]);
            }
            else if (inputObj.hasOwnProperty('taskID')) {
                // if (inputObj.hasOwnProperty('movedID')) {
                // 	inputObj.taskID = inputObj.movedID;
                // }
                userData = await db.query(`SELECT u.userID
					FROM Permission p
					JOIN User u ON u.userID = p.userID
					JOIN PermissionName pn ON pn.permissionID = p.permissionID
					JOIN Task t ON t.projectID = p.projectID
					WHERE u.userID = ? AND t.taskID = ? AND (pn.permissionTitle = ? OR pn.permissionTitle = 'moderator');`, [firebaseUserObject.user_id, inputObj.taskID, permissionAsString]);
            }
            else {
                // not given enough information to find the project
                return false;
            }
            if (userData.length > 0) {
                return true;
            }
        }
        return false;
    }
    // this should be updated to accept an array with more than one value
    // the permission will be assigned, regardless of who performs this command
    // elsewhere you should do a check if the current user has the permissions to change someone elses permissions
    async function assignPermissions(userIDOfPersonBeingChanged, projectID, permissionTitlesArray) {
        // if is compound primary key is already in the table then do nothing
        let sql = `INSERT INTO Permission (userID, projectID, permissionID) VALUES (?, ?, (SELECT permissionID FROM PermissionName WHERE permissionTitle = ?)) ON DUPLICATE KEY UPDATE userID = userID`;
        // this can be updated to accept more than one value in the array
        await db.query(sql, [userIDOfPersonBeingChanged, projectID, permissionTitlesArray[0]]);
    }
    // assume that you've already checked elsewhere that the current user has permission to create a project
    async function getProjectAndCreateIfDoesntExist(userDetails, projectTitle) {
        // a taskID wasn't provided, therefore we're creating a new task
        let projectRow = await db.query('select projectID from Project where projectTitle = ?', [projectTitle]);
        // the project specified doesn't exist so create it
        let projectID;
        if (projectRow.length === 0) {
            let insertObj = await db.query('insert into Project (projectTitle) values (?)', [projectTitle]);
            projectID = insertObj.insertId;
            // assign moderator permissions to user who created the project
            await assignPermissions(userDetails.user_id, projectID, ['moderator']);
        }
        else {
            projectID = projectRow[0]['projectID'];
        }
        return projectID;
    }
    th.on("loggedIn", async (socket, token, inputObj, returnValue) => {
        let userDetails = await th.validate(token);
        if (userDetails) {
            let results = await db.select('User', { 'userID': userDetails.user_id });
            // console.log("???????");
            // console.log(userDetails);
            // // if they're not in the database already then add them
            if (results.length !== 1) {
                returnValue({ error: `not currently configured to handle new members` });
                // 	console.log(userDetails);
                // 	console.log("that is a new user")
                // 	db.insertInto('User',{
                // 		uID: userDetails?.user_id,
                // 		name: userDetails?.name || userDetails?.email?.split('@')[0],
                // 		email: userDetails?.email
                // 	})
                // 	socket.emit('userStatus',"newuser")
            }
            else {
                returnValue(results[0]);
            }
        }
        else {
            returnValue({ error: 'user is not authenticated' });
        }
    });
    th.on('getAllTasks', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        if (userDetails && await userHasPermission(userDetails, inputObj, 'read')) {
            // let sql = `SELECT t.taskID, t.taskTitle, t.taskDescription, t.parentTask, t.maxChildrenToDisplayInitially, CONVERT_TZ(t.hideUntil, 'Australia/Melbourne', 'UTC') AS hideUntil, CONVERT_TZ(t.dueDate, 'Australia/Melbourne', 'UTC') AS dueDate, t.recurranceFreqInDays
            // 	FROM Task AS t 
            // 	JOIN Project AS p ON p.projectID = t.projectID 
            // 	LEFT JOIN Status AS s ON s.statusID = t.taskStatus 
            // 	WHERE p.projectTitle = ? 
            // 	AND (t.taskStatus IS NULL OR s.statusTitle NOT IN('deleted','done'))  
            // 	AND (t.recurranceFreqInDays IS NULL OR t.dueDate IS NULL OR t.dueDate <= CONVERT_TZ(?, 'UTC', 'Australia/Melbourne'))
            // 	ORDER BY 
            // 		CASE 
            // 			WHEN t.dueDate IS NULL THEN 1 
            // 			ELSE 0 
            // 		END, 
            // 		t.dueDate ASC, 
            // 		t.taskOrder`;	
            let sql = `SELECT taskID,
			taskTitle,
			taskDescription,
			parentTask,
			maxChildrenToDisplayInitially,
			recurranceFreqInDays,
			periodicFrequency,
			isAnchoredToLastComplete,
			taskOrder,
			CASE
				WHEN recurranceFreqInDays IS NULL
				  THEN innerHideUntil
				ELSE
				  GREATEST(COALESCE(innerHideUntil, '1000-01-01'), COALESCE(derivedDueDate, '1000-01-01'))
			  END AS derivedHideUntil,
			derivedDueDate
			FROM (SELECT t.*,
				CONVERT_TZ(t.hideUntil, 'Australia/Melbourne', 'UTC') AS innerHideUntil, 
				CASE
					WHEN  t.recurranceFreqInDays IS NOT NULL AND rc.taskCompletedAt IS NOT NULL AND t.isAnchoredToLastComplete = 1
					THEN 
						-- we use GREATEST here in order to allow the date to be set in the future by manually setting the due date
						-- so either it's derived based on the last complete date, or if you push it further out then it's at that further date
						GREATEST(        
							DATE_ADD(
								NOW(6),   -- current timestamp with µ-second resolution
								INTERVAL TIMESTAMPDIFF(
											MICROSECOND,
											NOW() - INTERVAL t.recurranceFreqInDays DAY,
											rc.taskCompletedAt
										) MICROSECOND
							),
							CONVERT_TZ(t.dueDate, 'Australia/Melbourne', 'UTC')
						)
					ELSE CONVERT_TZ(t.dueDate, 'Australia/Melbourne', 'UTC')
				END AS derivedDueDate
				
				FROM Task AS t 
				JOIN Project AS p ON p.projectID = t.projectID 
				LEFT JOIN Status AS s ON s.statusID = t.taskStatus 
				LEFT JOIN (
					SELECT
					tc.*,
					/* 1 = most recent completion, 2 = second‐most, … */
					(
						SELECT COUNT(*) + 1
						FROM TaskCompletion AS tc2
						WHERE tc2.taskCompletedAt > tc.taskCompletedAt
						AND tc2.taskID = tc.taskID
					) AS recencyIndex,
					/* total number of completions for this task */
					(
						SELECT COUNT(*)
						FROM TaskCompletion AS tc3
						WHERE tc3.taskID = tc.taskID
					) AS maxRecencyIndex
					FROM TaskCompletion AS tc
				) AS rc
					ON t.taskID = rc.taskID
					/* if periodicFrequency ≤ maxRecencyIndex use it, otherwise fall back to maxRecencyIndex */
					AND rc.recencyIndex = 
					CASE WHEN t.periodicFrequency <= rc.maxRecencyIndex 
						THEN t.periodicFrequency
						ELSE NULL
					END
				WHERE p.projectTitle = ?
				AND (t.taskStatus IS NULL OR s.statusTitle NOT IN('deleted','done'))  
				/* HAVING is used here so we can reference the derivedDueDate instead of the stored t.dueDate */
				/* but it's now redundant because we're getting tasks even if they're due in the future */
				/* HAVING (t.recurranceFreqInDays IS NULL OR derivedDueDate IS NULL OR derivedDueDate <= CONVERT_TZ(?, 'UTC', 'Australia/Melbourne')) */
			) as base
			ORDER BY 
				CASE 
					WHEN base.derivedDueDate IS NULL 
					THEN 1 
					ELSE 0 
				END, 
				base.derivedDueDate ASC, 
				base.taskOrder;`;
            // since the due date for recurring tasks are both defined and retrieved on the server, they are considered in the server's time zone							
            let results = await db.query(sql, [inputObj.projectTitle, getMySqlDateTime(new Date())]);
            // console.log(results[0]);
            callbackFunction(results);
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
        }
    });
    // this will find any tasks that would otherwise get lost in the system,
    // so they can be alerted to the user
    th.on('getMissingTasks', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        if (userDetails && await userHasPermission(userDetails, inputObj, 'read')) {
            // note that this needs to be updated to get the derivedDueDate values in the same way 
            // the getallTasks endpoint does but you can't be bothered right now because it's not important to your current workflow
            let sql = `SELECT 
				t.taskID, 
				t.taskTitle, 
				t.taskDescription, 
				t.parentTask, 
				t.maxChildrenToDisplayInitially, 
				t.hideUntil, 
				t.dueDate, 
				t.recurranceFreqInDays,
				t.periodicFrequency,
				t.isAnchoredToLastComplete ` +
                `FROM Task AS t ` +
                `JOIN Project AS p ON p.projectID = t.projectID ` +
                `LEFT JOIN Status AS s ON s.statusID = t.taskStatus ` +
                `WHERE p.projectTitle = ? AND (t.taskStatus IS NULL OR s.statusTitle NOT IN('deleted','done'))  ` +
                `ORDER BY t.taskOrder`;
            let allTasks = await db.query(sql, [inputObj.projectTitle]);
            for (let i = 0; i < allTasks.length; i++) {
                let currentTask = allTasks[i];
                // if (currentTask.taskID == 2483) {
                let currentlyObservedTask = currentTask;
                let j = 0;
                let seenTasks = [currentlyObservedTask.taskID];
                while (j < 100 && currentlyObservedTask.parentTask != null) {
                    // note that this needs to be updated to get the derivedDueDate values in the same way 
                    // the getallTasks endpoint does but you can't be bothered right now because it's not important to your current workflow
                    let sql = `SELECT t.taskID, 
						t.taskTitle, 
						t.taskDescription, 
						t.parentTask, 
						t.maxChildrenToDisplayInitially, 
						t.hideUntil, 
						t.dueDate, 
						t.recurranceFreqInDays,
						t.periodicFrequency,
						t.isAnchoredToLastComplete, 
						t.taskStatus, 
						s.statusTitle ` +
                        `FROM Task AS t ` +
                        `JOIN Project AS p ON p.projectID = t.projectID ` +
                        `LEFT JOIN Status AS s ON s.statusID = t.taskStatus ` +
                        `WHERE t.taskID = ? ` +
                        `ORDER BY t.taskOrder`;
                    currentlyObservedTask = (await db.query(sql, [currentlyObservedTask.parentTask]))[0];
                    // console.log(`currently on loop ${j} and the current task is ${currentlyObservedTask.taskID}`);
                    // console.log(currentlyObservedTask.statusTitle);
                    seenTasks.push(currentlyObservedTask.taskID);
                    if (seenTasks.includes(currentlyObservedTask.parentTask)) {
                        console.log(`${currentlyObservedTask.parentTask} is causing a loop`);
                        console.log(seenTasks);
                        callbackFunction(currentlyObservedTask);
                        currentlyObservedTask.parentTask = null;
                    }
                    if (currentlyObservedTask.taskStatus == null || ["deleted", "done"].includes(currentlyObservedTask.statusTitle)) {
                        console.log(`${currentlyObservedTask.taskID} won't be displayed, but has children`);
                        console.log(currentlyObservedTask);
                        callbackFunction(currentlyObservedTask);
                        currentlyObservedTask.parentTask = null;
                    }
                    j++;
                }
                // }
            }
            callbackFunction("null");
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
        }
    });
    // new "toggle hide until visibility" feature makes this redundant
    // th.on('getRecurringTasks',async function(socket, token, inputObj, callbackFunction) {
    // 	let userDetails = await th.validate(token);
    // 	if (userDetails && await userHasPermission(userDetails, inputObj, 'read')) {
    // 		let sql = `SELECT t.taskID, 
    // 			t.taskTitle, 
    // 			t.taskDescription, 
    // 			t.parentTask, 
    // 			t.maxChildrenToDisplayInitially, 
    // 			CONVERT_TZ(t.hideUntil, 'Australia/Melbourne', 'UTC') AS hideUntil, 
    // 			t.recurranceFreqInDays,
    // 			t.periodicFrequency,
    // 			t.isAnchoredToLastComplete,
    // 			CASE
    // 				WHEN  t.recurranceFreqInDays IS NOT NULL AND rc.taskCompletedAt IS NOT NULL AND t.isAnchoredToLastComplete = 1
    // 				THEN DATE_ADD(
    // 						NOW(6),   -- current timestamp with µ-second resolution
    // 						INTERVAL TIMESTAMPDIFF(
    // 									MICROSECOND,
    // 									NOW() - INTERVAL t.recurranceFreqInDays DAY,
    // 									rc.taskCompletedAt
    // 								) MICROSECOND
    // 					)
    // 				ELSE CONVERT_TZ(t.dueDate, 'Australia/Melbourne', 'UTC')
    // 			END AS derivedDueDate
    // 			FROM Task AS t 
    // 			JOIN Project AS p ON p.projectID = t.projectID 
    // 			LEFT JOIN Status AS s ON s.statusID = t.taskStatus 
    // 			LEFT JOIN (
    // 				SELECT
    // 				  tc.*,
    // 				  /* 1 = most recent completion, 2 = second‐most, … */
    // 				  (
    // 					SELECT COUNT(*) + 1
    // 					FROM TaskCompletion AS tc2
    // 					WHERE tc2.taskCompletedAt > tc.taskCompletedAt
    // 					  AND tc2.taskID = tc.taskID
    // 				  ) AS recencyIndex,
    // 				  /* total number of completions for this task */
    // 				  (
    // 					SELECT COUNT(*)
    // 					FROM TaskCompletion AS tc3
    // 					WHERE tc3.taskID = tc.taskID
    // 				  ) AS maxRecencyIndex
    // 				FROM TaskCompletion AS tc
    // 			  ) AS rc
    // 				ON t.taskID = rc.taskID
    // 				/* if periodicFrequency ≤ maxRecencyIndex use it, otherwise fall back to maxRecencyIndex */
    // 				AND rc.recencyIndex = 
    // 				  CASE WHEN t.periodicFrequency <= rc.maxRecencyIndex 
    // 					 THEN t.periodicFrequency
    // 					 ELSE NULL
    // 				  END
    // 			WHERE p.projectTitle = ? 
    // 			AND (t.taskStatus IS NULL OR s.statusTitle NOT IN('deleted','done')) 
    // 			AND t.recurranceFreqInDays IS NOT NULL
    // 			ORDER BY 
    // 				CASE 
    // 					WHEN derivedDueDate IS NULL THEN 1 
    // 					ELSE 0 
    // 				END, 
    // 				derivedDueDate ASC, 
    // 				t.taskOrder`;	
    // 		let results = await db.query(sql, [inputObj.projectTitle]);
    // 		callbackFunction(results);
    // 	} else {
    // 		callbackFunction({error: `user doesn't have permissions to perform this action in this project`});
    // 	}
    // })
    // {
    // projectTitle: string, 
    // }
    // the endpoint only exists to make an empty shell of a task, that can then be updated later
    // returns the ID of the new task that was created
    th.on('insertTask', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        if (userDetails && await userHasPermission(userDetails, inputObj, 'upsert')) {
            inputObj.projectID = await getProjectAndCreateIfDoesntExist(userDetails, inputObj.projectTitle);
            // currently doesn't consider positioning anywhere other than index of 0, but it should
            if (inputObj.hasOwnProperty('atIndex')) {
                // the sql query should be upgraded so that it does this all in one step, but it currently
                // complains about doing a select and insert for the same table in the same command
                let record = await db.query('select min(taskOrder) - 1 as min from Task');
                inputObj.taskOrder = record[0]['min'];
            }
            else {
                // the sql query should be upgraded so that it does this all in one step, but it currently
                // complains about doing a select and insert for the same table in the same command
                let record = await db.query('select max(taskOrder) + 1 as max from Task');
                inputObj.taskOrder = record[0]['max'];
            }
            let sql = 'INSERT INTO Task (taskTitle, taskDescription, taskOrder, projectID)' +
                'values( ?, ?, ?, ?)';
            let results = await db.query(sql, ['if you can see this it probably means that the task title was too long and couldnt be encrypted', '', inputObj.taskOrder, inputObj.projectID]);
            callbackFunction(results);
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
        }
    });
    // {
    // 	taskID: number 
    // 	taskTitle: string,
    // 	taskDescription: string - not provided if updating currently 
    // }
    th.on('updateTask', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        if (userDetails && await userHasPermission(userDetails, inputObj, 'upsert')) {
            // let sql = 'UPDATE Task set taskTitle = ? where taskID = ?';
            let taskID = inputObj.taskID;
            console.log("input:");
            console.log(inputObj);
            let legitemateKeys = ['taskTitle', 'taskDescription', 'maxChildrenToDisplayInitially', 'hideUntil', 'dueDate', 'recurranceFreqInDays', 'periodicFrequency', 'isAnchoredToLastComplete'];
            let filteredObject = Object.fromEntries(Object.entries(inputObj).filter(([key]) => legitemateKeys.includes(key)));
            console.log("filtered:");
            console.log(filteredObject);
            // let results = await db.query(sql, [inputObj.taskTitle, inputObj.taskID]);
            let results = await db.update('Task', filteredObject, `taskID = ?`, [taskID]);
            let dateKeys = ['hideUntil', 'dueDate'];
            for (let i = 0; i < dateKeys.length; i++) {
                let singleDateKey = dateKeys[i];
                console.log(singleDateKey);
                if (Object.keys(filteredObject).includes(singleDateKey) && filteredObject?.[singleDateKey] != null) {
                    console.log(`Setting ${taskID} to be ${singleDateKey} of ${new Date(inputObj[singleDateKey])}`);
                    let sql = `UPDATE Task SET ${singleDateKey} = CONVERT_TZ(?, 'UTC', 'Australia/Melbourne') WHERE taskID = ?`;
                    await db.query(sql, [getMySqlDateTime(new Date(inputObj[singleDateKey])), taskID]);
                }
            }
            // if (Object.keys(filteredObject).includes('dueDate') && filteredObject?.dueDate != null) {
            // 	let sql = "UPDATE Task SET dueDate = CONVERT_TZ(?, 'UTC', 'Australia/Melbourne') WHERE taskID = ?";
            // 	await db.query(sql, [getMySqlDateTime(new Date(inputObj.dueDate)), taskID]);
            // } 
            callbackFunction(results);
            return;
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
            return;
        }
    });
    // // now you're using db.update this could be merged into updateTask
    // th.on('setMaxChildrenToDisplayInitially',async function(socket, token, inputObj, callbackFunction) {
    // 	let userDetails = await th.validate(token);
    // 	// console.log('setMaxChildrenToDisplayInitially');
    // 	// console.log(inputObj);
    // 	if (userDetails && await userHasPermission(userDetails, inputObj, 'upsert')) {
    // 		let sql = 'UPDATE Task set maxChildrenToDisplayInitially = ? where taskID = ?';
    // 		let results = await db.query(sql, [inputObj.maxChildrenToDisplayInitially, inputObj.taskID]);
    // 		callbackFunction(results);
    // 	} else {
    // 		callbackFunction({error: `user doesn't have permissions to perform this action in this project`});
    // 	}
    // })
    th.on('deleteTask', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        if (userDetails && await userHasPermission(userDetails, inputObj, 'delete')) {
            let currentTask = await db.query(`SELECT t.*
											FROM Task AS t
											WHERE t.taskID = ?`, [inputObj.taskID]);
            if (currentTask.length != 1) {
                callbackFunction({ error: `Expecting 1 task with the taskID of ${inputObj.taskID}, but ${currentTask.length} were found.` });
                return;
            }
            console.log(currentTask[0]);
            if (!currentTask[0].hasOwnProperty('recurranceFreqInDays') || currentTask[0].recurranceFreqInDays == null) {
                // this section and the section where we load tasks should be updated to use the new TaskCompletion table
                // so that TaskCompletion is use consistently for recurring and non-recurring tasks, 
                // but you don't have time to implement and test that additional case right now
                // it's a non-recurring task so check if it has children before setting it to be deleted
                let children = await db.query(`SELECT t.*
												FROM Task AS t
												LEFT JOIN Status AS s ON s.statusID = t.taskStatus
												WHERE t.parentTask = ?
												AND s.statusTitle NOT IN ('deleted', 'done')`, [inputObj.taskID]);
                if (children.length == 0) {
                    let sql = "UPDATE Task SET taskStatus = (SELECT statusID FROM Status where statusTitle = 'deleted') where taskID = ?";
                    let results = await db.query(sql, [inputObj.taskID]);
                    callbackFunction(results);
                    return;
                }
                else {
                    callbackFunction({ error: `can't delete tasks that have children` });
                    return;
                }
            }
            else {
                let results;
                console.log("======");
                console.log(inputObj);
                console.log("deleting a recurring task");
                if (currentTask[0]?.isAnchoredToLastComplete) {
                    console.log("that is anchored to last complete (things like cleaning, gardening, gym etc) so store the time that was completed");
                    let sql = "INSERT INTO TaskCompletion (taskID, taskCompletedAt)VALUES (?, CONVERT_TZ(?, 'UTC', 'Australia/Melbourne'));";
                    results = await db.query(sql, [inputObj.taskID, getMySqlDateTime(new Date())]);
                }
                else {
                    console.log("that is NOT anchored to last complete (things like weekly meetings, Coles specials, etc) so update its due date relative to its current due date");
                    let sql = "UPDATE Task SET dueDate = DATE_ADD(dueDate, INTERVAL recurranceFreqInDays DAY) WHERE taskID = ?";
                    results = await db.query(sql, [inputObj.taskID]);
                    // console.log(currentTask);
                    // if (!currentTask.hasOwnProperty("dueDate")) {
                    // 	callbackFunction({error: `tasks that aren't anchored to the last complete date require the dueDate property`});
                    // 	return;
                    // }
                    // // since the due date for recurring tasks are both defined and retrieved on the server, they are considered in the server's time zone
                    // let newDueDate = new Date(currentTask.dueDate);
                    // // set the due date recurranceFreqInDays days in the future
                    // newDueDate.setDate(newDueDate.getDate() + currentTask[0].recurranceFreqInDays);
                    // // Format the date to MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
                    // // const pad = (n) => n.toString().padStart(2, '0');
                    // let sql = "UPDATE Task SET dueDate = CONVERT_TZ(?, 'UTC', 'Australia/Melbourne') WHERE taskID = ?";
                    // results = await db.query(sql, [getMySqlDateTime(newDueDate), inputObj.taskID]);
                    // // let results = await db.update('Task', {'dueDate': getYYYYMMDD(newDueDate)}, `taskID = ?`, [inputObj.taskID]);
                }
                console.log(results);
                callbackFunction(results);
                return;
            }
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
            return;
        }
    });
    // {
    // 	taskID: taskID,
    // 	belowID: taskID,
    // 	aboveID: taskID
    // }
    th.on('reorderTasks', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        if (userDetails && await userHasPermission(userDetails, inputObj, 'upsert')) {
            console.log("*************************");
            console.log(inputObj);
            // {
            //     taskID: 1,
            //     belowID: 9,
            //     aboveID: 
            // }
            //id of thing just moved
            //id of thing above in new position
            //id of thing below in new position
            /**
             * Returns the taskOrder of the given task
             * @param taskID - the id of the task
             */
            async function getTaskOrder(taskID) {
                let sql = 'select taskOrder from Task where taskID in (?)';
                let record = await db.query(sql, [taskID]);
                let taskOrder = record[0]['taskOrder'];
                return taskOrder;
            }
            // get the taskOrders associated with the thing above/below in the new position (they might be null)
            let belowOrder = null;
            // belowID should always be provided, but it will be null if you're adding to the bottom
            if (inputObj.belowID) {
                belowOrder = await getTaskOrder(inputObj.belowID);
            }
            let aboveOrder = null;
            // aboveID should always be provided, but it will be null if you're adding to the top
            if (inputObj.aboveID) {
                aboveOrder = await getTaskOrder(inputObj.aboveID);
            }
            // console.log(belowOrder);
            // console.log(aboveOrder);
            // the trick to this section is that users might not be looking at the full spectrum of tasks at the same time
            // and they might place something at the same taskOrder as something else that isn't currently visisble. 
            // While this in itself isn't a huge problem it will mean that you won't ever be able to confidently place 
            // something in between these two things
            let newMovedOrder;
            if (belowOrder != null && aboveOrder != null) {
                if (belowOrder == aboveOrder) {
                    callbackFunction({ error: "the two values provided have the same order value so you can't put something between them" });
                    return;
                }
                else {
                    // do a breadth first search to find the most appropriate location in the order for the new order
                    let queue = [{ aboveOrder: aboveOrder, belowOrder: belowOrder }];
                    while (queue.length > 0) {
                        // get the first element of the array out, as the emement we're analysing
                        let currentSet = queue.shift();
                        let idealOrder = ((currentSet.aboveOrder - currentSet.belowOrder) / 2) + currentSet.belowOrder;
                        if (idealOrder == currentSet.belowOrder) {
                            console.log("the distance between the two orders is so small that nothing can fit between them");
                            // this MariaDB query will reset the rows, but you don't want to run it automatically yet so here it is to run manually:
                            // SET @seq := -1;
                            // UPDATE Task
                            // SET taskOrder = (@seq := @seq + 1)
                            // ORDER BY taskOrder;
                            callbackFunction({ error: "the distance between the two orders is so small that nothing can fit between them" });
                            return;
                        }
                        // check if this ideal value is already in use
                        let alreadyTaken = await db.query("SELECT t.taskOrder "
                            + "FROM Task as t "
                            + "JOIN Status as s ON t.taskStatus = s.statusID "
                            + "WHERE s.statusTitle != 'deleted' AND t.taskOrder = ?", [
                            idealOrder
                        ]);
                        // if the order isn't already taken, then this is the one we're looking for
                        if (alreadyTaken.length == 0) {
                            newMovedOrder = idealOrder;
                            // console.log(`found ${newMovedOrder}`)
                            break;
                        }
                        else {
                            // otherwise push two new objects at the end of the array, one that goes from lower to middle, and another that goes from middle to upper
                            queue.push({ aboveOrder: currentSet.aboveOrder, belowOrder: idealOrder });
                            queue.push({ aboveOrder: idealOrder, belowOrder: currentSet.belowOrder });
                            // console.log(`not found ${idealOrder}`)
                        }
                    }
                }
            }
            else if (belowOrder != null) {
                // get the largest value in the database and increment by 1
                [{ maxPlusOne: newMovedOrder }] = await db.query("SELECT MAX(taskOrder) + 1 AS maxPlusOne FROM Task");
            }
            else if (aboveOrder != null) {
                // get the smallest value in the database and decrement by 1
                [{ minMinusOne: newMovedOrder }] = await db.query("SELECT MIN(taskOrder) - 1 AS minMinusOne FROM Task");
            }
            else {
                callbackFunction({ error: "something is wrong, neither a lower bound or an upper bound for the new location was provided" });
                return;
            }
            // console.log(`new moved order is:`);
            // console.log(newMovedOrder);
            // set the order of the moved task to be the new $newMovedOrder
            let sql = 'UPDATE Task SET taskOrder = ?, parentTask = ? WHERE taskID = ?';
            let results = await db.query(sql, [
                newMovedOrder,
                inputObj.parentID,
                inputObj.taskID
            ]);
            callbackFunction(results);
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
        }
    });
    // {
    // 	taskID: taskID,
    // 	newParentID: taskID
    //  aboveID: taskID
    // }
    th.on('setParentTo', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        if (userDetails && await userHasPermission(userDetails, inputObj, 'upsert')) {
            let taskQuery = `SELECT t.taskID, p.projectID, t.taskOrder ` +
                `FROM Task AS t ` +
                `JOIN Project AS p ON p.projectID = t.projectID ` +
                `LEFT JOIN Status AS s ON s.statusID = t.taskStatus ` +
                `WHERE t.taskID = ? AND (t.taskStatus IS NULL OR s.statusTitle NOT IN('deleted','done'))  ` +
                `ORDER BY t.taskOrder`;
            // get the current Project of the task being moved, as long as it is not deleted/done
            let [taskDetails] = await db.query(taskQuery, [inputObj.taskID]);
            // get the current Project of the new parentTask, as long as it is not deleted/done
            let [newParentDetails] = await db.query(taskQuery, [inputObj.newParentID]);
            // if the task is being given a new parent in the same project, then...
            if (taskDetails.projectID == newParentDetails.projectID) {
                let newOrder;
                if (inputObj.aboveID) {
                    // get the smallest value in the database and decrement by 1
                    [{ minMinusOne: newOrder }] = await db.query("SELECT MIN(taskOrder) - 1 AS minMinusOne FROM Task");
                }
                else {
                    // keep it the same as it was before
                    newOrder = taskDetails.taskOrder;
                }
                // assign a new parent/order
                let sql = 'UPDATE Task SET parentTask = ?, taskOrder = ? WHERE taskID = ?';
                let results = await db.query(sql, [
                    inputObj.newParentID,
                    newOrder,
                    inputObj.taskID
                ]);
                callbackFunction(results);
            }
            else {
                callbackFunction({ error: `parent doesn't have the same level of visibility as the task being moved` });
            }
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
        }
    });
    // provide it with a projectTitle and it will either create a project if it doesn't already exist
    // or return false if it does already exist
    th.on('createProject', async function (socket, token, inputObj, callbackFunction) {
        let userDetails = await th.validate(token);
        // note that there is intentionally no permission check here because any user can create a project
        if (userDetails) {
            if (inputObj.hasOwnProperty('projectTitle')) {
                let projectID = await getProjectAndCreateIfDoesntExist(userDetails, inputObj.projectTitle);
                callbackFunction(projectID);
            }
            else {
                callbackFunction({ error: `no project title was provided, so can't create a project` });
            }
        }
        else {
            callbackFunction({ error: `user doesn't have permissions to perform this action in this project` });
        }
    });
    // th.on('salutations',async function(socket, token, inputObj, callbackFunction) {
    // 	if (await th.validate(token)) {
    // 		// console.log("yaya")
    // 		// console.log("not me literally be salutated right now");
    // 		// console.log(`the message sent from the server was ${inputObj}`)
    // 		// console.log(`you are now connected via ${socket.conn.transport.name}`);
    // 		// console.log(await jph.validate(token));
    // 		// console.log(this);
    // 		socket.emit("message", "bleep bloop");
    // 		callbackFunction(`now in response I would also like to say ${inputObj}`)
    // 	}
    // })
    // th.on("loggedIn", (socket, token, inputObj, callbackFunction)=>{
    // 	socket.emit('goto',"https://joshprojects.site")
    // })
    // @ts-ignore
    module.exports = th;
})(taskinatorHandler || (taskinatorHandler = {}));
