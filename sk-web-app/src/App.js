import './App.css';
import Client from "@signalk/client";
import React from "react";
import LoginDialog from "./LoginDialog";
import ExitToAppOutlinedIcon from '@material-ui/icons/ExitToAppOutlined';
import {IconButton} from "@material-ui/core";
import CameraViews from "./CameraViews";
import CameraControls from "./CameraControls";

function App() {

  // Listen to the "delta" event to get the stream data
  let params = {
    hostname: 'localhost',
    port: 3000,
    useTLS: false,
    reconnect: true,
    autoConnect: true,
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
          {
            path: 'cameras.schedule',
            policy: 'instant',
          },
        ],
      },
    ],
  }

  const username = localStorage.getItem('username');
  const password = localStorage.getItem('password');

  if( username &&  password) {
    params.username = username
    params.password = password
    params.useAuthentication = true
    console.log('use cached credentials')
  }else{
    console.log('No cached credentials found')
  }

  const [authenticated, setAuthenticated] = React.useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = React.useState(false);
  const [skHost, setSkHost] = React.useState(null)

  const client = new Client(params)

  function onLoginSubmit(username, password) {
    client.authenticate(username, password)
    localStorage.setItem('username', username);
    localStorage.setItem('password', password);
  }
  function onLogout() {
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    setAuthenticated(false)
    setLoginDialogOpen( true)
  }

  const handleLoginClose = () => {
    setLoginDialogOpen( false)
  }

  client.on('authenticated', (authData) => {
    console.log('authenticated')
    setAuthenticated(true)
    setLoginDialogOpen( false)
  })

  // The 'authenticated' is not emitted if we specify credentials when creating the client,
  // so listen for this event and check if we requested the authenticated connection
  client.on('connect', (authData) => {
    console.log('connect', client)
    const skHost = new URL(client.connection.httpURI).origin
    console.log('httpUri', client.connection.httpURI)
    console.log('skPath', skHost)
    setSkHost(skHost)


    if( params.useAuthentication ) {
      setAuthenticated(true)
      setLoginDialogOpen(false)
    }else{
      setAuthenticated(false)
      setLoginDialogOpen(true)
    }
  })

  client.on('error', (error) => {
    console.log(`error ${error}`)
    setAuthenticated(false)
    setLoginDialogOpen( true)
  })

  function logoutButton(){
    return(
        <IconButton aria-label="delete" onClick={() => { onLogout() }}>
          <ExitToAppOutlinedIcon />
        </IconButton>
    );
  }

  return (
    <div className="App">
       {authenticated ? logoutButton() : 'Not logged in'}
        <LoginDialog onLoginSubmit={onLoginSubmit} open={loginDialogOpen} handleClose={handleLoginClose}/>
        <CameraControls client={client} />
        <CameraViews client={client} skHost={skHost}/>
    </div>
  )
}

export default App;
