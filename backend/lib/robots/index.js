const dreame = require("./dreame");
const ecovacs = require("./ecovacs");
const mock = require("./mock");
const roborock = require("./roborock");
const viomi = require("./viomi");

module.exports = Object.assign({},
    roborock,
    viomi,
    dreame,
    mock,
    ecovacs
);
