var dataSender = require('../data-sender.js')

var left = -30;
var right = 30;
var center = 0;

dataSender.init().then(function onInited() {
  console.log("Port inited.");

  setTimeout(function () {
    dataSender.send(left);
    console.log("Port send left: " + left);
  }, 5000);

  setTimeout(function () {
    dataSender.send(right);
    console.log("Port send right: " + right);
  }, 10000);

  setTimeout(function () {
    dataSender.send(center);
    console.log("Port send center: " + center);
  }, 15000);
})
