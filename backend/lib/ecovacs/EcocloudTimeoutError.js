class EcocloudTimeoutError extends Error {
    /**
     * @param {string} cmd The command that was not responded to.
     * @param {object} msg The request data that was not responded to.
     */
    constructor(cmd, msg) {
        super(`request: ${cmd} timed out: ${JSON.stringify(msg)}`);
        this.name = "EcocloudTimeoutError";
    }
}

module.exports = EcocloudTimeoutError;
