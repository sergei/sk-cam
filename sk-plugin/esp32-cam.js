const request = require("request");
const fs = require("fs");

function captureJpeg (camera, filename, cb) {
    const url = `http://${camera.ip}:${camera.camera_port}/capture`
    console.log(`Requesting ${url} to ${filename} ...`)
    request.head(url, function (err, res, body) {
        request(url).pipe(fs.createWriteStream(filename)).on('close', function () {
            cb(err)
        })
    });

}

function configureCamera(app, camera, cameraSettings){

    Object.keys(cameraSettings).forEach((param) => {
        const url =  `http://${camera.ip}:${camera.camera_port}/control?var=${param}&val=${cameraSettings[param]}`
        app.debug(`Sending ${url}`)
        request
            .get(url)
            .on('response', function(response) {
                app.debug('cameraSettings status code',response.statusCode)
            })
            .on('error', function(err) {
                app.error('cameraSettings error:',err)
            })
    })

}

module.exports = {
    captureJpeg: captureJpeg,
    configureCamera: configureCamera,
}
