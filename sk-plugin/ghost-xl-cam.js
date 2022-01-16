const net = require('net');
const request = require("request");
const fs = require("fs");

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
                console.log(`Failed to take picture`)
                sendCommand({msg_id: 258, token: sessionToken}, socket) // Close the command session
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

module.exports = {
    captureJpeg: captureJpeg,
}

captureJpeg('192.168.42.1', '/tmp/pict.jpg')
