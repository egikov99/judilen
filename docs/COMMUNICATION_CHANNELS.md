# CRM Communication Channels

## Deployment

1. Apply migration `0007_communication_inbox`.
2. Set `APP_URL` to the public HTTPS origin.
3. Set `COMMUNICATION_ENCRYPTION_KEY` to a stable secret of at least 32 characters.
4. Keep the encryption key unchanged between deploys. Changing it makes saved channel credentials unreadable.

## Channel setup

### Telegram

- Create a bot with BotFather and save its token.
- Save and test the connection in CRM. CRM registers the webhook automatically.
- Personal messages and a Telegram group may share one bot token.

For a group, also provide its numeric ID, add the bot to the group and disable Privacy Mode if all group messages must be received.

### VK

- Provide the community ID, community access token, Callback API secret and confirmation string.
- Save the connection and copy the generated callback URL to the community Callback API settings.
- Enable the `message_new` event.

### Instagram

- A professional Instagram account and Meta application with messaging permissions are required.
- Provide the Instagram account ID, access token and optional App Secret.
- Copy the generated callback URL and Verify Token to the Meta webhook settings.

### WhatsApp

- Configure WhatsApp Cloud API and provide Phone Number ID and access token.
- Copy the generated callback URL and Verify Token to the Meta webhook settings.
- Subscribe the application to message events.

### Viber

- An active commercial Viber bot and authentication token are required.
- Saving and testing the connection registers the webhook automatically.

## Security

- Tokens and API keys are encrypted with AES-256-GCM.
- Public webhook requests are checked using a secret URL and provider signature where available.
- Chat reads and replies require separate `chats.read` and `chats.write` permissions.
- Push notifications contain only a generic event title. Message text remains inside the authenticated CRM.
