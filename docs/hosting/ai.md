# Set up AI Gateway API key

Measure uses Vercel's AI Gateway to implement LLM based features.

You can sign up for an account and get your API key [here](https://vercel.com/ai-gateway).


## Configure SMTP email settings for existing users

If you are upgrading from v0.8.x, you would need to manually configure the API key.

1. Edit the `self-host/.env` file.

2. Add the following environment variables as obtained from Vercel.

    ```sh
    AI_GATEWAY_API_KEY=your-key   # change this
    ```

3. Run the following command to shutdown all services.

    ```sh
    sudo docker compose \
      -f compose.yml \
      -f compose.prod.yml \
      --profile migrate \
      down
    ```

4. Finally, run the `install.sh` script for the configuration to take effect.

    ```sh
    sudo ./install.sh
    ```

[Go back to self host guide](./README.md)
