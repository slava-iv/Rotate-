// Handle received image.

var cv = require('opencv');

var handle = function (url) {
  cv.readImage(url, function (err, im) {
    var result = im.matchTemplate('./files/p1.jpg', 0);
    console.log("x:" + result[1] + " y:" + result[2]);

    result = im.matchTemplate('./files/plate.jpg', 5);
    var matches = result[0].templateMatches(0.10, 1.0, 5, false);

    console.log("handle: " + url);
  });
};

module.exports = {
  handle: handle
};
