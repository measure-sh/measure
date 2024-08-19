# Setup a Google OAuth Application

In this guide, we'll help you setup a Google OAuth app so that your users can login using their Google accounts on your Measure Web dashboard.

1. Visit [console.cloud.google.com](https://console.cloud.google.com)
2. Open the hamburger menu on top left and hover above **APIs & Services** and click on **OAuth consent screen** from the fly-out menu
3. On the next screen, choose User Type as **Internal**
4. Enter an appropriate app name and user support email
5. Add a logo of your company or team
6. Add the top-level domain of your company
7. Add a developer contact email
8. In the scopes screen, choose the following scopes and click **UPDATE**
	1. `../auth/userinfo.email`
	2. `../auth/userinfo.profile`
9. Click on **SAVE AND CONTINUE**
10. On the next screen, review all info and click on **BACK TO DASHBOARD** when done
11. On the left sidebar, click on **Credentials**
12. Select **Web application**
13. Enter a name for the application
14. Under **Authorized JavaScript origins**, enter your Measure dashboard URL (Example: https://measure.yourcompany.com). Replace `yourcompany.com` with your domain.
15. Under **Authorized redirect URIs**, enter the redirect URI in the following way: https://measure.yourcompany.com/auth/callback/google. Replace `yourcompany.com` with your domain.
16. Click **CREATE**
17. Copy the **Client ID**

[Go back to self host guide](./README.md)