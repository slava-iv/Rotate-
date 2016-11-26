// Handle received image.

var cv = require('opencv');

var GREEN_PLATE_COLOR_AVG = [ 55, 175, 120 ];
var BROWN_PLATE_COLOR_AVG = [ 80, 113, 142 ];

var MINIMAL_ALLOWED_DISTANCE = 20;

var handle = function (url) {
  cv.readImage(url, function (err, im) {
    var player = im.matchTemplate('./files/p1.jpg', 0);
    console.log("x:" + player[1] + " y:" + player[2]);

    var matched = im.matchTemplate('./files/plate.jpg', 5)[0];

    var im_converted = im.clone();

    im_converted.convertGrayscale();
    im_converted.canny(0, 100);
    im_converted.dilate(5);

    var contours = im_converted.findContours();

    var data = {
    	plates: [],
    	player: { x: player[1], y: player[2] }
    };

	for (var i = 0; i < contours.size(); i++) {

	    var rect = contours.boundingRect(i);

	    console.log("rect: " + JSON.stringify(rect));

	    // It is not a plate guys.
	    if (rect.width < 100 || rect.width > 160) {
	    	console.log("is not a plate");
	    	continue;
	    }

	    var plateImage = im.crop(rect.x, rect.y, rect.width, rect.height);

	    plateImage.resize(1, 1);

	    var plateAvgColor = plateImage.pixel();

	    var difference = Math.sqrt(
	    	Math.pow(BROWN_PLATE_COLOR_AVG[0] - plateAvgColor[0], 2) + 
	    	Math.pow(BROWN_PLATE_COLOR_AVG[1] - plateAvgColor[1], 2) +
	    	Math.pow(BROWN_PLATE_COLOR_AVG[2] - plateAvgColor[2], 2));

	    console.log("diff: " + difference);

	    // It is a brown plate guys.
	    if (difference <= MINIMAL_ALLOWED_DISTANCE) {
	    	console.log("is brown plate");
	    	continue;
	    }

	    im.drawContour(contours, i, [0, 0, 255]);

	    data.plates.push({
	    	x: rect[0],
	    	y: rect[1]
	    });
	}

	im.save('out.jpg')

    console.log("handle: " + url);
  });
};

module.exports = {
  handle: handle
};
