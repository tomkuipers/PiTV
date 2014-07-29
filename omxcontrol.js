var exec = require('child_process').exec;
var events = require('events');
var util = require('util');

var pipe = false;
var map = false;
var emitter = new events.EventEmitter();

var omx = function (mapper) {
    map = mapper;
    //events.EventEmitter.call(this);
};

//util.inherits(omx, events.EventEmitter);

omx.stop = function(cb) {
    if (!pipe) {
        if (cb) return cb();
    }
    console.info('killing omxplayer..');
    exec('rm -f '+pipe, function (error, stdout, stderr) {
        if (error !== null) console.error('rm exec error: ' + error);
        pipe = false;
        exec('killall omxplayer.bin', function () {
            emitter.emit('stop');
            if (cb) return cb();
        });
    });
};

omx.start = function(fn) {
    if (!pipe) {
        pipe = '/tmp/omxcontrol';
        exec('rm -f ' + pipe, function (error, stdout, stderr) {
            if (error !== null) {
                console.error('rm exec error: ' + error);
            } else {
                exec('mkfifo ' + pipe, function (error, stdout, stderr) {
                    if (error !== null) {
                        console.error('mkfifo exec error: ' + error);
                    } else {
                        if (map) {
                            map(fn, cb);
                        } else {
                            cb(fn);
                        }
                    }
                });
            }
        });
    } else {
        console.info("Pipe already exists! Restarting...");
        omx.stop(function () {
            return omx.start(fn);
        });
    }

    function cb(fn) {
        console.info(fn);
        var insert = '';
        if (fn.subtitle != null) {
            insert = ' --subtitles "' + fn.subtitle + '"';
        }
        exec('omxplayer -o hdmi --blank' + insert + ' "' + fn.input + '" < ' + pipe, function (error, stdout, stderr) {
            if (error !== null) {
              console.error('omxplayer exec error: ' + error);
              emitter.emit('stop', error);
            } else {
              emitter.emit('complete');
            }
        });
        omx.sendKey('.') // play
        emitter.emit('start', fn);
    }
};

omx.sendKey = function(key) {
    if (!pipe) return;
    exec('echo -n '+key+' > '+pipe);
};

omx.mapKey = function(command,key,then) {
    omx[command] = function() {
        omx.sendKey(key);
        if (then) then();
        emitter.emit(command);
    };
};

omx.mapKey('volume_up', '+');
omx.mapKey('volume_down', '-');
omx.mapKey('pause','p');
omx.mapKey('resume','p');
omx.mapKey('quit','q',function() {
    omx.stop();
});
omx.mapKey('play','.');
omx.mapKey('forward',"\x5b\x43");
omx.mapKey('backward',"\x5b\x44");
omx.mapKey('next_subtitle', 'm');
omx.mapKey('previous_subtitle', 'n');
omx.mapKey('next_chapter', 'o');
omx.mapKey('previous_chapter', 'i');
omx.mapKey('next_audio', 'k');
omx.mapKey('previous_audio', 'j');
omx.mapKey('increase_speed', '1');
omx.mapKey('decrease_speed', '2');

module.exports = {
    player: omx,
    emitter: emitter
};
