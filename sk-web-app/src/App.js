import './App.css';
import Client from "@signalk/client";
import React, {useEffect} from "react";
import LoginDialog from "./LoginDialog";
import ExitToAppOutlinedIcon from '@material-ui/icons/ExitToAppOutlined';
import {IconButton} from "@material-ui/core";
import CameraViews from "./CameraViews";
import CameraControls from "./CameraControls";
import CircularProgress from '@material-ui/core/CircularProgress';

function App() {
  console.log('Rendering App ...')

  // Listen to the "delta" event to get the stream data
  const params = {
    hostname: 'localhost',
    port: 3000,
    useTLS: false,
    reconnect: true,
    autoConnect: false,
    notifications: false,
    useAuthentication: false,
    subscriptions: [
      {
        context: 'vessels.*',
        subscribe: [
          {
            path: 'cameras',
            policy: 'instant',
          },
          {
            path: 'cameras.snapshot',
            policy: 'instant',
          },
        ],
      },
    ],
  }

  const [client] = React.useState(new Client(params))
  const [connection, setConnection] = React.useState({connected: false, authenticated: false});
  const [skHost, setSkHost] = React.useState(null)

  useEffect(() => {
    console.log('Creating client')

    client.on('authenticated', (authData) => {
      onAuthenticated();
    })

    client.on('connect', (authData) => {
      onConnect();
    })

    client.on('error', (error) => {
      onError(error);
    })

    console.log('Initiating connection ...')
    client.connect()

    return () => {
      console.log('Disconnecting from the server ...')
      client.disconnect()
    }

  },
      // eslint-disable-next-line
      []);

  function onAuthenticated() {
    console.log('onAuthenticated')
    client.unsubscribe()
    client.subscribe()
    setConnection({connected: true, authenticated: true})
  }

  function onConnect() {
    console.log('onConnect', client)

    const skHost = new URL(client.connection.httpURI).origin
    setSkHost(skHost)

    const username = localStorage.getItem('username');
    const password = localStorage.getItem('password');

    if (username && password) {
      console.log('Authenticate using cached credentials')
      client.authenticate(username, password)
    } else {
      console.log('No cached credentials found')
      setConnection({connected: true, authenticated: false})
    }
  }

  function onError(error) {
    console.log(`onError error:${error}`)

    if ( 'message' in error &&  error.message.includes('401') ){
      setConnection({connected: true, authenticated: false})

    }else{
      setConnection({connected: false, authenticated: false})
    }
  }

  function onLoginSubmit(username, password) {
    console.log('onLoginSubmit', username, password)
    client.authenticate(username, password)
    localStorage.setItem('username', username);
    localStorage.setItem('password', password);
  }

  function onLogout() {
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    setConnection({connected: true, authenticated: false})
  }

  function logoutButton(){
    return(
        <IconButton aria-label="delete" onClick={() => { onLogout() }}>
          <ExitToAppOutlinedIcon />
        </IconButton>
    );
  }

  let display = ''
  if ( !connection.connected ){
    display =  <span><CircularProgress /> Connecting to SignalK server ...</span>
  }else if( !connection.authenticated ){
    display = <span>
                <LoginDialog onLoginSubmit={onLoginSubmit} open={true} handleClose={()=>{}}/>
                <CameraViews client={client} skHost={skHost}/>
              </span>
  }else{
    display = <span>
                {logoutButton()}
                <CameraControls client={client} />
                <CameraViews client={client} skHost={skHost}/>
              </span>
  }

  return (
    <div className="App">
      {display}
    </div>
  )
}

export default App;
