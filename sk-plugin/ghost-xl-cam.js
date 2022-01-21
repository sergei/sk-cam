const net = require('net');
const request = require("request");
const fs = require("fs");
const dgram = require('dgram');
const StreamValues = require('stream-json/streamers/StreamValues');

const DRIFT_BCAST_UDP_PORT = 5555;  // Drift camera broadcasts its serial number on this UDP port

// RPC protocol message IDs
const MSG_ID_SESSION_START = 257;
const MSG_ID_SESSION_STOP = 258;
const MSG_ID_SETTINGS = 2;
const MSG_ID_TAKE_PHOTO = 769;
const MSG_ID_NOTIFICATION = 7;
const MSG_ID_DELETE = 1281;

function captureJpeg (camera, fileName, onCaptureEnd) {

    const ipAddr = camera.ip
    let cmdId = null
    let sessionToken = null

    console.log(`${camera.id}: Capturing from ${ipAddr}`)
    const jsonParser = StreamValues.withParser();

    const captureTimeout = setTimeout(() => {
        console.error(`${camera.id} Capture timeout expired`);
        if( !socket.destroyed){
            socket.destroy()
        }
        onCaptureEnd('Capture timeout expired')
    }, 5000);

    const socket = net.Socket();
    socket.connect(7878, ipAddr);

    socket.on('connect' , function () {
        // Send the initial message once connected
        console.log(`${camera.id}: Connected, sending start session`)
        sendCommand({token: 0, msg_id: MSG_ID_SESSION_START}, socket) // Start session
    })

    // Parse incoming data
    // Receive TCP chunks and feed them to the JSON parser
    socket.on('data', function (chunk) {
        console.log(`${camera.id} Received ${chunk}`)
        chunk = chunk.toString().replace(/\\/g, '/')  // Somehow JSON doesn't like \
        jsonParser.write(chunk)
    })

    // On received JSON object
    jsonParser.on('data', (data) => {
        processResponse(data.value, socket, fileName, (err) => {
            clearTimeout(captureTimeout)
            onCaptureEnd(err)
        });
    })

    // Error handling
    socket.on('error', () =>{
        console.error(`${camera.id}: ${ipAddr} socket error `)
        clearTimeout(captureTimeout)
        onCaptureEnd('socket error')
    })

    socket.on('timeout', () =>{
        console.error(`${camera.id}: ${ipAddr}: socket timeout `)
        clearTimeout(captureTimeout)
        onCaptureEnd('socket timeout')
    })

    jsonParser.on('error', (err) => {
        console.error(err)
        clearTimeout(captureTimeout)
        onCaptureEnd('socket error')
    })

    function sendCommand(command, socket) {
        cmdId = command.msg_id
        const s = JSON.stringify(command);
        console.log(`${camera.id}: Sending ${s}`)
        socket.write(s)
    }

    function processResponse(msg, socket, fileName, onCaptureEnd) {
        console.log(`${camera.id}: Received message ID ${msg.msg_id}`)

        switch(msg.msg_id){
            case MSG_ID_SESSION_START:  // Session started (or not)
                if (msg.rval === 0) {
                    sessionToken = msg.param
                    console.log(`${camera.id}: Started session ${sessionToken}`)
                    // Set capture mode ( "1" = photo)
                    sendCommand({msg_id: MSG_ID_SETTINGS, param: "1", token: sessionToken, type: 'capture_mode' }, socket)
                } else {
                    console.error(`${camera.id}: Failed to start session`)
                    onCaptureEnd("Failed to start session")
                }
                break;
            case MSG_ID_SETTINGS:  // Settings results
                if (msg.rval === 0) {
                    if(msg.type === "capture_mode"){
                        // Set photo resolution ( "2" - 4MB)
                        sendCommand({msg_id: MSG_ID_SETTINGS, param: "2", token: sessionToken, type: 'photo_size' }, socket)
                    }else{
                        console.log(`${camera.id}: Taking  photo ...`)
                        sendCommand({msg_id: MSG_ID_TAKE_PHOTO, token: sessionToken}, socket) // Take photo
                    }
                } else {
                    console.error(`${camera.id}: Failed to set photo resolution`)
                    sendCommand({msg_id: MSG_ID_SESSION_STOP, token: sessionToken}, socket) // Close the command session
                }
                break;
            case MSG_ID_TAKE_PHOTO:  // Photo results
                if (msg.rval !== 0) {
                    console.error(`${camera.id}: Failed to take picture, try it again`)  // FIXME set maximum number of tries
                    // Try again
                    sendCommand({msg_id: MSG_ID_TAKE_PHOTO, token: sessionToken}, socket) // Take photo
                }
                break;
            case MSG_ID_NOTIFICATION: // Notification
                switch(msg.type){
                    case "start_photo":
                        break;
                    case "ignore_msg":
                        console.error(`${camera.id}: Failed to take picture`)
                        sendCommand({msg_id: MSG_ID_SESSION_STOP, token: sessionToken}, socket) // Close the command session
                        break;
                    case "photo_complete":
                        downloadPicture(socket, msg.param, fileName, (cameraUnixPath, err) => {
                            onCaptureEnd(err)
                            if ( !err ){
                                // Delete captured file on camera
                                const fname = '/tmp/SD0/' + cameraUnixPath
                                sendCommand({msg_id: MSG_ID_DELETE, token: sessionToken, param: fname}, socket) // Delete file
                            }else{
                                sendCommand({msg_id: MSG_ID_SESSION_STOP, token: sessionToken}, socket) // Close the command session
                            }
                        })
                        break;
                }
                break;
            case MSG_ID_DELETE:  // Delete result
                sendCommand({msg_id: MSG_ID_SESSION_STOP, token: sessionToken}, socket) // Close the command session
                break;
            case MSG_ID_SESSION_STOP:  // Session ended
                if (msg.rval === 0) {
                    console.log(`${camera.id}: Stopped session ${sessionToken}`)
                } else {
                    console.error(`${camera.id}: Failed to stop session`)
                }
                console.log(`${camera.id}: Closing socket`)
                socket.destroy()
                break;
        }

    }

    function downloadPicture(socket, cameraDosPath, localPath, onCaptured) {
        const t = cameraDosPath.split('//');
        const cameraUnixPath = t[1] + '/' + t[2] + '/' + t[3]
        const url = `http://${socket.remoteAddress}/${cameraUnixPath}`
        console.log(`${camera.id}: Requesting ${url} to ${localPath} ...`)
        request.head(url, function (err, res, body) {
            request(url).pipe(fs.createWriteStream(localPath)).on('close', function () {
                if ( !err ) {
                    console.log(`${camera.id}: Received ${localPath} from ${url}`)
                }else{
                    console.error(`${camera.id}: Failed to download ${localPath} from ${url}`)
                }
                onCaptured(cameraUnixPath, err)
            })
        });
    }

}

function detectCameras(cb){
    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
        console.log(`server error:\n${err.stack}`);
        server.close();
    });

    server.on('message', (msg, rinfo) => {
        const t = msg.toString('utf8').split('|')
        if (t[0] === '5') {
            const cameraId = t[1]
            const model= t[2]
            cb(rinfo.address, cameraId, model)
        }else{
            console.log('Ignore rogue UDP packet')
        }
    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`server listening ${address.address}:${address.port}`);
    });

    server.bind(DRIFT_BCAST_UDP_PORT);
}

function configureCamera(app, camera, cameraSettings) {
// Not much to configure for now. All configuration is done before taking the picture
}

module.exports = {
    captureJpeg: captureJpeg,
    detectCameras: detectCameras,
    configureCamera: configureCamera,
}

// detectCameras( (address, cameraId, cameraModel) => {
//     console.log(`Detected camera  ${cameraId}-${cameraModel} at ${address}`);
//     captureJpeg({ip: address}, '/tmp/pict.jpg', () =>{
//     })
// })
