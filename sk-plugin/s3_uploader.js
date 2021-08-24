const fs = require('fs');
const path = require('path')
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const UPLOAD_BATCH_SIZE = 5;
const TIME_BETWEEN_BATCHES  = 5 * 1000
const TIME_BETWEEN_ATTEMPTS = 15 * 60 * 1000

module.exports = function (options, prefix, logDir, debug, error, isEnabled) {

    const uploadSingleFile = (file, cb) => {
        fs.readFile(file, (err, data) => {
            if (err) { 
                error(err)
                numToUpload --
                cb(numToUpload)
            }else{
                const uploadParams = {
                    Bucket: options.aws_s3_bucket_name,
                    ContentType: 'application/gzip',
                    Key: prefix + '/camera/' + path.basename(file)
                };
                debug('Uploading ', uploadParams.Key,' Size', data.length, ' bytes')
                uploadParams.Body = data;
                s3.send(new PutObjectCommand(uploadParams))
                    .then(() => {
                        debug('Uploaded', uploadParams.Key, ' deleting ...')
                        fs.unlink(file, (err) => { if(err) error('Failed to delete ', file, err)});
                    })
                    .catch((err) => {
                        error('Error uploading ',uploadParams.Key, err)
                    })
                    .finally(() => {
                        numToUpload --
                        cb(numToUpload)
                    });

            }
        });        
    };

    // This function uploads files from the provided list
    const uploadMultipleFiles = (files, cb) => {
        numToUpload = files.length
        cb(numToUpload)
        files.map( file => {
            uploadSingleFile(file, cb)
        })
    };

    // This function looks for the serve logs in the log folder and uploads N of them to the S3 bucket
    const uploadSomeLogs = () => {
        fs.readdir(logDir, (err, files) => {
            const serverLogs = files.filter(name=>name.startsWith('cam-'))
                                    .sort()  // Sorting by name implies sorting by time stamp due to server logs naming

            // Limit number of files uploaded in one batch not to strain the resources
            let numFilesToUpload = Math.min(UPLOAD_BATCH_SIZE, serverLogs.length)

            const filesToUpload = serverLogs.slice(0, numFilesToUpload).map(name => path.join(logDir,name))
            debug(filesToUpload)

            if ( numFilesToUpload > 0 ) {
                uploadMultipleFiles(filesToUpload, uploadStatus)
            }else{
                if ( isEnabled() ) {
                    debug('Nothing to upload. Check again in', TIME_BETWEEN_ATTEMPTS / 1000, 'sec')
                    setTimeout(uploadSomeLogs, TIME_BETWEEN_ATTEMPTS)
                }else{
                    debug('Plugin got disabled')
                }
            }
        });        
    }

    // This callback is called each time the upload is completed either successfully or not
    const uploadStatus = (numToUpload) => {
        debug('Remaining files to upload:', numToUpload)            
        if ( numToUpload === 0 ){
            if ( isEnabled() ) {
                debug('schedule next batch upload')
                setTimeout(uploadSomeLogs, TIME_BETWEEN_BATCHES)
            }else{
                debug('Plugin got disabled')
            }
        }
    }

    debug('log will be read from ', logDir);
    debug('Logs will be uploaded to ', options.aws_s3_bucket_name);

    // Create an Amazon S3 service client object.
    const s3 = new S3Client({ 
        region: options.aws_region,
        credentials: {
            accessKeyId: options.aws_access_key_id,
            secretAccessKey: options.aws_secret_access_key,
        }
        });

    // Start first batch upload
    let numToUpload =  0;
    uploadSomeLogs();

}
