const fs = require("fs");
const Logger = require("../Logger");
const path = require("path");
const { createBroker } = require("aedes");

class Ecocloud {
    /**
     * @param {object} options
     * @param {string} options.deviceId The unique Device-id of your robot
     * @param {string} options.mId      Model ID?
     * @param {string} options.resourceId
     * @param {string} options.bindIP "127.0.0.1" on the robot, "0.0.0.0" in development
     * @param {number} options.bindPort 443 on the robot, 1883 in development
     * @param {() => void} options.onConnected  function to call after completing a handshake
     * @param {(msg: any) => boolean} options.onIncomingCloudMessage  function to call for incoming messages
     */
    constructor(options) {
        this.bindIP = options.bindIP;
        this.bindPort = options.bindPort;

        // TODO for some reason Aedes() or new Aedes() complains
        this.aedes = createBroker();

        // TODO
        const server = require("tls").createServer({
            key: fs.readFileSync(path.join(__dirname, "/server.key")),
            cert: fs.readFileSync(path.join(__dirname, "/server.crt")),
        }, this.aedes.handle);

        server.listen(this.bindPort, this.bindIP, () => {
            Logger.info(`Ecocloud is listening on ${this.bindIP}:${this.bindPort}`);
            // aedes.publish({ topic: 'aedes/hello', payload: "I'm broker " + aedes.id })
        });

        server.on("error", (e) => {
            Logger.error("Ecocloud Error: ", e);
        });

        this.aedes.on("subscribe", (subscriptions, client) => {
            Logger.debug(`Ecocloud client: ${client?.id} subscribed to topics: ${subscriptions.map(s => s.topic).join(" ")}`);
        });

        this.aedes.on("unsubscribe", (subscriptions, client) => {
            Logger.debug(`Ecocloud client: ${client?.id} unsubscribed from topics: ${subscriptions.join(" ")}`);
        });

        this.aedes.on("client", (client) => {
            Logger.debug(`Ecocloud client: ${client?.id} connected`);
        });

        this.aedes.on("clientDisconnect", (client) => {
            Logger.debug(`Ecocloud client: ${client?.id} disconnected`);
        });

        this.aedes.on("publish", async (packet, client) => {
            Logger.debug(`Ecocloud client: ${client?.id || "BROKER_" + this.aedes.id} published ${packet.payload.toString()} to ${packet.topic}`);
        });

        this.onIncomingCloudMessage = options.onIncomingCloudMessage;
    }

    handleIncomingCloudMessage(msg) {
        // some default handling.
        //

        // if (!this.onIncomingCloudMessage(msg)) {
        // }
    }

    /**
     * Shutdown Ecocloud
     *
     * @returns {Promise<void>}
     */
    shutdown() {
        return new Promise((resolve, reject) => {
            Logger.debug("Ecocloud shutdown in progress...");

            this.aedes.close(() => {
                Logger.debug("Ecocloud shutdown done");

                resolve();
            });
        });
    }
}

module.exports = Ecocloud;
