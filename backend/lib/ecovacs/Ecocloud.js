const fs = require("fs");
const Logger = require("../Logger");
const path = require("path");
const { createBroker } = require("aedes");
const EcocloudTimeoutError = require("./EcocloudTimeoutError");

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
        this.deviceId = options.deviceId;
        this.mId = options.mId;
        this.resourceId = options.resourceId;
        this.onIncomingCloudMessage = options.onIncomingCloudMessage;
        this.onConnected = options.onConnected;
        this.connected = false;

        this.pendingP2PRequests = {};

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
            // TODO
            // this will always get evaluated
            Logger.debug(`Ecocloud client: ${client?.id || "BROKER_" + this.aedes.id} published on ${packet.topic} with ${packet.payload.toString()}`);

            // internal message or a message from us
            if (!client) {
                return;
            }

            const topic = packet.topic.split('/');
            const [iot, topic_type, cmd] = topic;
            if (iot != 'iot') {
                // not implemented
                return;
            }

            try {
                packet.payload = JSON.parse(packet.payload.toString('utf8'))
            } catch { /* intentional */ }

            // TODO do this better. detect a handshake
            // TODO disconnect if the robot doesn't send a message / keepalive
            if (!this.connected && typeof this.onConnected === "function") {
                this.connected = true;
                this.onConnected();
            }


            if (topic_type === Ecocloud.MESSAGE_TYPES.P2P) {
                // iot/p2p/getInfo/x/y/z/HelperMQClientId-awsna-sts-ngiot-mqsjmq-21/ecosys/1234/p/S1Ty/j
                const msgId = topic[topic.length - 2];
                if (!(msgId in this.pendingP2PRequests)) {
                    // may have happened during a reboot
                    Logger.debug("<< ignoring response for non-pending request", msgId);
                    return;
                }
                const request = this.pendingP2PRequests[msgId];
                delete this.pendingP2PRequests[msgId];
                clearTimeout(request.timeoutId);
                request.resolve(packet.payload);
            } else {
                Logger.debug('unhandled topic type', topic_type);
                return;
            }

            // TODO
            // handle default messages if any, then throw to robot
            this.onIncomingCloudMessage(packet)
        });
    }

    // cloud sends a 4 character alphanumeric request id
    // TOOD semaphore?
    generateMessageId() {
        let messageId = '';
        do {
            for (let i = 0; i < REQUEST_ID_LEN; i++) {
                messageId += REQUEST_ID_CHARS.charAt(Math.floor(Math.random() * REQUEST_ID_CHARS.length));
            }
        } while (messageId in this.pendingP2PRequests);
        // immediately allocate a spot
        this.pendingP2PRequests[messageId] = null;
        return messageId;
    }

    /**
     * @private
     * @param {string} cmd
     * @param {object?} body
     */
    sendP2P(cmd, body) {
        return new Promise((resolve, reject) => {
            // not every message fits this shape
            // but most do
            // TODO see how enforced this is
            const msg = {
                header: {
                    pri: 2,
                    ts: Date.now(),
                    tzm: 600,
                    ver: '0.0.22',
                },
            };
            if (body) {
                msg['body'] = { data: body };
            }
            const msgId = this.generateMessageId();
            this.pendingP2PRequests[msgId] = {
                resolve,
                reject,
                onTimeout: () => {
                    Logger.debug(`request ${msgId} timed out`);
                    delete this.pendingP2PRequests[msgId];
                    reject(new EcocloudTimeoutError(cmd, msg));
                },
                timeout: null,
            }
            // iot/p2p/getMajorMap/HelperMQClientId-awsna-sts-ngiot-mqsjmq-0/ecosys/1234/x/x/x/q/H5sW/j
            // the temptation is high to name HelperMqClientId... an arbitrary name
            // but a firmware upgrade could check for it
            // so try emulate the real topic name as much as possible
            this.publish({
                topic: `iot/p2p/${cmd}/HelperMQClientId-awsna-sts-ngiot-mqsjmq-0/ecosys/1234/${this.deviceId}/${this.mId}/${this.resourceId}/q/${msgId}/j`,
                payload: JSON.stringify(msg),
            })
            .catch(reject)

            this.pendingP2PRequests[msgId].timeoutId = setTimeout(() => this.pendingP2PRequests[msgId].onTimeout(), 500)
        })
    }

    /**
    * @param {EcocloudMessageTypes} type
    * @param {string} cmd
    * @param {object} body
    */
    async send(type, cmd, body) {
        if (type === Ecocloud.MESSAGE_TYPES.P2P) {
            return this.sendP2P(cmd, body);
        } else {
            Logger.debug(`Unhandled message type: ${type}`)
            throw new Error(`Invalid message type: ${type}`);
        }
    }

    //  * @param {import("aedes").PublishPacket} packet
    /**
     *
     * @private
     * @param {object} packet
     * @returns {Promise<void>}
     */
    publish(packet) {
        return new Promise((resolve, reject) => {
            this.aedes.publish(packet, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
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

// cfg, dtgcfg
/**
 *  @typedef {string} EcocloudMessageTypes
 *  @enum {string}
 *
 */
Ecocloud.MESSAGE_TYPES = Object.freeze({
    P2P: "p2p",
    ATR: "atr",
});

const REQUEST_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const REQUEST_ID_LEN = 4;

module.exports = Ecocloud;
