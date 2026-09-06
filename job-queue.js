const MAX_CONCURRENT_JOBS = 3;
const MAX_QUEUE_SIZE = 100;
const MAX_HEAVY_JOBS_PER_USER = 2;
const MAX_JOB_RUNTIME_MS = 5 * 60 * 1000;

const jobQueue = [];
let runningJobs = 0;
const userHeavyJobs = new Map();

function processQueue() {
    while (
        runningJobs < MAX_CONCURRENT_JOBS &&
        jobQueue.length > 0
    ) {
        const job = jobQueue.shift();

        runningJobs++;

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();

            console.log(
                "⏱️ Heavy job timeout reached."
            );
        }, MAX_JOB_RUNTIME_MS);

        Promise.resolve()
            .then(() => job.execute(controller.signal))
            .catch((error) => {
                console.error(
                    "Heavy job error:",
                    error.message
                );

                if (job.onError) {
                    job.onError(error).catch((sendError) => {
                        console.error(
                            "Heavy job error reply failed:",
                            sendError.message
                        );
                    });
                }
            })
            .finally(() => {
                clearTimeout(timeout);

                runningJobs--;

                const currentUserJobs =
                    userHeavyJobs.get(job.userId) || 0;

                if (currentUserJobs <= 1) {
                    userHeavyJobs.delete(job.userId);
                } else {
                    userHeavyJobs.set(
                        job.userId,
                        currentUserJobs - 1
                    );
                }

                processQueue();
            });
    }
}

function addJob(userId, execute, onError) {
    const currentUserJobs =
        userHeavyJobs.get(userId) || 0;

    if (
        currentUserJobs >=
        MAX_HEAVY_JOBS_PER_USER
    ) {
        return {
            accepted: false,
            reason: "user_limit",
            position: null
        };
    }

    if (jobQueue.length >= MAX_QUEUE_SIZE) {
        return {
            accepted: false,
            reason: "queue_full",
            position: null
        };
    }

    const position =
        runningJobs < MAX_CONCURRENT_JOBS
            ? 0
            : jobQueue.length + 1;

    userHeavyJobs.set(
        userId,
        currentUserJobs + 1
    );

    jobQueue.push({
        userId,
        execute,
        onError
    });

    processQueue();

    return {
        accepted: true,
        reason: null,
        position
    };
}

function getQueueStatus() {
    function waitForQueueToFinish(timeoutMs = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();

        const checkQueue = () => {
            if (
                runningJobs === 0 &&
                jobQueue.length === 0
            ) {
                resolve(true);
                return;
            }

            if (
                Date.now() - startTime >=
                timeoutMs
            ) {
                resolve(false);
                return;
            }

            setTimeout(
                checkQueue,
                250
            );
        };

        checkQueue();
    });
    }
    return {
        queued: jobQueue.length,
        running: runningJobs,
        maxConcurrent: MAX_CONCURRENT_JOBS,
        maxQueueSize: MAX_QUEUE_SIZE
    };
}

module.exports = {
    addJob,
    getQueueStatus,
    waitForQueueToFinish
};
