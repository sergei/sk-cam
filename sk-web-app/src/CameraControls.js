import React, {useEffect} from "react";
import {FormControl, InputLabel, makeStyles, MenuItem, Select, Snackbar} from "@material-ui/core";
import MuiAlert from '@material-ui/lab/Alert';
function Alert(props) {
    return <MuiAlert elevation={6} variant="filled" {...props} />;
}
const useStyles = makeStyles((theme) => ({
    root: {
        width: '100%',
        '& > * + *': {
            marginTop: theme.spacing(2),
        },
    },
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
    selectEmpty: {
        marginTop: theme.spacing(2),
    },
}));

function CameraControls(props) {
    const classes = useStyles();

    const [errorMessage, setErrorMessage] = React.useState({open:false, err: ''});

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setErrorMessage({open:false, err: ''});
    };

    const putCamSettings = (cam_settings) => {
        props.client
            .API()
            .then((api) => api.put('/vessels/self/cameras/settings', {value: cam_settings}))
            .then((result) => {
                console.log(result)
            })
            .catch((err) => {
                setErrorMessage({open:true, err: err.toString()});
                console.log('error[', err.toString(), ']')
            })
    }

    const [framesize, setFramesize] = React.useState('');

    const handleChange = (event) => {
        setFramesize(event.target.value);
        putCamSettings({
            framesize: event.target.value
        })
    };

    const resolutions = [
        {idx: 10, label: 'UXGA(1600x1200)'},
        {idx: 9, label: 'SXGA(1280x1024)'},
        {idx: 8, label: 'XGA(1024x768)'},
        {idx: 7, label: 'SVGA(800x600)'},
        {idx: 6, label: 'VGA(640x480)'},
        {idx: 5, label: 'CIF(400x296)'},
        {idx: 4, label: 'QVGA(320x240)'},
        {idx: 3, label: 'HQVGA(240x176)'},
        {idx: 0, label: 'QQVGA(160x120)'},
    ]

    return (
        <div className={classes.root}>
            <FormControl className={classes.formControl}>
                <InputLabel id="demo-simple-select-label">Resolution</InputLabel>
                <Select
                    labelId="demo-simple-select-label"
                    id="demo-simple-select"
                    value={framesize}
                    onChange={handleChange}
                >
                    { resolutions.map( res => (<MenuItem value={res.idx}>{res.label}</MenuItem>)) }
                </Select>
            </FormControl>
            <Snackbar open={errorMessage.open} autoHideDuration={6000} onClose={handleClose}>
                <Alert onClose={handleClose} severity="error">
                    {errorMessage.err}
                </Alert>
            </Snackbar>
        </div>
    )
}

export default CameraControls;
