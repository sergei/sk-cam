const s3Uploader = require('../s3_uploader')

// Copy file secret-pattern.js to secret.js and put your secret information here 
const options = require('./secret')

console.log(options)

const logDir = '/Users/sergei/debuglog/signalk/server'
const prefix = 'local_test'
s3Uploader(options, prefix, logDir, console.log, console.log, () => {return true})

