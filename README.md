## Server

Copy this repo to a new directory and run:

 - `cd server`
 - `npm update`
 - `node app.js`

For production you can start with pm2:

 - `export NODE_ENV=production`
 - `npm install pm2 -g`
 - `pm2 startup`
 - `pm2 start app.js`
 - `pm2 save`

## Browser

The front end is served from the `browser/build` directory, which was created
with the following commands. Note this information is only required for
development:

 - `npx create-react-app browser --template cra-template-pwa`
 - `cd browser`
 - `npm install gun`
 - `npm install @mui/material @emotion/react @emotion/styled`
 - `npm install @babel/plugin-proposal-private-property-in-object`
 - `npm run build`
 
To run on a host other than localhost, need to update `REACT_APP_HOST` in
browser/.env and re-build.
