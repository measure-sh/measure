export default function GoogleSignIn() {
  return (
    <>
      <script src="https://accounts.google.com/gsi/client" async></script>
      <div id="g_id_onload"
        data-client_id="873640940318-hm5iu5okbj0eecrha1a3blmk0ekfr4ii.apps.googleusercontent.com"
        data-context="signin"
        data-ux_mode="popup"
        data-login_uri="http://localhost:3000/auth/callback"
        data-auto_select="true"
        data-itp_support="true">
      </div>

      <div className="g_id_signin"
        data-type="standard"
        data-shape="rectangular"
        data-theme="outline"
        data-text="signin_with"
        data-size="large"
        data-logo_alignment="center"
        data-width="400">
      </div>
    </>
  )
}