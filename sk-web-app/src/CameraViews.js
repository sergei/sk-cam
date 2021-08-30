import React, {useEffect} from "react";
import {IconButton, ImageList, ImageListItem, ImageListItemBar, ListSubheader, makeStyles} from "@material-ui/core";
import SignalWifi4BarIcon from '@material-ui/icons/SignalWifi4Bar';
import SignalWifi3BarIcon from '@material-ui/icons/SignalWifi3Bar';
import SignalWifi2BarIcon from '@material-ui/icons/SignalWifi2Bar';
import SignalWifi1BarIcon from '@material-ui/icons/SignalWifi1Bar';
import SignalWifiOffIcon from '@material-ui/icons/SignalWifiOff';
import Moment from 'react-moment';

const useStyles = makeStyles((theme) => ({
    root: {
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        overflow: 'hidden',
        backgroundColor: theme.palette.background.paper,
    },
    imageList: {
        width: 500,
        height: 450,
    },
    icon: {
        color: 'rgba(255, 255, 255, 0.54)',
    },
}));

function CameraViews(props) {
    const classes = useStyles();

    const [snapshot, setSnapshot] = React.useState({meta: '', snapshots: []});
    const [camInfo, setCamInfo] = React.useState({});


    useEffect(() => {
        // Runs ONCE after initial rendering
        props.client.on('delta', (delta) => {
            delta.updates.forEach( update => {
                update.values.forEach(value => {
                    if(value.path === 'cameras.snapshot'){
                        const snapshot = value.value;
                        snapshot.date = update.timestamp.toString()
                        console.log("Snapshot", snapshot)
                        setSnapshot(snapshot)
                    }
                    if(value.path === 'cameras'){
                        const cameras = value.value
                        console.log("Cameras", cameras)
                        const camDict = {}
                        cameras.forEach(camera => {
                            camDict[camera.id] = camera
                        })
                        setCamInfo(camDict)
                    }
                })
            })
        })
    }, []);

    const wifiIcon = (rssi) => {
        if ( rssi === undefined )
            return <SignalWifiOffIcon/>
        else if ( rssi > -50 )
            return <SignalWifi4BarIcon/>
        else if(rssi > -60 )
            return <SignalWifi3BarIcon/>
        else if(rssi > -70 )
            return <SignalWifi2BarIcon/>
        else
            return <SignalWifi1BarIcon/>
    }

    return (
        <div className={classes.root}>
            <ImageList rowHeight={180} className={classes.imageList}>
                <ImageListItem key="Subheader" cols={2} style={{ height: 'auto' }}>
                    <ListSubheader component="div">Cameras</ListSubheader>
                </ImageListItem>
                {snapshot.snapshots.map((item) => {
                    let rssi = undefined
                    console.log('Date', snapshot.date)
                    if (item.cam_id in camInfo){
                        rssi = camInfo[item.cam_id].rssi;
                    }
                    const imgUrl = new URL('/sk-cam/' + item.filename, props.skHost)
                    return (
                        <ImageListItem key={item.url}>
                            <img src={imgUrl} alt={item.cam_id}/>
                            <ImageListItemBar
                                title={item.cam_id}
                                subtitle={<Moment format="HH:mm:ss">{snapshot.date}</Moment>}
                                actionIcon={
                                    <IconButton aria-label={`RSSI ${rssi} dBm`}
                                                className={classes.icon}>
                                        {wifiIcon(rssi)}
                                    </IconButton>
                                }
                            />
                        </ImageListItem>
                    );
                })}
            </ImageList>
        </div>
    )
}

export default CameraViews;
