import React, {useEffect} from "react";
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

    // Get settings from the server
    useEffect(() => {
        // Runs ONCE after initial rendering
        props.client
            .API()
            .then((api) => api.get('/vessels/self/cameras'))
            .then((result) => {
                console.log("Result", result)
                const schedule = result.schedule.value
                console.log("Schedule", schedule)
                setPeriodicParams( {
                    enablePeriodic: schedule.periodSec > 0,
                    movingOnly: schedule.boatSpeedThreshold > 0
                })
                if( schedule.periodSec > 0 ){
                    setSnapshotPeriod(schedule.periodSec)
                }
                const settings = result.settings.value
                console.log("Settings", settings)
                setFrameSize(settings.framesize)

            })
            .catch((err) => {
                setErrorMessage({open:true, err: err.toString()});
                console.log('error[', err.toString(), ']')
            })
    },
    // eslint-disable-next-line
    []);

    const handleEnableCheckBox = (event) => {
        const newParams = { ...periodicParams, [event.target.name]: event.target.checked };
        setPeriodicParams(newParams);
        updateSchedule(newParams.enablePeriodic, newParams.movingOnly, snapshotPeriod)
    };

    const handlePeriodChange = (event) => {
        const snapshotPeriod = event.target.value
        setSnapshotPeriod(snapshotPeriod)
        updateSchedule(periodicParams.enablePeriodic, periodicParams.movingOnly, snapshotPeriod)
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

    const doSingleSnapshot = () => {
        props.client
            .API()
            .then((api) => api.put('/vessels/self/cameras/capture', {value:{}}))
            .then((result) => {
                console.log(result)
            })
            .catch((err) => {
                setErrorMessage({open:true, err: err.toString()});
                console.log('error[', err.toString(), ']')
            })
    }

    const updateSchedule = (enablePeriodic, movingOnly, period) => {
        props.client
            .API()
            .then((api) => api.put('/vessels/self/cameras/schedule', {value: {
                type: 'periodic',
                period: enablePeriodic ? parseInt(period) : 0,
                min_sog: movingOnly ? 1 : 0,
            }}))
            .then((result) => {
                console.log(result)
            })
            .catch((err) => {
                setErrorMessage({open:true, err: err.toString()});
                console.log('error[', err.toString(), ']')
            })
    }

    const resolutions = [
        {idx: 13, label: 'UXGA(1600x1200)'},
        {idx: 12, label: 'SXGA(1280x1024)'},
        {idx: 11, label: 'HD(1280x720)'},
        {idx: 10, label: 'XGA(1024x768)'},
        {idx: 9, label: 'SVGA(800x600)'},
        {idx: 8, label: 'VGA(640x480)'},
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

                {isPositiveNumber(snapshotPeriod) &&  <TextField className={classes.formControl} id="standard-basic" label="Period (seconds)"  value={snapshotPeriod} onChange={handlePeriodChange} />}
                {!isPositiveNumber(snapshotPeriod) &&  <TextField className={classes.formControl} error helperText="Period must be positive number" id="standard-basic" label="Period (seconds)" defaultValue={snapshotPeriod}  onChange={handlePeriodChange} />}
                <FormControl className={classes.formControl}>
                    <InputLabel id="demo-simple-select-label">Resolution</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={frameSize}
                        onChange={handleFrameSizeChange}
                    >
                        { resolutions.map( res => (<MenuItem key={res.idx} value={res.idx}>{res.label}</MenuItem>)) }
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
