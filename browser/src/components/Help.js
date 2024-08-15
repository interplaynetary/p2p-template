import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Container from "@mui/material/Container"
import Grid from "@mui/material/Grid"
import Link from "@mui/material/Link"
import Typography from "@mui/material/Typography"
import SearchAppBar from "./SearchAppBar"

const Help = ({loggedIn, mode, setMode}) => {
  return (
    <>
    {loggedIn && <SearchAppBar mode={mode} setMode={setMode}/>}
    <Container maxWidth="md">
      <Grid container>
        <Grid item xs={12}>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography variant="h4">Welcome</Typography>
              <Typography paragraph={true}>
                Thanks for checking out <b>rsstream</b>!
              </Typography>
              <Typography paragraph={true}>
                This web app aims to provide a great reading experience for
                content from all over the web. It's designed around grouping
                related feeds together so they can be read in a Really Simple
                Stream.
              </Typography>
              <Typography paragraph={true}>
                You can <Link href="/login">login here</Link> if you have an
                account, otherwise you will need an invite code
                to <Link href="/register">register</Link>.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography variant="h6">Why invite codes?</Typography>
              <Typography paragraph={true}>
                Accounts are created in rsstream using a distributed database
                called <Link href="https://gun.eco">GunDB</Link>. Invite codes
                provide a way to control the sign up process, by letting
                existing users decide who can create accounts.
              </Typography>
              <Typography paragraph={true}>
                Sharing invite codes also allows a social graph of connected
                accounts to be created. Available invite codes will appear on
                your settings page and will be removed automatically as they're
                claimed by new users.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography variant="h6">Confirming your account</Typography>
              <Typography paragraph={true}>
                New accounts need to be confirmed before they can be allocated
                invite codes. Confirming your account is done via email, which
                is provided during registration. Personal details such as your
                email address and confirmation codes are encrypted when stored
                in GunDB.
              </Typography>
              <Typography paragraph={true}>
                Having an email address associated with your account means you
                can <Link href="/reset-password">reset your password</Link> if
                required. This is only necessary if you're logged out and can't
                remember your password. It would otherwise not be possible to
                recover your account when using a distributed database.
              </Typography>
              <Typography paragraph={true}>
                Note that if you're logged in, you can change your password via
                the <Link href="/settings">settings page</Link>.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12}>
          <Card sx={{mt:2}}>
            <CardContent>
              <Typography variant="h6">Get involved</Typography>
              <Typography paragraph={true}>
                rsstream is an open source project written in JavaScript
                using <Link href="https://expressjs.com">Express
                </Link> and <Link href="https://react.dev">React</Link>. It
                uses IndexedDB via GunDB, to create an offline first web
                application that syncs between browsers. You can contribute and
                find out more
                at <Link href="https://github.com/mblaney/rsstream">
                github.com/mblaney/rsstream</Link>.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
    </>  
  )
}

export default Help
