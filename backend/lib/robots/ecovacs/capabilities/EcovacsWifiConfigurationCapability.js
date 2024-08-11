const http = require("node:http");
const LinuxWifiConfigurationCapability = require("../../common/linuxCapabilities/LinuxWifiConfigurationCapability");
const ValetudoWifiConfiguration = require("../../../entities/core/ValetudoWifiConfiguration");

// TODO replace with generic Ecovacs Robot
/**
 * @extends LinuxWifiConfigurationCapability<import("../../ecovacs/EcovacsX1OmniValetudoRobot")>
 */
class EcovacsWifiConfigurationCapability extends LinuxWifiConfigurationCapability {
    /**
     * @param {import("../../../entities/core/ValetudoWifiConfiguration")} wifiConfig
     * @returns {Promise<void>}
     */
    async setWifiConfiguration(wifiConfig) {
        if (
            wifiConfig?.ssid === undefined ||
            wifiConfig.credentials?.type !== ValetudoWifiConfiguration.CREDENTIALS_TYPE.WPA2_PSK ||
            wifiConfig.credentials.typeSpecificSettings?.password === undefined
        ) {
            throw new Error("Invalid wifiConfig");
        }
        return new Promise((resolve, reject) => {
            // zero dep HTTP request
            // we can use fetch() in Node 20, but it's labelled experimental
            // this API seems to be only be used in provisioning, so not writing a wrapper around it
            const data = JSON.stringify({
                "td": "SetApConfig",
                "s": wifiConfig.ssid,
                "p": wifiConfig.credentials.typeSpecificSettings.password,
                "u": "xxxxxxxxxxxxxxxx", // user id
                "sc": "xx", // unknown
                "lb": "127.0.0.1", // typically jmq-ngiot-REGION.area.ww.ecouser.net -- TODO use config here
                "i": { "a": "au", "dc": "na", "r": "127.0.0.1", "v": "ww" }, // not sure if this is used
            });

            const options = {
                hostname: "192.168.0.1",
                port: 8888,
                path: "/rcp.do",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(data),
                }
            };

            const req = http.request(options, (res) => {
                let body = "";

                res.on("data", (chunk) => body += chunk.toString("utf8"));

                res.on("end", () => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`HTTP error ${res.statusCode}`));
                    }
                    const parsedBody = JSON.parse(body);
                    if (parsedBody.ret !== "ok") {
                        return reject(new Error("Error during WiFi provisioning: did not receive ok response"));
                    }
                    resolve();
                });
            });
            req.on("error", reject);
            req.end(data);
        });
    }
}


module.exports = EcovacsWifiConfigurationCapability;
