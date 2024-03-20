RSStream is a [Node.js](https://nodejs.org) app that listens for feed updates from [Dobrado](https://dobrado.net) and pushes them to the browser using [Gun](https://gun.eco).

### Server

Copy this repo to a new directory and run:

 - `cd server`
 - `npm install`
 - `node app.js`

For production you can start with pm2:

 - `npm install pm2 -g`
 - `export NODE_ENV=production`
 - `pm2 startup`
 - `pm2 start app.js`
 - `pm2 save`

This will save your evironment in `~/.pm2/dump.pm2` so that it can be used on
restarts, note that you need to run `pm2 unstartup` followed by the `pm2`
commands listed above if you change any environment variables.

You can also export `GUN_USER_ALIAS` and `GUN_USER_PASS` to change the
default log in credentials for the server.

### Browser

The front end is served from the `browser/build` directory, which was created
with `npx create-react-app browser --template cra-template-pwa`.

To run on a server other than localhost, update `REACT_APP_HOST` in browser/.env
then run:

 - `cd browser`
 - `npm install`
 - `npm run build`
