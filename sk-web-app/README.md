# SK Cam controller Web App
This is SignalK WebApp to control the ESP32 cameras

## How to deploy 
```bash
./build.sh
cd deploy
scp sk-cam-web-app-1.0.0.tgz pi@wrpi:/tmp
ssh pi@wrpi
cd ~/.signalk
npm install /tmp/sk-cam-web-app-1.0.0.tgz
```
