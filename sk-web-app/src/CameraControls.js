import React from "react";
import {
    Checkbox,
    FormControl,
    FormControlLabel,
    InputLabel,
    makeStyles,
    MenuItem,
    Select,
    Snackbar, TextField
} from "@material-ui/core";
import MuiAlert from '@material-ui/lab/Alert';
import {PhotoCamera} from "@material-ui/icons";
import Button from "@material-ui/core/Button";
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
    const [frameSize, setFrameSize] = React.useState('');
    const [periodicParams, setPeriodicParams] = React.useState({
        enablePeriodic: false,
        movingOnly: false,
    });
    const [snapshotPeriod, setSnapshotPeriod] = React.useState(60);

    const handleEnableCheckBox = (event) => {
        const newParams = { ...periodicParams, [event.target.name]: event.target.checked };
        setPeriodicParams(newParams);
        updatePeriodicParams(newParams.enablePeriodic, newParams.movingOnly, snapshotPeriod)
    };

    const handlePeriodChange = (event) => {
        const snapshotPeriod = event.target.value
        setSnapshotPeriod(snapshotPeriod)
        updatePeriodicParams(periodicParams.enablePeriodic, periodicParams.movingOnly, snapshotPeriod)
    };

    const handleFrameSizeChange = (event) => {
        setFrameSize(event.target.value);
        putCamSettings({
            framesize: event.target.value
        })
    };

    const handleSnackBarClose = (event, reason) => {
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

    const putCaptureRequest = (params) => {
        props.client
            .API()
            .then((api) => api.put('/vessels/self/cameras/capture', {value: params}))
            .then((result) => {
                console.log(result)
            })
            .catch((err) => {
                setErrorMessage({open:true, err: err.toString()});
                console.log('error[', err.toString(), ']')
            })
    }

    const doSingleSnapshot = () => {
        putCaptureRequest({})
    }

    const updatePeriodicParams = (enablePeriodic, movingOnly, period) => {
        putCaptureRequest({
            type: 'periodic',
            period: enablePeriodic ? parseInt(period) : 0,
            min_sog: movingOnly ? 1 : 0,
        })
    }

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

    const isPositiveNumber = (value) => {
        return /^\d+$/.test(value) && parseInt(value) > 0;
    }

    return (
        <div className={classes.root}>

            <form className={classes.root} noValidate autoComplete="off" >
                <FormControlLabel className={classes.formControl}
                    control={<Checkbox checked={periodicParams.enablePeriodic} onChange={handleEnableCheckBox} name="enablePeriodic" />}
                    label="Enable periodic shots"
                />
                <FormControlLabel className={classes.formControl}
                    control={<Checkbox checked={periodicParams.movingOnly} onChange={handleEnableCheckBox} name="movingOnly" />}
                    label="Only if moving"
                />

                {isPositiveNumber(snapshotPeriod) &&  <TextField className={classes.formControl} id="standard-basic" label="Period (seconds)" defaultValue={snapshotPeriod}  onChange={handlePeriodChange} />}
                {!isPositiveNumber(snapshotPeriod) &&  <TextField className={classes.formControl} error helperText="Period must be positive number" id="standard-basic" label="Period (seconds)" defaultValue={snapshotPeriod}  onChange={handlePeriodChange} />}
                <FormControl className={classes.formControl}>
                    <InputLabel id="demo-simple-select-label">Resolution</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={frameSize}
                        onChange={handleFrameSizeChange}
                    >
                        { resolutions.map( res => (<MenuItem value={res.idx}>{res.label}</MenuItem>)) }
                    </Select>
                </FormControl>
            </form>
            <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PhotoCamera />}
                onClick={doSingleSnapshot}
            >
                Snapshot
            </Button>
            <Snackbar open={errorMessage.open} autoHideDuration={6000} onClose={handleSnackBarClose}>
                <Alert onClose={handleSnackBarClose} severity="error">
                    {errorMessage.err}
                </Alert>
            </Snackbar>
        </div>
    )
}

export default CameraControls;
