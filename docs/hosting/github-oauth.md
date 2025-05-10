# Setup a GitHub OAuth Application

1. Visit your GitHub organization's settings page, located at https://github.com/organizations/YOUR-ORGANIZATION/settings/profile. Replace `YOUR-ORGANIZATION` with the name of your organization.
2. Locate **Developer Settings** at the bottom of the left sidebar and click on **OAuth Apps**
3. Click the **New Org OAuth App** button
4. Enter a name for your GitHub OAuth app
5. Enter the homepage URL, like: https://measure.yourcompany.com. Replace `yourcompany.com` with your domain.
6. Enter a suitable description of your app
7. Enter the following as the **Authorization callback URL** - https://measure.yourcompany.com/auth/callback/github. Replace `yourcompany.com` with your domain.
8. Click on **Register application** button to create the GitHub OAuth app
9. Click on **Generate a new client secret**
10. Copy the **Client ID** and paste when asked in prompt for `Enter GitHub OAuth app key`
11. Copy the **Client Secret** and paste when asked in prompt for `Enter GitHub OAuth app secret`

[Go back to self host guide](./README.md)
