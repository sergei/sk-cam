
// noinspection HttpUrlsUsage

const  fs = require('fs')
const request = require('request');
const moment = require('moment');
const glob = require('glob');
const s3Uploader = require('./s3_uploader')
const nmea = require('./nmea.js')
const path = require("path");

const DEFAULT_MAX_PICS = 3

module.exports = function (app) {

    const cameras = {}
    let pluginOptions = {}
    let cameraSettings = {
        framesize: 10,
        quality: 10
    }

    function get_basename(path) {
        return path.split('/').reverse()[0];
    }

    function rotatePictures(){
        glob(pluginOptions.pictures_dir + '/**/*.json', {}, (err, files)=>{
            if (files.length >= pluginOptions.max_pics_to_keep){
                const num_to_delete = files.length - pluginOptions.max_pics_to_keep + 1
                app.debug(`Need to delete ${num_to_delete} old snapshots`)
                const files_to_delete = files.sort().slice(0, num_to_delete)
                files_to_delete.forEach(file => {
                    const basename = get_basename(file)
                    if( basename.split('_').length === 2 && basename.startsWith('cam-')){
                        const prefix = basename.split('_')[0]
                        fs.readdir(pluginOptions.pictures_dir, (err, files) => {
                            if (err)
                                app.error(err);
                            else {
                                files.forEach(file => {
                                    if ( file.startsWith(prefix) ) {
                                        const path = `${pluginOptions.pictures_dir}/${file}`
                                        app.debug(`Deleting ${path}`)
                                        fs.unlink(path, (err) => {
                                            if ( err )
                                                app.debug(err)
                                        })
                                    }
                                })
                            }
                        })
                    }
                })
            }
        })
    }

    function takeCameraSnapshot() {
        rotatePictures()

        const filePrefix = `cam-${moment().format('YYYY-MM-DD-HH-mm-ss')}`

        snapshots = []
        Object.keys(cameras).forEach((cam_id) => {
            const camera = cameras[cam_id]
            const url = `http://${camera.ip}:${camera.camera_port}/capture`
            const base_name = `${filePrefix}_${camera.id}.jpg`
            const filename = `${pluginOptions.pictures_dir}/${base_name}`

            snapshots.push({
                cam_id: camera.id,
                filename: base_name
            })

            console.log(`Requesting ${url} to ${filename} ...`)
            request.head(url, function (err, res, body) {
                request(url).pipe(fs.createWriteStream(filename)).on('close', function () {
                    console.log(`Received ${filename} from ${url}`)
                })
            });
        })

        const metaData = {
            uuid: app.getSelfPath('uuid'),
            environment: app.getSelfPath('environment'),
            navigation: app.getSelfPath('navigation'),
        }

        const metaFileBaseName = `${filePrefix}_meta.json`
        const metaFileName = `${pluginOptions.pictures_dir}/${metaFileBaseName}`

        fs.writeFile(metaFileName, JSON.stringify(metaData), err => {
            if (err) {
                app.debug(`Error creating metafile ${metaFileName} ${err}`)
                return
            }
            app.debug(`Created metafile ${metaFileName}`)
        })

        const sentence = nmea.toSentence([
            '$POTTO',
            'CAM',
            'CAPTURE',
            metaFileBaseName,
        ])
        app.emit('nmea0183out', sentence)

        app.handleMessage(plugin.id, {
            updates: [{
                values: [{
                    path: 'cameras.snapshot',
                    value: {
                        meta: metaFileBaseName,
                        snapshots: snapshots
                    }
                }]
            }]
        })
    }

    // Client requested snapshot(s)
    let snapshotTimer = null
    let boatSpeedThreshold = 0  // Only take screenshots if boat moving faster than specified value
    let currentBoatSpeed = 0;

    function takeConditionalSnapShot(){
        if( currentBoatSpeed >= boatSpeedThreshold ){
            takeCameraSnapshot()
        }else{
            app.debug(`Skip snapshot since ${currentBoatSpeed} < ${boatSpeedThreshold}`)
        }
    }

    function processDelta(u) {
        u.values.forEach(value => {
            if( value.path === 'navigation.speedOverGround') {
                currentBoatSpeed = value.value
            }
        })
    }

    function doCapture(context, path, params, callback){
        app.debug('Got camera capture request', params);
        if ('type' in params && params.type === 'periodic') {
            if( params.interval > 0 ){
                if( 'min_sog' in params)
                    boatSpeedThreshold = params.min_sog * 1852 / 3600.  // Convert KTS to m/s
                else
                    boatSpeedThreshold = 0
                snapshotTimer = setInterval(takeConditionalSnapShot, params.interval * 1000)
            }
            else if( params.interval === 0 && snapshotTimer){
                app.debug('Stop periodic snapshots')
                clearInterval(snapshotTimer)
                snapshotTimer = null
            }
        } else { // Do just single snapshot
            takeCameraSnapshot();
        }

        return { state: 'COMPLETED', statusCode: 200 };
    }

    // This function updates the connected camera settings
    function configureCamera(camera) {
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

    // Update the SK path "cameras" with the list of the connected cameras
    function postCamerasInfo(){
        const camera_list = []
        Object.keys(cameras).forEach((cam_id) => {
            camera_list.push({
                id: cam_id,
                rssi: cameras[cam_id].rssi,
                uptime: cameras[cam_id].uptime,
                url: `http://${cameras[cam_id].ip}:${cameras[cam_id].camera_port}`,
                stream: `http://${cameras[cam_id].ip}:${cameras[cam_id].stream_port}`,
            })
        })

        app.handleMessage(plugin.id , {
            updates: [
                {
                    values: [
                        {
                            path: 'cameras',
                            value: camera_list
                        }
                    ]
                }
            ]
        })
    }

    // Called when SK server client sends the PUT request with new cameras settings
    function updateCameraSettings(context, path, settings, callback) {
        app.debug('Got cameras settings', settings);
        cameraSettings = settings
        Object.keys(cameras).forEach((cam_id) => {
            configureCamera(cameras[cam_id])
        })
        return { state: 'COMPLETED', statusCode: 200 };
    }

    /// Called when we received the PUT request from the connected camera
    function updateCameraList(context, path, info, callback) {
        if ( 'id' in info && 'ip' in info && 'camera_port' in info && 'stream_port' in info) {
            let camera = {
                id: info.id,
                ip: info.ip,
                rssi: info.rssi,
                uptime: info.uptime,
                camera_port: info.camera_port,
                stream_port: info.stream_port,
            };

            let need_to_configure = false
            // Check if new camera got connected or existing camera gor reset
            if ( !(info.id in cameras) ){
                app.debug('New camera got connected')
                need_to_configure = true
            } else if ( info.uptime < cameras[info.id].uptime ) {
                app.debug('Camera was reset')
                need_to_configure = true
            }
            cameras[info.id] = info
            app.debug('Got camera update', cameras);
            if ( need_to_configure ){
                configureCamera(info)
            }
            postCamerasInfo()
            return { state: 'COMPLETED', statusCode: 200 };
        }else{
            app.debug('Invalid camera info received')
            return { state: 'COMPLETED', statusCode: 400 };
        }
    }

    const isEnabled = () => {
        return enabled;
    }

    const plugin = {};

    plugin.id = 'sk-cam';
    plugin.name = 'ESP32 Cam plugin';
    plugin.description = 'Plugin to support ESP32 Cam';

    let enabled = true;
    let unsubscribes = []

    plugin.start = function (options, restartPlugin) {
        // Here we put our plugin logic
        app.debug('Plugin starting...');
        enabled = true

        pluginOptions = options

        if(  pluginOptions.pictures_dir === undefined || pluginOptions.pictures_dir.trim() === "" ){
            pluginOptions.pictures_dir = '/tmp/sk-cam'
        }

        if(  pluginOptions.max_pics_to_keep === undefined ){
            pluginOptions.max_pics_to_keep = DEFAULT_MAX_PICS
        }

        if (!fs.existsSync(pluginOptions.pictures_dir)){
            fs.mkdirSync(pluginOptions.pictures_dir);
        }

        // Configure PUT paths

        // Inform plugin about connected camera
        app.registerPutHandler('vessels.self', 'camera.info', updateCameraList)

        // Set camera capture settings
        app.registerPutHandler('vessels.self', 'cameras.settings', updateCameraSettings)

        // Request capture
        app.registerPutHandler('vessels.self', 'cameras.capture', doCapture)

        // Mount the file upload routes

        // Get files list
        app.get('/sk-cam', function(req, res, next) {
            fs.readdir(pluginOptions.pictures_dir, (err, files) => {
                if (err) {
                    res.status(500)
                    res.send('Error reading pictures list')
                }else {
                    res.type('json')
                    res.json({files:files})
                }
            })
        })

        // Download individual file
        app.get('/sk-cam/:filename', function(req, res, next) {
            const name = path.join(pluginOptions.pictures_dir, req.params.filename)
            res.sendFile(name)
        })

        if ( pluginOptions.enable_aws_s3_upload ) {
          app.debug('AWS S3 upload enabled');
          const t = app.getSelfPath('uuid').split(':');
          const myUuid = t[t.length - 1]
          s3Uploader(options, myUuid, pluginOptions.pictures_dir, app.debug, app.error, isEnabled)
        }else{
          app.debug('AWS S3 upload is disabled');
        }

        let localSubscription = {
            context: '*', // Get data for all contexts
            subscribe: [{
                path: 'navigation.speedOverGround',
                period: 1000
            }]
        }

        app.subscriptionmanager.subscribe(
            localSubscription,
            unsubscribes,
            subscriptionError => {
                app.error('Error:' + subscriptionError);
            },
            delta => {
                delta.updates.forEach(u => {
                    processDelta(u);
                })
            }
        )

        app.debug('Plugin started')
    }

    plugin.stop = function () {
        // Here we put logic we need when the plugin stops
        enabled = false
        unsubscribes.forEach(f => f());
        unsubscribes = [];
        app.debug('Plugin stopped');
    };

    plugin.schema = {
        type: 'object',
        required: [],
        properties: {
            pictures_dir: {
                type: 'string',
                title: 'Pictures directory (leave empty for default)'
            },
            max_pics_to_keep: {
                type: 'number',
                title: 'Maximum number of pictures to keep',
                default: DEFAULT_MAX_PICS
            },

            enable_aws_s3_upload: {
                type: 'boolean',
                title: 'Enable upload to S3',
                default: false
            },

            aws_s3_bucket_name: {
                type: 'string',
                title: 'AWS S3 bucket name, e.g. com.example.sk-cam'
            },
            aws_region: {
                type: 'string',
                title: 'AWS Region'
            },
            aws_access_key_id: {
                type: 'string',
                title: 'AWS Access Key ID'
            },
            aws_secret_access_key: {
                type: 'string',
                title: 'AWS Secret Access Key'
            },
        }
    };

    return plugin;
};
