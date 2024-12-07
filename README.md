RSStream is a local first web application that use a distributed database in
the browser called [GunDB](https://gun.eco). The server runs a
[Node.js](https://nodejs.org) app that listens for feed updates from
[Dobrado](https://dobrado.net) and pushes updates to the browser.

### Server

Copy this repo to a new directory and run:

 - `cd server`
 - `npm install`
 - `node app.js`

For production you can start with pm2:

 - `npm install pm2 -g`
 - `export NODE_ENV=production`
 - `pm2 startup` (And follow startup instructions.)
 - `pm2 start app.js`
 - `pm2 save`

This will save your environment in `~/.pm2/dump.pm2` so that it can be used on
restarts, note that you need to run `pm2 unstartup` followed by the `pm2`
commands listed above if you modify any required environment variables.

You can export `GUN_USER_ALIAS` and `GUN_USER_PASS` to change the default
log in credentials for the GunDB host account on the server. All private data
created in GunDB on the server relies on these credentials, so keep them safe.

The credentials are also used to access private endpoints, for example to
allocate invite codes to an account you can run:

`curl -i -H 'Content-Type: application/json' -u <GUN_USER_ALIAS>:<GUN_USER_PASS> -d '{"code": "<code>"}' localhost:3000/private/create-invite-codes`

The value `<code>` is the account code that you want to allocate the new invite
codes to. You can set the number of invite codes to create for an account by
adding `"count": <number>` to the request, otherwise one code will be created.

If you have sendmail available on your server you can export `MAIL_FROM` and
`MAIL_BCC` to send email to your users. If `MAIL_FROM` is not set then the
same information will be logged so that you have access to it.
(See `~/.pm2/logs/app-out.log` if you're using pm2.) Export `APP_HOST` to
create links that point to a server other than localhost.

RSStream relies on Dobrado for its feed processing, which is accessed via it's
API. You can set it up on a subdomain and then access it via the `ADD_FEED_URL`,
`ADD_FEED_ID` and `ADD_FEED_API_KEY` environment variables. Dobrado then pushes
updates back to RSStream via the `/private/add-item` and `/private/removed-feed`
endpoints, so it will also need to be configured with the RSStream url, username
and password.

### Browser

The front end is served from the `browser/build` directory, which was created
with `npx create-react-app browser --template cra-template-pwa`.

If you modify the front end you can rebuild it by running:

 - `cd browser`
 - `npm install`
 - `npm run build`
