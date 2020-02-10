var url = require('url');
var https = require('https');
var querystring = require('querystring');

exports.root = "https://www.websequencediagrams.com";
exports.styles = ["default",
                  "earth",
                  "modern-blue",
                  "mscgen",
                  "omegapple",
                  "qsd",
                  "rose",
                  "roundgreen",
                  "napkin"];

function getResultBuffer(res, cb) {
    if (res.statusCode !== 200) {
        cb("HTTP Error: " + res.statusCode);
        return;
    }

    res.on('error', function (er) {
        cb(er.message);
    });

    var size = parseInt(res.headers['content-length'], 10);
    var contentType = res.headers['content-type'];
    var buf;
    var offset = 0;

    if (Number.isNaN(size)) {
        var chunks = [];
        size = 0;
        res.on('data', function (chunk) {
            chunks.push(chunk);
            size += chunk.length;
        });

        res.on('end', function () {
            buf = Buffer.alloc(size, 0);
            chunks.forEach(copyChunkToBuffer);
            cb(null, buf, contentType);
        });
    } else {
        buf = Buffer.alloc(size, 0);
        res.on('data', copyChunkToBuffer);

        res.on('end', function () {
            cb(null, buf, contentType);
        });
    }

    function copyChunkToBuffer(chunk) {
        chunk.copy(buf, offset);
        offset += chunk.length;
    }
}

exports.diagram_url = function diagram_url(description, style, format, cb) {
    if (!cb) {
        throw "cb is required";
    }

    if (!style) {
        style = "default";
    } else if (exports.styles.indexOf(style) === -1) {
        cb("Unknown style: " + style);
        return;
    }
    if (!format) {
        format = "png";
    } else if (["png", "pdf", "svg"].indexOf(format) === -1) {
        cb("Unknown format: " + format);
        return;
    }

    if (description instanceof Buffer) {
        description = description.toString('utf8');
    }
    var query = {
        'style': style,
        'message': description,
        'apiVersion': '1',
        'format': format
    };
    var querys = querystring.stringify(query);

    var u = url.parse(exports.root + "/index.php");
    u.method = 'POST';
    u.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': querys.length
    };

    var req = https.request(u, function(res) {
        getResultBuffer(res, function(er, buf, typ){
            if (er) {
                cb(er);
                return;
            }
            if (!(typ === "application/x-json" || typ === "application/json")) {
                cb("Invalid MIME type for JSON: " + typ);
                return;
            }

            var jres;
            try {
                jres = JSON.parse(buf);
            } catch (e) {
                cb("JSON Syntax error: " + e.message);
                return;
            }

            var errors = jres.errors;
            if (errors && errors.length > 0) {
                cb(errors);
                return;
            }

            if (!jres.img) {
                cb("JSON response does not contain an img: " + buf);
                return;
            }

            cb(null, exports.root + "/" + jres.img);
        });
    });
    req.on('error', function(er) {
        cb(er.message);
    });
    req.write(querys);
    req.end();
};

exports.diagram = function diagram(description, style, format, cb) {
    exports.diagram_url(description, style, format, function(er, u) {
        if (er) {
            cb(er);
            return;
        }
        https.get(url.parse(u), function(res) {
            getResultBuffer(res, cb);
        });
    })
};
