import { MAX_SCHEDULE_DURATION_MS, TICK_PERIOD_MS } from '../defs/constants.js';
class Task {
    constructor(todo, rescheduleDurationInMs = null) {
        this.todo = todo;
        if (rescheduleDurationInMs == null) {
            return;
        }
        if (rescheduleDurationInMs >= MAX_SCHEDULE_DURATION_MS) {
            throw new Error(`Can't add a rescheduleDurationInMs (${rescheduleDurationInMs}) longer than ${MAX_SCHEDULE_DURATION_MS}`);
        }
        this.rescheduleDurationInTicks = rescheduleDurationInMs / TICK_PERIOD_MS;
    }
}
export { Task };
