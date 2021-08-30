# sk-cam SignalK server plugin

This plugin implements the paths necessary to control ESP32 cameras connected to the SignalK server network. 

## Configuration parameters 
- pictures_dir
- max_pics_to_keep
- enable_aws_s3_upload
- aws_s3_bucket_name
- aws_region
- aws_access_key_id
- aws_secret_access_key

## The following path is emitted 

### vessels/\<RegExp>/cameras
```json
[
  {
    "id": "CAM_12345",
    "rssi": -50,
    "uptime": 123,
    "url": "http://1.2.3.4:3333",
    "stream": "http://1.2.3.4:3334"
  }
]
```

### vessels/\<RegExp>/cameras/snapshot
```json
[
  {
    "meta": "meta.json",
    "snapshots": [{
      "cam_id": "CAM_12345",
      "filename": "picture.jpg"
    }
    ]
  }
]

```

## The following PUT paths are implemented 

### vessels/\<RegExp>/cameras/settings
```json
{
  "value": {
    "framesize":9,
    "quality" : 11
  }
}
```
### vessels/\<RegExp>/cameras.capture
#### Single shot
```json
{}
```
#### Start Periodic shots  
```json
{
  "type": "periodic",
  "period": 60,
  "min_sog" : 1
}
```
#### Stop Periodic shots  
```json
{
  "type": "periodic",
  "interval": 0
}
```

### vessels/\<RegExp>/camera/info
The camera uses this path to add itself to the server. 
```json
{
  "id": 12345,
  "ip": "1.2.3.4",
  "rssi": -50,
  "uptime": 123,
  "camera_port": 80,
  "stream_port": 81
}
```

## The following HTTP GET paths are exposed 
### http://x.x.x.x:port/sk-cam
Downloads the JSON document with the list of created snapshots 
### http://x.x.x.x:port/sk-cam/filename
Retrieves the individual snapshot
