const StreamValues = require('stream-json/streamers/StreamValues');
const q = StreamValues.withParser();
q.on('data', (data) => console.log('data:',data));
q.on('error', (err) => console.log('error:'));
q.write('{"a":1}')
q.write('{"a"')
q.write(':1}{')
q.write('}')
q.write('[{"a":1},{"a":"c:\\a"}]')
