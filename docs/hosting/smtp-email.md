# Set up an SMTP email provider

Set up an email provider to get SMTP credentials. We recommend [Ethereal Mail](https://ethereal.email) for local development/testing and [Resend](https://resend.com), [SendGrid](https://sendgrid.com) or [AWS SES](https://aws.amazon.com/ses) for production.

## Configure SMTP email settings for existing users

If you are upgrading from v0.7.x, you would need to manually configure the SMTP settings.

1. Edit the `self-host/.env` file.

2. Add the following environment variables as obtained from your email provider.

    ```sh
    SMTP_HOST=smtp.yourprovider.email   # change this
    SMTP_PORT=587                       # change this
    SMTP_USER=user@yourprovider.email   # change this
    SMTP_PASSWORD=some_secret_password  # change this
    ```

3. Run the following command to shutdown all services.

    ```sh
    sudo docker compose \
      -f compose.yml \
      -f compose.prod.yml \
      --profile init \
      --profile migrate \
      down
    ```

4. Finally, run the `install.sh` script for the configuration to take effect.

    ```sh
    sudo ./install.sh
    ```

[Go back to self host guide](./README.md)