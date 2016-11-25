var SerialPort = require('serialport');

var getPorts = function getPorts() {
  return new Promise(function (resolve, reject) {
    SerialPort.list(function (err, ports) {
      if (err) {
        reject(err);
      }

      resolve(ports);
    });
  });
};

var getArduinoPorts = function () {
  return getPorts().then(function (ports) {
    return (ports || []).filter(function (port) {
      return port.manufacturer.indexOf("Arduino") > -1;
    });
  })
}

var getFirstArduinoPort = function () {
  return getArduinoPorts().then(function (ports) {
    return ports[0] || null;
  });
}

var openPort = function (portName, portOptions) {
  return new Promise(function (resolve, reject) {
    serialPort = new SerialPort(portName, portOptions, function (err) {
      if (err) {
        reject(err);
      }

      serialPort.on('data', function (data) {
        console.log('Data: ' + data);
      });

      resolve(serialPort);
    });
  });
}

module.exports = {
  getPorts: getPorts,
  getArduinoPorts: getArduinoPorts,
  getFirstArduinoPort: getFirstArduinoPort,
  openPort: openPort
};