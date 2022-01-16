const net = require('net');
const request = require("request");
const fs = require("fs");
const dgram = require('dgram');

const DRIFT_BCAST_UDP_PORT = 5555;  // Drift camera broadcasts its serial number on this UDP port

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        console.log(`Not valid: ${str}`)
        return false;
    }
    return true;
}

let cmdId = null
let sessionToken = null
let rcvdString = null

function sendCommand(command, socket) {
    cmdId = command.msg_id
    rcvdString = ""
    const s = JSON.stringify(command);
    console.log(`Sending ${s}`)
    socket.write(s)
}

function downloadPicture(socket, cameraDosPath, localPath) {
    const t = cameraDosPath.split('//');
    const cameraUnixPath = t[1] + '/' + t[2] + '/' + t[3]
    const url = `http://${socket.remoteAddress}/${cameraUnixPath}`
    console.log(`Requesting ${url} to ${localPath} ...`)
    request.head(url, function (err, res, body) {
        request(url).pipe(fs.createWriteStream(localPath)).on('close', function () {
            console.log(`Received ${localPath} from ${url}`)
        })
    });
}

function processResponse(msg, socket, fileName) {
    console.log(`Received message ID ${msg.msg_id}`)

    switch(msg.msg_id){
        case 257:  // Session started (or not)
            if (msg.rval === 0) {
                sessionToken = msg.param
                console.log(`Started session ${sessionToken}`)
                console.log(`Taking  photo ...`)
                sendCommand({msg_id: 769, token: sessionToken}, socket) // Take photo
            } else {
                console.log(`Failed to start session`)
            }
            break;
        case 258:  // Session ended
            if (msg.rval === 0) {
                console.log(`Stopped session ${sessionToken}`)
            } else {
                console.log(`Failed to stop session`)
            }
            console.log('Closing socket')
            socket.destroy()
            break;
        case 769:  // Photo results
            if (msg.rval !== 0) {
                console.log(`Failed to take picture, try it again`)  // FIXME set maximum number of tries
                // Try again
                sendCommand({msg_id: 769, token: sessionToken}, socket) // Take photo
                // sendCommand({msg_id: 258, token: sessionToken}, socket) // Close the command session
            }
            break;
        case 7: // Notification
            switch(msg.type){
                case "start_photo":
                    break;
                case "ignore_msg":
                    console.log(`Failed to take picture`)
                    sendCommand({msg_id: 258, token: sessionToken}, socket) // Close the command session
                    break;
                case "photo_complete":
                    sendCommand({msg_id: 258, token: sessionToken}, socket) // Close the command session
                    downloadPicture(socket, msg.param, fileName)
                    break;
            }
            break;
    }

}

function captureJpeg (ipAddr, fileName) {
    console.log(`Capturing from ${ipAddr}`)

    const socket = net.Socket();
    socket.connect(7878, ipAddr);

    socket.on('connect' , function () {
        // Send the initial message once connected
        console.log('Connected, sending start session')
        sendCommand({token: 0, msg_id: 257}, socket) // Start session
    })

    socket.on('data', function (chunk) {
        console.log(`Received ${chunk}`)
        rcvdString += chunk
        rcvdString = rcvdString.replace(/\\/g, '/')
        if ( IsJsonString(rcvdString) ){
            const msg = JSON.parse(rcvdString);
            processResponse(msg, socket, fileName);
            rcvdString = ""
        }
    })

}


function detectCameras(cb){
    const server = dgram.createSocket('udp4');

    server.on('error', (err) => {
        console.log(`server error:\n${err.stack}`);
        server.close();
    });

    server.on('message', (msg, rinfo) => {
        console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
        const t = msg.toString('utf8').split('|')
        if (t[0] === '5') {
            const cameraId = t[1]
            const model= t [2]
            server.close()
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

module.exports = {
    captureJpeg: captureJpeg,
}

detectCameras( (address, cameraId, cameraModel) => {
    console.log(`Detected camera  ${cameraId}-${cameraModel} at ${address}`);
    captureJpeg(address, '/tmp/pict.jpg')
})

