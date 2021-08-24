
// noinspection HttpUrlsUsage

const  fs = require('fs')
const request = require('request');
const moment = require('moment');
const glob = require('glob');
const DEFAULT_MAX_PICS = 3

module.exports = function (app) {

    const cameras = {}
    let pluginOptions = {}
    let cameraSettings = {}

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

    function doCapture(context, path, params, callback){
        app.debug('Got camera capture request', params);
        rotatePictures()

        const filePrefix = `cam-${moment().format('YYYY-MM-DD-HH-mm-ss')}`
        const metaData = {
            uuid: app.getSelfPath('uuid'),
            environment: app.getSelfPath('environment'),
            navigation: app.getSelfPath('navigation'),
        }
        const metaFileName = `${pluginOptions.pictures_dir}/${filePrefix}_meta.json`

        fs.writeFile(metaFileName, JSON.stringify(metaData), err => {
            if (err) {
                app.debug(`Error creating metafile ${metaFileName} ${err}`)
                return
            }
            app.debug(`Created metafile ${metaFileName}`)
        })

        Object.keys(cameras).forEach((cam_id) => {
            const camera = cameras[cam_id]
            const url = `http://${camera.ip}:${camera.camera_port}/capture`
            const filename = `${pluginOptions.pictures_dir}/${filePrefix}_${camera.id}.jpg`

            console.log(`Requesting ${url} to ${filename} ...`)
            request.head(url, function(err, res, body){
                request(url).pipe(fs.createWriteStream(filename)).on('close', function(){
                    console.log(`Received ${filename} from ${url}`)
                })
            });
        })

        return { state: 'COMPLETED', statusCode: 200 };
    }

    function updateCameraSettings(context, path, settings, callback){
        app.debug('Got camera settings', settings);
        cameraSettings = settings
        return { state: 'COMPLETED', statusCode: 200 };
    }

    function postCamerasInfo(){

        const camera_list = []
        Object.keys(cameras).forEach((cam_id) => {
            camera_list.push({
                id: cam_id,
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

    function updateCameras(context, path, info, callback) {

        if ( 'id' in info && 'ip' in info && 'camera_port' in info && 'stream_port' in info) {
            cameras[info.id] = {
                id: info.id,
                ip: info.ip,
                camera_port: info.camera_port,
                stream_port: info.stream_port,
            }
            app.debug('Got camera update', cameras);
            postCamerasInfo()
            return { state: 'COMPLETED', statusCode: 200 };
        }else{
            app.debug('Invalid camera info received')
            return { state: 'COMPLETED', statusCode: 400 };
        }
    }


    const plugin = {};

    plugin.id = 'sk-cam';
    plugin.name = 'ESP32 Cam plugin';
    plugin.description = 'Plugin to support ESP32 Cam';

    plugin.start = function (options, restartPlugin) {
        // Here we put our plugin logic
        app.debug('Plugin starting...');
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

        app.registerPutHandler('vessels.self', 'camera.info', updateCameras)
        app.registerPutHandler('vessels.self', 'cameras.capture', doCapture)
        app.registerPutHandler('vessels.self', 'cameras.settings', updateCameraSettings)

        app.debug('Plugin started');
    };

    plugin.stop = function () {
        // Here we put logic we need when the plugin stops
        app.debug('Plugin stopped');
    };

    plugin.schema = {
        type: 'object',
        required: ['aws_s3_bucket_name', 'aws_region' ,'aws_access_key_id', 'aws_secret_access_key'],
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
