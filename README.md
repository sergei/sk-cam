# sk-cam
SignalK support for ESP32 CAM

## How to install the plugin bypassing the Appstore 
```bash
cd sk-pugin
npm pack
scp sk-cam-1.0.0.tgz pi@wrpi:/tmp
ssh pi@wrpi
cd ~./signalk
npm install /tmp/sk-cam-1.0.0.tgz
```

