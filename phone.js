function once(fn, context) {
    var result;
    return function() {
        if (fn) {
            result = fn.apply(context || this, arguments);
            fn = null;
        }
        return result;
    };
}

function PhoneController(webkeyApi) {
    this.API = webkeyApi;
    this.init();
}

function median(values) {
    values.reverse();
    values.sort(function(a, b) {
        return a - b;
    });

    var half = Math.floor(values.length / 2);

    if (values.length % 2)
        return values[half];
    else
        return (values[half - 1] + values[half]) / 2.0;
}

PhoneController.prototype = {
    API: void 0,

    maxWidth: 500,

    maxHeight: 900,

    logoImage: new Image(),

    lastImage: new Image(),

    lastImageTime: void 0,

    quality: void 0,

    imageTripTimes: [],

    drawContext: void 0,

    deviceOpts: {
        rotation: "ROTATION_0"
    },

    opts: {
        frequency: 40
    },

    touchEvents: [],

    screenDivOrientation: 0,

    init: function() {
        var self = this;
        this.drawContext = document.getElementById('phone-display').getContext('2d');
        this.rotateScreenOnce = once(this.rotateScreen);

        this.loadSplashScreen();

        this.lastImage.onload = self.loadScreen();

        var getTouchOpts = function() {
            return {
                flip: $("#fliptouch").prop("checked"),
                mirror: $("#mirrortouch").prop("checked")
            }
        }

        var createTouchEvent = function(event, element, type) {
            var offset = $(element).offset();
            var coordX = event.pageX - offset.left;
            var coordY = event.pageY - offset.top;
            var percentX;
            var percetnY;

            var width = element.width > 0 ? element.width : element.clientWidth;
            var height = element.height > 0 ? element.height : element.clientHeight;

            switch (self.deviceOpts.rotation) {
                case "ROTATION_0":
                    percentX = coordX / width;
                    percentY = coordY / height;
                    break;
                case "ROTATION_90":
                    percentX = coordX / height;
                    percentY = coordY / width;
                    t = percentX;
                    percentX = 1 - percentY;
                    percentY = t;
                    break;
                case "ROTATION_180":
                    percentX = coordX / width;
                    percentY = coordY / height;
                    percentX = 1 - percentX;
                    percentY = 1 - percentY;
                    break;
                case "ROTATION_270":
                    percentX = coordY / width;
                    percentY = coordX / height;
                    percentY = 1 - percentY;
                    break;
            }

            var opts = getTouchOpts();
            var ts = new Date().getTime() - self.touchEventStart;
            self.touchEvents.push({
                type: type,
                x: percentX,
                y: percentY,
                timestamp: ts,
                flip: opts.flip,
                mirror: opts.mirror
            });
        };

        $('#phone-display').on("mousedown", function(e) {

            createTouchEvent(e, this, "DOWN");

            $('#phone-display').on("mousemove", function(e) {
                createTouchEvent(e, this, "MOVE")
            });

            $('#phone-display').on("mouseout", function(e) {
                createTouchEvent(e, this, "UP")
                $('#phone-display').off('mousemove');
                $('#phone-display').off('mouseout');
                $('#phone-display').off('mouseup');
            });

            $('#phone-display').on("mouseup", function(e) {
                createTouchEvent(e, this, "UP")
                $('#phone-display').off('mousemove');
                $('#phone-display').off('mouseout');
                $('#phone-display').off('mouseup');
            });
        });

        var bindButton = function(selector, code) {
            var start;
            $(selector).on("mousedown", function(e) {
                e.preventDefault();
                start = new Date().getTime();
                self.API.sendButtonEvent("DOWN", code)
            });

            $(selector).on('mouseup', function(e) {
                e.preventDefault();
                if (new Date().getTime() >= (start + 400)) {
                    self.API.sendButtonEvent("LONGPRESS", code)
                } else {
                    self.API.sendButtonEvent("UP", code)
                }
                start = 0;
            });

        }

        //The id come from the java definition
        bindButton("#cellphone-volup-button", "0");
        bindButton("#cellphone-voldown-button", "1");
        bindButton("#cellphone-bot-back-button", "2");
        bindButton("#cellphone-bot-home-button", "3");
        bindButton("#cellphone-bot-menu-button", "4");
        bindButton("#cellphone-power-button", "5");

        var touchSend = function() {
            if (self.touchEvents.length) self.API.sendTouchEvents(self.touchEvents)
            self.touchEvents = [];
            self.touchEventStart = new Date().getTime();
            setTimeout(touchSend, 25);
        }

        touchSend();

        $("#quality").on("change", function() {
            self.setQuality(this.value)
        });

        $("#fullscreen").on("click", function() {
            var canvas = document.getElementById('phone-display')
            if (canvas.requestFullScreen)
                canvas.requestFullScreen();
            else if (canvas.webkitRequestFullScreen)
                canvas.webkitRequestFullScreen();
            else if (canvas.mozRequestFullScreen)
                canvas.mozRequestFullScreen();
        });

        // ========= TESTING =============
        // var mockDraw = function() {
        //     setTimeout(mockDraw, 1000);
        //     $(".loggedIn").show();
        // };
        // mockDraw();

        // ===============================
    },

    onMessage: function(msg) {
        var self = this;

        if (msg instanceof ArrayBuffer) {
            var currTime = new Date().getTime();
            var data = new Uint8Array(msg);

            //parse from data the img's seq number
            var seqnum = data[data.length - 1];

            //parse from data the timestamp
            var timeArray = data.subarray(data.length - 8 - 1, data.length - 1);

            //convert from byte the send date
            var timestamp = timeArray[7] +
                timeArray[6] * 256 +
                timeArray[5] * 65536 +
                timeArray[4] * 16777216 +
                timeArray[3] * 4294967296 +
                timeArray[2] * 256 * 4294967296 +
                timeArray[1] * 65536 * 4294967296 +
                timeArray[0] * 16777216 * 4294967296;

            //parse from data the img's freq num (4 byte) and -9(8+1) offset
            var freq =
                data[data.length - 1 - 9] & 0xFF |
                (data[data.length - 2 - 9] & 0xFF) << 8 |
                (data[data.length - 3 - 9] & 0xFF) << 16 |
                (data[data.length - 4 - 9] & 0xFF) << 24;

            self.drawScreen(data);

            if (self.lastImageTime != void 0) {
                var delay = Math.abs(self.lastImageTime - currTime);

                //acknowledge the received image
                self.API.sendAck(seqnum, delay);
            } else {
                // first image, send 0
                self.API.sendAck(seqnum, 0);
            }
            self.lastImageTime = currTime;
            return;
        }

        switch (msg.type) {
            case "SCREEN_OPTIONS":

                if (msg.jsonPayload.rotation == "ROTATION_0" || msg.jsonPayload.rotation == "ROTATION_180") {
                    //got landscanpe
                    self.maxWidth = msg.jsonPayload.screenX;
                    self.maxHeight = msg.jsonPayload.screenY;
                } else {
                    self.maxWidth = msg.jsonPayload.screenY;
                    self.maxHeight = msg.jsonPayload.screenX;
                }
                self.deviceOpts.rotation = msg.jsonPayload.rotation;

                if (self.maxWidth > self.maxHeight) {
                    self.screenDivOrientation = 1;
                } else {
                    self.screenDivOrientation = 0;
                }

                self.rotateWireframe();
                break;
            case "CONNECTED":
                // reset lastimagetime upon connection event, so jitter control can start calculating again
                self.lastImageTime = void 0;
                break;
        }
    },

    rotateScreenOnce: void 0,

    rotateScreen: function() {
        this.drawContext.translate($('.cellphone-mid').width(), 0);
        this.drawContext.rotate(Math.PI / 180 * 90);
    },

    loadSplashScreen: function() {
        var self = this;
        this.logoImage.onload = function() {
            self.drawSplashScreen();
        };

        this.logoImage.src = LOGO_IMAGE_SRC;

    },

    drawSplashScreen: function() {
        this.drawContext.fillStyle = "#58aa47";
        var self = this;

        var gotImageOrientation;
        if (self.lastImage.width > self.lastImage.height) {
            gotImageOrientation = 1;
        } else {
            gotImageOrientation = 0;
        }

        //A screnDivOrientacio talan mindig portrait lesz. Hardkodolni lehetne.
        if (this.logoImage.complete) {
            if (gotImageOrientation == self.screenDivOrientation) {
                this.drawContext.fillRect(0, 0, $('.cellphone-mid').width(), $('.cellphone-mid').height());
                this.drawContext.drawImage(
                    this.logoImage,
                    $('.cellphone-mid').width() / 2 - this.logoImage.width / 2,
                    $('.cellphone-mid').height() / 2 - this.logoImage.height / 2);
            } else {
                //Ez a resz lefut valaha????
                this.drawContext.fillRect(0, 0, $('.cellphone-mid').height(), $('.cellphone-mid').width());
                this.drawContext.drawImage(
                    this.logoImage,
                    $('.cellphone-mid').height() / 2 - this.logoImage.height / 2,
                    $('.cellphone-mid').width() / 2 - this.logoImage.width / 2);
            }
        }
    },

    loadScreen: function() {
        var self = this;
        return function() {
            //check the got screen orientation
            var gotImageOrientation;
            if (self.lastImage.width > self.lastImage.height) {
                gotImageOrientation = 1;
            } else {
                gotImageOrientation = 0;
            }

            //A screnDivOrientacio talan mindig portrait lesz. Hardkodolni lehetne.
            if (gotImageOrientation != self.screenDivOrientation) {
                self.rotateScreenOnce();
                self.doRotate = true;
                self.drawContext.drawImage(self.lastImage, 0, 0, $('.cellphone-mid').height(), $('.cellphone-mid').width());
            } else {
                self.doRotate = false;
                self.drawContext.drawImage(self.lastImage, 0, 0, $('.cellphone-mid').width(), $('.cellphone-mid').height());
            }
        }
    },

    drawScreen: function(imgData) {
        var self = this;
        var i = imgData.length;
        var binaryString = [i];
        while (i--) {
            binaryString[i] = String.fromCharCode(imgData[i]);
        }
        var data = binaryString.join('');

        var base64 = window.btoa(data);
        this.lastImage.src = "data:image/jpeg;base64," + base64;

        if (!self.oldDate || (new Date().time() - self.oldDate>500)) {
            $.post('http://localhost:8080/base64img', {'url':base64.toString()}, function () {
                // console.log(arguments);
            });
           self.oldDate = new Date().time();
        }
       else
        {

        }
        
    },

    rotateWireframe: function() {
        this.resetScreen();
        var deg;
        var move;
        switch (this.deviceOpts.rotation) {
            case "ROTATION_0":
                deg = 0;
                move = 0;
                break;
            case "ROTATION_90":
                deg = -90;
                move = this.translet;
                break;
            case "ROTATION_180":
                deg = -180;
                move = 0;
                break;
            case "ROTATION_270":
                deg = 90;
                move = this.translet + 20;
                break;
        }
        var div = document.getElementById("wireframe");

        div.style.webkitTransform = 'rotate(' + deg + 'deg)';
        div.style.mozTransform = 'rotate(' + deg + 'deg)';
        div.style.msTransform = 'rotate(' + deg + 'deg)';
        div.style.oTransform = 'rotate(' + deg + 'deg)';
        this.resetScreen();
    },

    resetScreen: function() {
        var size;
        var minWidth = 300;
        //Levagjuk a headert
        var workplaceHeight = $(window).height() - 50 - 65 - 92;

        size = workplaceHeight / this.maxHeight;

        var newHeight, newWidth;
        if ((this.maxWidth * size) < minWidth) {
            var arany = this.maxHeight / this.maxWidth;
            newWidth = minWidth;
            newHeight = newWidth * arany;
        } else {
            newWidth = this.maxWidth * size;
            newHeight = this.maxHeight * size;
        }

        //this.translet = $('.cellphone-mid').width() - $('.cellphone-mid').height();

        $('.cellphone-mid').height(newHeight);
        $('.cellphone-mid').width(newWidth);

        this.drawContext.canvas.width = newWidth;
        this.drawContext.canvas.height = newHeight;

        /*
         Ha mar egyszer elforgattuk es uj meretet kap
         akkor ujra el kell forgatni.
         */
        if (this.doRotate) {
            this.rotateScreen();
        }

        if (this.quality == void 0) {
            currentRangeValue = (newHeight / this.maxHeight) * 100;
            if (currentRangeValue > 100) {
                currentRangeValue = 100;
            }

            if (currentRangeValue < 10) {
                currentRangeValue = 10;
            }

            var downGrade = 0.8;
            $("#quality").val(currentRangeValue * downGrade);
            this.setQuality(currentRangeValue  * downGrade);
        }
        this.drawSplashScreen();

    },

    //Akkor hivodik meg ha csuszkat allitunk vagy resize van
    setQuality: function(quality) {
        if (quality != void 0 && quality < this.quality) {
            this.opts.frequency = 40;
            this.imageTripTimes = [];
        }
        this.quality = quality;
        quality = quality / 100;
        var opts = {
            frequency: this.opts.frequency,
            screenX: Math.floor(this.maxWidth * quality),
            screenY: Math.floor(this.maxHeight * quality)
        }
        if (this.opts == void 0 || opts.frequency != this.opts.frequency || opts.screenX != this.opts.screenX || opts.screenY != this.opts.screenY) {
            this.API.sendOpts(opts);
            this.opts = opts;
        }

        return opts
    },

    setFrequency: function(freq) {
        if (freq < 40) freq = 40;
        if (freq > 5000) freq = 5000;
        this.opts.frequency = Math.floor(freq);
        this.API.sendOpts(this.opts);
    },

    onError: function(err) {
        // $(".webkey-error").text(err).show();
        // $("canvas.cellphone-mid").hide();
        // var prev = this.deviceOpts.rotation;
        // this.deviceOpts.rotation = "ROTATION_0";
        // this.rotateWireframe();
        // this.deviceOpts.rotation = prev;
    },

    hideError: function() {
        // $(".webkey-error").hide();
        // $("canvas.cellphone-mid").show();
        // this.rotateWireframe();
    },

    freqOnSwitch: 40,

    runDegradeFreq: void 0,

    runUpdateProgresss: void 0,

    runUpdateProgressBar: void 0,

    showView: function() {
        var self = this;
        this.runDegradeFreq = true;
        this.runUpdateProgressBar = true;
        self.imageTripTimes = [];
        self.opts.frequency = this.freqOnSwitch;

        //Megnoveljuk a kuldes tempojat
        var degradeFreq = function() {
            if (self.runDegradeFreq) {
                if (self.imageTripTimes.length != 0) {
                    self.setFrequency(median(self.imageTripTimes) * 0.8);
                    self.imageTripTimes = [];
                }

                setTimeout(degradeFreq, 3000);
            }
        };
        degradeFreq();

        this.API.startStream();
        $("#phoneContainer").show();
        $("#phoneNav").addClass("active");

        //Chrome buttons to Java buttons
        var androidKeys = {
            "40": "40", //"ARROW_DOWN",
            "39": "39", //"ARROW_RIGHT",
            "38": "38", //"ARROW_UP",
            "37": "37", //"ARROW_LEFT",
            "17": "17", //"CTRL",
            "18": "18", //"ALT",
            "13": "13", //"ENTER",
            "16": "16", //"SHIFT",
            "8": "8" //"BACKSPACE",
        }

        //Buttons
        $(document).on('keydown', function(e) {
            if (e.which in androidKeys) {
                e.preventDefault();
                //UP a backend miatt
                self.API.sendButtonEvent("UP", androidKeys[e.which]);
            }
            //Keys
        }).on('keypress', function(e) {
            self.API.sendKeyEvent("PRESS", String.fromCharCode(e.which));
        });

        $(window).on("resize", function() {
            if (document.webkitIsFullScreen)
                return;
            self.resetScreen();
        });

        var updateProgressBar = function(alpha) {
            if (!self.runUpdateProgressBar) {
                return;
            }

            var currTime = new Date().getTime();
            diff = currTime - self.lastImageTime;

            /*
             * A 80 kb. 12 FPS-t jelent. Tehat ha jon 12 FPS-el
             * akkor nem halvanyitunk.
             */
            if (diff <= 80) {
                alpha = 100;
            } else {
                alpha -= 5;
            }

            $('#progress-bar').css('background-color', 'rgba(176, 196, 222, ' + alpha / 100 + ')');
            //azert 250 mert igy 5 sec alatt valik feherre
            setTimeout(function() {
                updateProgressBar(alpha)
            }, 250);

        };
        updateProgressBar(100);

        self.resetScreen();
    },

    hideView: function() {
        this.runDegradeFreq = false;
        this.runUpdateProgressBar = false;
        this.freqOnSwitch = this.opts.frequency;
        this.API.stopStream();
        $("#phoneContainer").hide();
        $("#phoneNav").removeClass("active");

        $(document).off("keydown");
        $(document).off("keypress");
        $(window).on("resize");
    }
};

var LOGO_IMAGE_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADYAAAA2CAYAAACMRWrdAAAKUmlDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHhenZN3VFPZFsb3vTe9UJIQASmX3qQLBBApoUVAikgTlZAECCXEkIAFGyIqMKKoiGBFRkUccHQEZKyIYmFA7H1ABgFlHBzFhuX9wazRN2u99Vzz++tb33fOOmefvQ8AIzhUKstGNQCyZEpFVJAfHhefgJO7AAUqkMARQCjKkYfNCowGABAE8PGcqCA/+AIC8PoWIAAA122DI3D8q+xb0BTJFUoAJAIAnMWSHBEAUggAmXlKuRIAGQUATnKGXAmAEgCAo4iLTwBAtQGAkzqhpwAAJ3lC+wAAR5wlEwOg0QAgF2eJxQBoOwCszVVJxABYKAAU5UoleQDYDQAwzVRlSQGwtwDAyZIIcwAIDAAwVUpEaQAEBwBgKKKj+ACEaQAURupXOvkrrZQsVAIA8LPlixTS1DQlbimywh3d3Xl4sCQvU6JU2kYIRRlChRjnZ2fJhbJFABM1AwAAKycqyA8XBPBdHd1dXW2d7Bz/Cv5v+I3ExSfgE+plJCAAgHA7v3hf+OJl1wDwxgCwDV+85G0AzasBtO998Ux3A6gXAjR1f1UPVxDAx9OUSrmHvX1eXp6dVCKyE6X9FX7Tgm/gq/PsBAF8/O/nwf0lKUJVphKPCvLDRdmZ2SoFniMXiiS47T+H+F9v/Iqv7jElSpIiUUhkIgkeI5XkSWWpOD9bJpYqpdkyXCr7X038l9v+wcRcAwC79hNw5tuBRjcHsN87gcCmA5a4EwCQv/sWSo2BCACINRycmHsAgInf/N+gZQCA5khTcQAAflQ0LlIpcicyAgAAEWigDhzQAQMwAUuwBSdwA0/wgQCYAeEQDfEwD0SQBlmggDzIh5VQBCWwAbZAFeyCWqiDBjgCzXACzsIFuAJX4Sbch14YgGcwCq9hHEEQMsJE2IgOYoiYITaIE8JDpiMBSCgShcQjSUgqIkNUSD6yCilBypEqZA9Sh/yIHEfOIpeQHuQu0ocMI38i71EMZaAcVB81R+1RHuqLhqDR6Fw0FV2ALkYL0fVoJVqDHkKb0LPoFfQm2os+Q8cwwOgYFzPCbDEexsfCsQQsBVNgy7BirAKrwRqwVqwDu471YiPYOwKJwCbgBFuCJyGYMJsgIiwgLCOUEqoIBwhNhHbCdUIfYZTwicgk6hFtiB5EATGOmErMIxYRK4j7iMeI54k3iQPE1yQSiUuyILmRgknxpHTSElIpaQepkXSG1EPqJ42RyWQdsg3ZixxOFpKV5CLyNvIh8mnyNfIA+S2FTjGkOFECKQkUGaWAUkE5SDlFuUYZpIxTNahmVA9qOFVMXUQto9ZSW6nd1AHqOE2TZkHzokXT0mkraZW0Btp52gPaSzqdbkx3p0fSpfQV9Er6YfpFeh/9HYPFsGbwGYkMFWM9Yz/jDOMu4yWTyTRn+jATmErmemYd8xzzEfOtGlvNTk2gJlZbrlat1qR2Te25OlXdTN1XfZ76YvUK9aPq3eojGlQNcw2+hlBjmUa1xnGN2xpjmmxNR81wzSzNUs2Dmpc0h1hkljkrgCVmFbL2ss6x+tkY24TNZ4vYq9i17PPsAQ6JY8ERcNI5JZwfOF2cUS2W1lStGK2FWtVaJ7V6uRjXnCvgZnLLuEe4t7jvJ+lP8p0kmbRuUsOka5PeaE/W9tGWaBdrN2rf1H6vg+sE6GTobNRp1nmoS9C11o3UzdPdqXted2QyZ7LnZNHk4slHJt/TQ/Ws9aL0lujt1evUG9M30A/Sl+tv0z+nP2LANfAxSDfYbHDKYNiQbTjdUGq42fC04VNcC/fFM/FKvB0fNdIzCjZSGe0x6jIaN7Ywnm1cYNxo/NCEZsIzSTHZbNJmMmpqaBpmmm9ab3rPjGrGM0sz22rWYfbG3MI81nyNebP5kIW2hcBisUW9xQNLpqW35QLLGssbViQrnlWG1Q6rq9aotYt1mnW1dbcNauNqI7XZYdMzhTjFfYpsSs2U27YMW1/bXNt62z47rl2oXYFds91ze1P7BPuN9h32nxxcHDIdah3uO7IcZzgWOLY6/ulk7SRyqna64cx0DnRe7tzi/GKqzVTJ1J1T77iwXcJc1ri0uXx0dXNVuDa4DruZuiW5bXe7zePwInilvIvuRHc/9+XuJ9zfebh6KD2OePzhaeuZ4XnQc2iaxTTJtNpp/V7GXkKvPV690/HpSdN3T+/1NvIWetd4P/Yx8RH77PMZ9LXyTfc95Pvcz8FP4XfM7w3fg7+Uf8Yf8w/yL/bvCmAFzA6oCngUaByYGlgfOBrkErQk6EwwMTgkeGPwbYG+QCSoE4zOcJuxdEZ7CCNkVkhVyONQ61BFaGsYGjYjbFPYg5lmM2Uzm8MhXBC+KfxhhEXEgoifI0mREZHVkU+iHKPyozpmsWfNn3Vw1utov+iy6PuzLWerZrfFqMckxtTFvIn1jy2P7Y2zj1sadyVeN14a35JATohJ2JcwNidgzpY5A4kuiUWJt+ZazF0499I83XmZ807OV58vnH80iZgUm3Qw6YMwXFgjHEsWJG9PHhXxRVtFz8Q+4s3iYYmXpFwymOKVUp4ylOqVuil1OM07rSJtRMqXVklfpAen70p/kxGesT/jc2ZsZmMWJSsp67iMJcuQtWcbZC/M7pHbyIvkvQs8FmxZMKoIUezLQXLm5rQoOUq5slNlqVqt6sudnlud+zYvJu/oQs2FsoWdi6wXrVs0uDhw8fdLCEtES9ryjfJX5vct9V26ZxmyLHlZ23KT5YXLB1YErTiwkrYyY+UvBQ4F5QWvVsWuai3UL1xR2L86aHV9kVqRouj2Gs81u9YS1krXdq1zXrdt3adicfHlEoeSipIPpaLSy985flf53ef1Keu7ylzLdm4gbZBtuLXRe+OBcs3yxeX9m8I2NW3GNxdvfrVl/pZLFVMrdm2lbVVt7a0MrWzZZrptw7YPVWlVN6v9qhu3621ft/3NDvGOazt9djbs0t9Vsuv9bunuO3uC9jTVmNdU7CXtzd37pDamtuN73vd1+3T3lez7uF+2v/dA1IH2Ore6uoN6B8vq0XpV/fChxENXf/D/oaXBtmFPI7ex5DAcVh1++mPSj7eOhBxpO8o72vCT2U/bj7GPFTchTYuaRpvTmntb4lt6js843tbq2XrsZ7uf958wOlF9Uutk2SnaqcJTn08vPj12Rn5m5Gzq2f62+W33z8Wdu9Ee2d51PuT8xQuBF851+Hacvuh18cQlj0vHL/MuN19xvdLU6dJ57BeXX451uXY1dbt1t1x1v9raM63n1DXva2ev+1+/cENw48rNmTd7bs2+ded24u3eO+I7Q3cz7764l3tv/P6KB8QHxQ81HlY80ntU86vVr429rr0n+/z7Oh/Peny/X9T/7Lec3z4MFD5hPqkYNBysG3IaOjEcOHz16ZynA8/kz8ZHin7X/H37c8vnP/3h80fnaNzowAvFi89/lr7Uebn/1dRXbWMRY49eZ70ef1P8VuftgXe8dx3vY98Pjud9IH+o/Gj1sfVTyKcHn7M+f/4PA5jz/OCwinUAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAADE4AAAxOAX93jCMAAAAHdElNRQffBQ0TOxLEXdCuAAANQUlEQVRoQ+2ZaZBdxXXHf6fvvW+b92bfNCNmtCEZkMWiIAQIG5DBiY0LgnHiBAcryBAwxsauShwgCRRFEhOCy0nABIPBuAx2jMAoLmQRdrHJQiBZO0JC0kiaYfY38/Z7b3fnw5sZWYMImgFRZUf/L++9Pud0n3+f0+f0vQ+O4ij+f8EEvrW3Xm3tA7fa8bIjAXf8wJGC3PYN+lf9irqZdeNFRwRq/MARQ2srNfkE0Dpe8rsPe3XzR5KG8BFGLNThTVSdPn74dx963YPWXnTs71/EQGBKZvzgEcNHR0zGD/we4aMsHkd0H83W+05k4/fWmxE6wwNZUrVJBBCBXDpH5ZW7jogPH/qk5pG5NjOQQxuLBYwtf5ZyJbAQrYgSr0oQdg4igzmCuIcSIXbmkscrzr3jj8fPN1l8aMTCVVfbUqgJtSHW98rIqIytkEvnsUAxUySWjGIs0D2EF3UpVcaI5HxMKSBx/l8viC+8/rWRCSaND0zM2rW2+Ny9hMbgKIWjBKUUogTVtQprLcZYjDFYwOnPkvVcYl2DBIkokXiEYSXEe4YI/RARIRr3iP/D4Afy7QMZ6/W3/yTTs+1SJYqY5+J9cikAwfP30t/fz7Luc9myeQtdnZ2kh9L4pSIiiqqqGmbNmcNVczdQXVdHmBmiFASkcluIZH3UcAFTEaX27/on7d+kDc3W+07s2/Xyes9RJGMR3E8sJXj+Bzz6zmJWrlxJR0cHpZJPNJrA94vkchkKhQK+72Ms9LzTiQ5DWqe28olzFnPDuT1EK1IEQUj9jmcIQ0PdWZc/riZ57iZNrGfFX9pAGxpScRzHIZ0e5OcrX2flFpe9QzFc16Ouroa/+PcONv1G89DfGILAZ+4pzVx2+wBPPZnhkRvzhKGPny9QV1vLksuv4NuzXkH7bxPmfVLVFVRftXtSPk6qQRee+ys7mC+RjEVQjoPWIT9Z/irPbA7IFIXt299ky5bNbNq4iS0bs3R1DpAe7CNTyLC9o5u1mzP84h7IV4T41cAUj347wB3/ehu7CyWCtrOpbK4iN1yg9NTSxePXPxxMaje6nlhic6WQ1poknusg1rJ79y5++tx+Ogd8nn9Lkc1myedyFIsW5RiciAMOBAIFcYklIRGPEI/HOKnekEhUkkudzC1ndNJYypGrb6a691ViEW9SvW7CBgDbH73UxjyHlsIbKAG54N8gXgX5PkjUE75wL0EQEIYhRutyRRzpZwAVmTcAyNechkHI9fVQDDTJ3JYRDYtCiJs0iZMuJXrODybs56SeoBOeonr414TKQQRk+bWs7DmOqqRLV0+aiJvEjrCwFrzMdizQGWtDTIhVxzKvuQhdnQROCmtj6MIgyCyOtzuImWFSlS5B9BjM5E7LxImFOrxpz38vQYnCcQQRwTSdRUlX8fTGPdx5f45UdQCAMaAUYBtGrPMUhoZwBNxUNVHXEOhhPNcynIWvXVTDKTPTZVsL/cmTaelZNWI7MUyY2EZ56OZoqDGjIQGcmGVGfJhNmW5mNIecteTat42xjrVlJWstOtRSyOadwd4Bt6+r18tlcq4fapFAK22MTHE2VAxs6CacHSV57OlkurZSObQGf+rZwGiKHj4mTAzKB3Oo+jQacmtxGmcjjkJEqK9UgFCdTMywWAQhGgFtQIeWYiJKRCxRpdnXoTH5En5oACGVUrgxD79tMUWlGM40YVqmMq139Ho2MUwogdfpB22nrCEINYjgN5xJ4NZg7CzE16RLEQZzIdoYKwie6xCLRlh0gsPpc9MsOqWfhXND/ujsZpSrCLVGa4M2hsC6mEg9oVFYHZKubQKgYNPsf/aTE37cOWxi68IfWa2KZDqmISM1SpRQKpXAbgWGyefyaG0QEUQgGnE5/4x68vFH2K9vp0fuhqn3UH/881z+5TOBcpoigg5DPMcnCAKCUgmFwWJxwhT5UsAzA3dOiNxhEVtvHrRdA0Ps6Bgm1bYbz3Wx1lC+1oJSZaZ1SW1gxFmgodahY+gufJ2hMt6OxVJbMZswzDJl9gqqqhMgAtaSzUKvU3anO+dhrCU0Fs9VeKkMvcN5nhkskzPGtPM++D+JrfXvt6uGvm97BobZ2/AsqbbdtNgFKBEsZQIyGj6gO13ui+WICcfU9JItdpIrvoM2PhXRZvxwmFKYoT+3jX++5XPlfjAyxdQGsA4Ujcv0pjjaGJRSJGwjs9qr2LHtKV7M/KdVSu0ZW/Q98K7isda/3w4MDCDK4XVvOQ37F9D7zhqaiotomdJISlrnGmETgAXi8ciYbVM1FpBpNUXb2Ngt+cChtWERpSCNow7olS2h2NfFo4+dyrVf32n730RWrM3zpfMg4RjwEhhTwgo0nvWMvFb6cwvQ2ZfmCXuNTQx8jKqqFJlMhuaqaT+coz73ld9a4GBia4r32bu86+FF4BK4KvgOzjGKimSSXDbDyc6XBWD7Y5eCHEi5km8A+PisGoE8YbDHpiPLqE0eR2e6h2yxE0dFx9axVuM5CZpqi6zbvYIr/uzr5js3r3JG5YEufxpbnhfg1OhSebb/P2xXdw92fxtDOscbDykevvZa5i1rWvqzLTcs/eLx/zSWPgcRuzt6IwtXL6TtjDP5OXfgeS65XAHPdXHUgawVAazFUk6j0dlyxfI3QeE6CZR4CAolLkoOLGURRByUuHhOklH3zzguYQExIhD4B/VKgFKpQPVxA9T501kYvVzusRfaK1dfyNRLprKPzQfpHkTsS/3Xs/j06wSW82T3d22X7iYa8cjn81RVVY7pKRhj4xdDnIg3JvuAkHwpBJUALNNaaqD3gNBM2YPTMws/EbAmeNB2vN3BzAVtnCzlTPptHFQ8FtdfN6bw6aZvyb4pL7Jp4yZqa6o5u/prY7KxgjFy8MfXYUtIYPIYG3IgnuMhaBsS6NxYSrsKi1BOCbGMn7m+dDLFQoFMcgOd+/dRmUqOHY/xOGRVXFO8z95jL7Srl62mtaWZRamrDzIe7VN25Pt4RJx6ZtR/hqrENIwNxhwfu9+LEOo86c4G2us/xWMr9kpZjgShGdkKYee+Afy6A+/7T4t9RdqmtvAyT9LdvobzG7/57sVHcEhi66K/pPRCIwsvWcjMmTPGixlpW4zu6OhvT4oA3LvsbfXVq/t46/UmtPWxhGVtqwGLsRprDdrM5fMXvcOq1TsVQCoOpdCUI0Z5I8ZnwynuEpm39U9YvWw1T/d818Kh+9q7yj3AFfYX09TZo71i+UEyAEEYJSWA6xy8cf19g5TyBW6+/VX+5R+/QXXDg1igb+siamc/S8RNkd59AZdd9f2xdKYGMoWyfUwdOoWNMe1KqT1Pbv4hADsbXmCtvccqObDVozhkxN6vAYoIqnwYiERdRCAjNbjNx4rnVROUfHSoCbXlm99ehqsSKBQP/7IbBCJekmuu+6/yazlrCQslTpieoClmiYjgiCBejHFFccyvB77QLQ98oVtOLHwWUxrrEgfhkBF7P4hQvn0Yi43WUChBVTRHPlPAOB5YK8aW3ydqY6iItWCsYdeePpKxFlKxY7CxIWy+nLpefS2bd+3hvNYK5kytZChd4q292dGMfE8sTFz5nhqTIqaknIxKFIWBQeJxF8Ii24YbyOd3E6+RQGujQq0l1IbPX7zXWouEgZaL/7AI0X5b7O0TiUYQBJ3N4dSLiKN4uzdPwfeZHmxif3Te+KUPG5Mi5oigRHBE4SrB+JZAW7TWZNIFBnte9BxVLhSjSFRUEI+MXKuKSF0VQA5GtNKFJC91JVkohunBJkBoDzYhNI/MMDFMipgxBkHhiOAoB1cpvEgFi9oDHr3z4/SXyno9mXJtcFSE49uTWCzGlv+oMMZgrEFri7GGLW8OMXNGgnxxN4ycYFAghywD74tJEfP7uuhNZ3BdB9dx8FyPlOdS6zq0OmAT5XueV+0RS8YAAenDGM1QOoM2lmwmR6BDAq3RxnJmlUb3aYoIu9wG2tV+sqkTqPYm5eIhauphouj7dp3+MaGx9PXt4I22p2ne3sh5FT/mude2nvHT5S+52topazbsbIzEvF996vT22v95efdwZUX8ik8smNMtWKOUKtz41c/e9dITt/L6/Nc5NTGdmVPPJep5xDyP+e6SSfv3oeBHv77IXrl2vr3tlZPs47/51vieyilfvKES4A8uu6l2vKy7Y5/93i0t9sq18+3f751v1xXve5f9ZDDpHdFa35TL5W7u7hrk9szFMB+aH05Q7VYwc8Gi5WEYRqw1jiilPZWtLzmdp7oVletNunmHNcYRERzX9bPPtf7pqnl3AdDUBHMKM/l07d1UJOIkEolJ+zdpw8dfvcUGQYDRhmy6i0iuit6ancRWVNP1t5uZl/9MWVGESlVHsa8bZ4omSjspr469mU0gQs5sY3idQfcdg9rWS825ceKNLQiWWCzGWbOvoaqqasJ+Tu5kAr7vl18NOArPTVDqb2Lbx1ZxzqXNNBQvgNGnLGsZNv3E2xSFrEvBdpEudo3JKphNOHcDNrqewYuGsYVjKagdABQdxRb3Z2XdoziKoziKjwL/C/PQHarlKCdKAAAAAElFTkSuQmCC';
