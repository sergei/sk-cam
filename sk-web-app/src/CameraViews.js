import React, {useEffect} from "react";
import {IconButton, ImageList, ImageListItem, ImageListItemBar, ListSubheader, makeStyles} from "@material-ui/core";
import SignalWifi4BarIcon from '@material-ui/icons/SignalWifi4Bar';
import SignalWifi3BarIcon from '@material-ui/icons/SignalWifi3Bar';
import SignalWifi2BarIcon from '@material-ui/icons/SignalWifi2Bar';
import SignalWifi1BarIcon from '@material-ui/icons/SignalWifi1Bar';

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

    const [cameras, setCameras] = React.useState([]);

    useEffect(() => {
        // Runs ONCE after initial rendering
        props.client.on('delta', (delta) => {
            delta.updates.forEach( update => {
                update.values.forEach(value => {
                    if(value.path === 'cameras'){
                        console.log(value.value)
                        setCameras(value.value)
                    }
                })
            })
        })
    }, []);

    const wifiIcon = (rssi) => {
        if ( rssi > -50 )
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
                {cameras.map((item) => (
                    <ImageListItem key={item.url}>
                        <img src={item.url+'/capture'} alt={item.id} />
                        <ImageListItemBar
                            title={item.id}
                            actionIcon={
                                <IconButton aria-label={`RSSI ${item.rssi} dBm`} className={classes.icon}>
                                    {wifiIcon(item.rssi)}
                                </IconButton>
                            }
                        />
                    </ImageListItem>
                ))}
            </ImageList>
        </div>
    )
}

export default CameraViews;
