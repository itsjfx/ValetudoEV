const capabilities = require("./capabilities");
const Ecocloud = require("../../ecovacs/Ecocloud");
const entities = require("../../entities");
const LinuxWifiScanCapability = require("../common/linuxCapabilities/LinuxWifiScanCapability");
const Logger = require("../../Logger");
const Tools = require("../../utils/Tools");
const ValetudoRobot = require("../../core/ValetudoRobot");
const { MapLayer, PointMapEntity, ValetudoMap } = require("../../entities/map");
const stateAttrs = entities.state.attributes;

// TODO extends EcovacsValetudoRobot
class EcovacsX1OmniValetudoRobot extends ValetudoRobot {
    /**
     *
     * @param {object} options
     * @param {import("../../Configuration")} options.config
     * @param {import("../../ValetudoEventStore")} options.valetudoEventStore
     */
    constructor(options) {
        super(options);
        this.buildMap();

        this.robotConfig = this.config.get("robot");
        this.implConfig = (this.robotConfig && this.robotConfig.implementationSpecificConfig) ?? {};

        this.ecovacsBindIp = this.implConfig["ecovacsBindIp"] ?? (this.config.get("embedded") ? "127.0.0.1" : "0.0.0.0");
        this.ecovacsBindPort = this.implConfig["ecovacsBindPort"] ?? (this.config.get("embedded") ? 443 : 1883);
        this.ecocloud = new Ecocloud({
            deviceId: this.deviceId,
            mId: this.mId,
            resourceId: this.resourceId,
            bindIP: this.ecovacsBindIp,
            bindPort: this.ecovacsBindPort,
            onConnected: async () => {
                // TODO
            },
            onIncomingCloudMessage: this.onIncomingCloudMessage,
        });

        // this.registerCapability(new capabilities.MockWifiConfigurationCapability({robot: this}));
        this.registerCapability(new capabilities.EcovacsWifiConfigurationCapability({
            robot: this,
            networkInterface: "wlan0"
        }));

        if (this.config.get("embedded") === true) {
            this.registerCapability(new LinuxWifiScanCapability({
                robot: this,
                networkInterface: "wlan0"
            }));
        }

        // this.registerCapability(new capabilities.MockBasicControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockCarpetModeControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockConsumableMonitoringCapability({robot: this}));
        // this.registerCapability(new capabilities.MockDoNotDisturbCapability({robot: this}));
        // this.registerCapability(new capabilities.MockFanSpeedControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockWaterUsageControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockSpeakerVolumeControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockSpeakerTestCapability({robot: this}));
        // this.registerCapability(new capabilities.MockKeyLockCapability({robot: this}));
        // this.registerCapability(new capabilities.MockObstacleAvoidanceControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockLocateCapability({robot: this}));
        // this.registerCapability(new capabilities.MockWifiConfigurationCapability({robot: this}));
        // this.registerCapability(new capabilities.MockWifiScanCapability({robot: this}));
        // this.registerCapability(new capabilities.MockGoToLocationCapability({robot: this}));
        // this.registerCapability(new capabilities.MockMapResetCapability({robot: this}));
        // this.registerCapability(new capabilities.MockPersistentMapControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockPendingMapChangeHandlingCapability({robot: this}));
        // this.registerCapability(new capabilities.MockMapSegmentationCapability({robot: this}));
        // this.registerCapability(new capabilities.MockZoneCleaningCapability({robot: this}));
        // this.registerCapability(new capabilities.MockAutoEmptyDockManualTriggerCapability({robot: this}));
        // this.registerCapability(new capabilities.MockAutoEmptyDockAutoEmptyControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockMappingPassCapability({robot: this}));
        // this.registerCapability(new capabilities.MockVoicePackManagementCapability({robot: this}));
        // this.registerCapability(new capabilities.MockManualControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockCurrentStatisticsCapability({robot: this}));
        // this.registerCapability(new capabilities.MockTotalStatisticsCapability({robot: this}));
        // this.registerCapability(new capabilities.MockOperationModeControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockPetObstacleAvoidanceControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockCollisionAvoidantNavigationControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockCarpetSensorModeControlCapability({robot: this}));
        // this.registerCapability(new capabilities.MockMopDockCleanManualTriggerCapability({robot: this}));
        // this.registerCapability(new capabilities.MockMopDockDryManualTriggerCapability({robot: this}));

        // // Raise events to make them visible in the UI
        // options.valetudoEventStore.raise(new DustBinFullValetudoEvent({}));
        // options.valetudoEventStore.raise(new MopAttachmentReminderValetudoEvent({}));
        // options.valetudoEventStore.raise(new PendingMapChangeValetudoEvent({}));
        // options.valetudoEventStore.raise(new ErrorStateValetudoEvent({
        //     message: "This is an error message"
        // }));

        // this.state.upsertFirstMatchingAttribute(new entities.state.attributes.DockStatusStateAttribute({
        //     value: entities.state.attributes.DockStatusStateAttribute.VALUE.IDLE
        // }));
    }

    async pollState() {
        const data = await this.ecocloud.send(Ecocloud.MESSAGE_TYPES.P2P, 'getInfo', ['getStationState', 'getBattery', 'getChargeState', 'getStats'])

        this.parseAndUpdateState(data)

        return this.state;
    }

    parseAndUpdateState(data) {
        if (data.body.data.getBattery && data.body.data.getChargeState) {
            /** @type {import("../../entities/state/attributes/BatteryStateAttribute").BatteryStateAttributeFlag} */
            let flag = stateAttrs.BatteryStateAttribute.FLAG.NONE;

            const level = data.body.data.getBattery.data.value;
            if (data.body.data.getChargeState.data.isCharging === 1) {
                if (level === 100) {
                    flag = stateAttrs.BatteryStateAttribute.FLAG.CHARGED;
                } else {
                    flag = stateAttrs.BatteryStateAttribute.FLAG.CHARGING;
                }
            } else {
                flag = stateAttrs.BatteryStateAttribute.FLAG.DISCHARGING;
            }
            this.state.upsertFirstMatchingAttribute(new stateAttrs.BatteryStateAttribute({
                level,
                flag,
            }));
        }
    }

    onIncomingCloudMessage(msg) {
        // console.log('got packet here', msg)
        return true;
    }

    static IMPLEMENTATION_AUTO_DETECTION_HANDLER() {
        return true;
    }

    // TODO
    // use mdsctl mid
    // TODO stubbed
    get deviceId() {
        return this.implConfig.deviceId;
    }

    get mId() {
        return this.implConfig.mId;
    }

    get resourceId() {
        return this.implConfig.resourceId;
    }

    startup() {
        Logger.info("DeviceId " + this.deviceId);
        Logger.info("Mid " + this.mId);
        Logger.info("ResourceId " + this.resourceId);
    }

    getManufacturer() {
        return "Ecovacs";
    }

    getModelName() {
        return "X1 Omni";
    }

    getModelDetails() {
        return Object.assign(
            {},
            super.getModelDetails(),
            {
                supportedAttachments: [
                    stateAttrs.AttachmentStateAttribute.TYPE.DUSTBIN,
                    stateAttrs.AttachmentStateAttribute.TYPE.WATERTANK,
                    stateAttrs.AttachmentStateAttribute.TYPE.MOP,
                ]
            }
        );
    }

    /**
     * @return {object}
     */
    getProperties() {
        const superProps = super.getProperties();
        const ourProps = {
            [ValetudoRobot.WELL_KNOWN_PROPERTIES.FIRMWARE_VERSION]: Tools.GET_VALETUDO_VERSION()
        };

        return Object.assign(
            {},
            superProps,
            ourProps
        );
    }

    // /**
    //  * @public
    //  */
    // emitStateUpdated() {
    //     super.emitStateUpdated();
    // }

    // /**
    //  * @public
    //  */
    // emitStateAttributesUpdated() {
    //     super.emitStateAttributesUpdated();
    // }

    // /**
    //  * @public
    //  */
    // emitMapUpdated() {
    //     super.emitMapUpdated();
    // }

    /**
     * @public
     */
    buildMap() {
        this.mockMap = {
            size: 5000,
            pixelSize: 5,
            range: {
                min: 200,
                max: 800
            }
        };
        this.state.map = new ValetudoMap({
            metaData: {
                pendingMapChange: true,
            },
            size: {
                x: this.mockMap.size,
                y: this.mockMap.size
            },
            pixelSize: this.mockMap.pixelSize,
            layers: [this.buildFloor(), this.buildWall()],
            entities: [this.buildCharger(), this.buildRobot()]
        });
        this.emitMapUpdated();
    }

    /**
     * @private
     */
    buildFloor() {
        let pixels = [];
        for (let x = this.mockMap.range.min; x <= this.mockMap.range.max; x++) {
            for (let y = this.mockMap.range.min; y <= this.mockMap.range.max; y++) {
                pixels.push(x, y);
            }
        }

        return new MapLayer({
            type: MapLayer.TYPE.FLOOR,
            pixels: pixels
        });
    }

    /**
     * @private
     */
    buildWall() {
        let pixels = [];
        for (let x = this.mockMap.range.min; x <= this.mockMap.range.max; x++) {
            pixels.push(x, this.mockMap.range.min, x, this.mockMap.range.max);
        }
        for (let y = this.mockMap.range.min; y <= this.mockMap.range.max; y++) {
            pixels.push(this.mockMap.range.min, y, this.mockMap.range.max, y);
        }
        return new MapLayer({
            type: MapLayer.TYPE.WALL,
            pixels: pixels
        });
    }

    /**
     * @private
     */
    buildCharger() {
        return new PointMapEntity({
            type: PointMapEntity.TYPE.CHARGER_LOCATION,
            points: [this.mockMap.range.min * this.mockMap.pixelSize + 50, this.mockMap.range.min * this.mockMap.pixelSize]
        });
    }

    /**
     * @private
     */
    buildRobot() {
        return new PointMapEntity({
            type: PointMapEntity.TYPE.ROBOT_POSITION,
            points: [this.mockMap.range.min * this.mockMap.pixelSize + 50, this.mockMap.range.min * this.mockMap.pixelSize + 50],
            metaData: {
                angle: 180
            }
        });
    }

    async shutdown() {
        await super.shutdown();
        await this.ecocloud.shutdown();
    }
}

module.exports = EcovacsX1OmniValetudoRobot;
