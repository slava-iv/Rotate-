// Handle received image.

var cv = require('opencv');

var handle = function (url) {
  console.log("handle: " + url);
};

module.exports = {
  handle: handle
};
