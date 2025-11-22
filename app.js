import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import Replicate from 'replicate';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    // "challenge" command
    if (name === 'challenge' && id) {
      // Interaction context
      const context = req.body.context;
      // User ID is in user field for (G)DMs, and member for servers
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
      // User's object choice
      const objectName = req.body.data.options[0].value;

      // Create active game using message ID as the game ID
      activeGames[id] = {
        id: userId,
        objectName,
      };

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `Rock papers scissors challenge from <@${userId}>`,
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  // Append the game ID to use later on
                  custom_id: `accept_button_${req.body.id}`,
                  label: 'Accept',
                  style: ButtonStyleTypes.PRIMARY,
                },
              ],
            },
          ],
        },
      });
    }

    // "imagine" command
    if (name === 'imagine') {
      // Defer reply
      await res.send({
        type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      });

      const prompt = req.body.data.options[0].value;
      console.log(`[${new Date().toISOString()}] User ${req.body.user.username} requested imagine: ${prompt}`);

      if (prompt.length > 1000) {
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Prompt is too long. Please keep it under 1000 characters.",
              color: 0xff0000
            }]
          }
        });
        return;
      }

      const replicate = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });

      let output;
      try {
        output = await replicate.run("stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf", {
          input: {
            prompt: prompt
          }
        });
      } catch (error) {
        console.error('Image generation error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to generate image. Please try again.",
              color: 0xff0000
            }]
          }
        });
        return;
      }

      // Edit the deferred message
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;

      await DiscordRequest(endpoint, {
        method: 'PATCH',
        body: {
          embeds: [
            {
              title: "Your Prompt:",
              description: `**${prompt}**`,
              image: { url: output },
              color: 0x2c3b54,
              footer: {
                text: `Requested by: ${req.body.user.username}`,
                icon_url: req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null
              }
            }
          ],
           components: [
             {
               type: 1, // ACTION_ROW
               components: [
                 {
                   type: 2, // BUTTON
                   style: 5, // LINK
                   label: 'Download',
                   url: output
                 },
                 {
                   type: 2, // BUTTON
                   style: 1, // PRIMARY
                   label: 'Regenerate',
                   custom_id: `regenerate_imagine_${encodeURIComponent(prompt)}`
                 }
               ]
             }
           ]
      }
    }

    if (name === 'write') {
      await res.send({ type: 5 });
      const prompt = req.body.data.options[0].value;
      console.log(`[${new Date().toISOString()}] User ${req.body.user.username} requested write: ${prompt}`);

      if (prompt.length > 1000) {
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Prompt is too long. Please keep it under 1000 characters.",
              color: 0xff0000
            }]
          }
        });
        return;
      }

      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      let output;
      try {
        output = await replicate.run("meta/meta-llama-3-8b-instruct", { input: { prompt, max_tokens: 500 } });
      } catch (error) {
        console.error('Text generation error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to generate text. Please try again.",
              color: 0xff0000
            }]
          }
        });
        return;
      }
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
      await DiscordRequest(endpoint, {
        method: 'PATCH',
        body: {
          embeds: [{
            title: "Your Prompt:",
            description: `**${prompt}**`,
            fields: [{ name: "Generated Text:", value: output.join('') }],
            color: 0x1dbac8,
            footer: { text: `Requested by: ${req.body.user.username}`, icon_url: req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null }
          }],
          components: [{
            type: 1,
            components: [{ type: 2, style: 1, label: 'Regenerate', custom_id: `regenerate_write_${encodeURIComponent(prompt)}` }]
          }]
        }
      });
    }

    if (name === 'code') {
      await res.send({ type: 5 });
      const prompt = req.body.data.options[0].value;
      console.log(`[${new Date().toISOString()}] User ${req.body.user.username} requested code: ${prompt}`);

      if (prompt.length > 1000) {
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Prompt is too long. Please keep it under 1000 characters.",
              color: 0xff0000
            }]
          }
        });
        return;
      }

      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      let output;
      try {
        output = await replicate.run("codellama/codellama-34b-instruct", { input: { prompt, max_tokens: 500 } });
      } catch (error) {
        console.error('Code generation error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to generate code. Please try again.",
              color: 0xff0000
            }]
          }
        });
        return;
      }
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
      await DiscordRequest(endpoint, {
        method: 'PATCH',
        body: {
          embeds: [{
            title: "Your Prompt:",
            description: `**${prompt}**`,
            fields: [{ name: "Generated Code:", value: `\`\`\`\n${output.join('')}\n\`\`\`` }],
            color: 0x757d8c,
            footer: { text: `Requested by: ${req.body.user.username}`, icon_url: req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null }
          }],
          components: [{
            type: 1,
            components: [{ type: 2, style: 1, label: 'Regenerate', custom_id: `regenerate_code_${encodeURIComponent(prompt)}` }]
          }]
        }
      });
    }

    if (name === 'music') {
      await res.send({ type: 5 });
      const prompt = req.body.data.options[0].value;
      console.log(`[${new Date().toISOString()}] User ${req.body.user.username} requested music: ${prompt}`);

      if (prompt.length > 500) {
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Prompt is too long. Please keep it under 500 characters.",
              color: 0xff0000
            }]
          }
        });
        return;
      }

      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      try {
        const output = await replicate.run("meta/musicgen", { input: { prompt_a: prompt, duration: 10 } });
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "🎵 Your Music Prompt:",
              description: `**${prompt}**`,
              color: 0xff6b6b,
              footer: { text: `Requested by: ${req.body.user.username}`, icon_url: req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null }
            }],
            components: [{
              type: 1,
              components: [
                { type: 2, style: 5, label: '🎧 Play/Download', url: output },
                { type: 2, style: 1, label: '🔄 Regenerate', custom_id: `regenerate_music_${encodeURIComponent(prompt)}` }
              ]
            }]
          }
        });
      } catch (error) {
        console.error('Music generation error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to generate music. Please try again later.",
              color: 0xff0000
            }]
          }
        });
      }
    }

    if (name === 'help') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: "🤖 AI Content Generator Bot",
            description: "Generate images, text, code, and music with AI!",
            fields: [
              { name: "/imagine <prompt>", value: "Generate an image from your prompt" },
              { name: "/write <prompt>", value: "Generate text content from your prompt" },
              { name: "/code <prompt>", value: "Generate code from your prompt" },
              { name: "/music <prompt>", value: "Generate music from your prompt" },
              { name: "/help", value: "Show this help message" }
            ],
            color: 0x0099ff,
            footer: { text: "Powered by Replicate AI | Use / to trigger commands" }
          }]
        }
      });
    }

  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = data.custom_id;
    if (componentId.startsWith('regenerate_imagine_')) {
      const encodedPrompt = componentId.replace('regenerate_imagine_', '');
      const prompt = decodeURIComponent(encodedPrompt);
      await res.send({ type: 6 });
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      let output;
      try {
        output = await replicate.run("stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf", { input: { prompt } });
      } catch (error) {
        console.error('Image regenerate error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to regenerate image. Please try again.",
              color: 0xff0000
            }]
          }
        });
        return;
      }
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      await DiscordRequest(endpoint, {
        method: 'PATCH',
        body: {
          embeds: [{
            title: "Your Prompt:",
            description: `**${prompt}**`,
            image: { url: output },
            color: 0x2c3b54,
            footer: { text: `Requested by: ${req.body.member ? req.body.member.user.username : req.body.user.username}`, icon_url: req.body.member ? (req.body.member.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.member.user.id}/${req.body.member.user.avatar}.png` : null) : (req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null) }
          }],
          components: [{
            type: 1,
            components: [
              { type: 2, style: 5, label: 'Download', url: output },
              { type: 2, style: 1, label: 'Regenerate', custom_id: `regenerate_imagine_${encodeURIComponent(prompt)}` }
            ]
          }]
        }
      });
    } else if (componentId.startsWith('regenerate_write_')) {
      const encodedPrompt = componentId.replace('regenerate_write_', '');
      const prompt = decodeURIComponent(encodedPrompt);
      await res.send({ type: 6 });
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      let output;
      try {
        output = await replicate.run("meta/meta-llama-3-8b-instruct", { input: { prompt, max_tokens: 500 } });
      } catch (error) {
        console.error('Text regenerate error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to regenerate text. Please try again.",
              color: 0xff0000
            }]
          }
        });
        return;
      }
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      await DiscordRequest(endpoint, {
        method: 'PATCH',
        body: {
          embeds: [{
            title: "Your Prompt:",
            description: `**${prompt}**`,
            fields: [{ name: "Generated Text:", value: output.join('') }],
            color: 0x1dbac8,
            footer: { text: `Requested by: ${req.body.member ? req.body.member.user.username : req.body.user.username}`, icon_url: req.body.member ? (req.body.member.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.member.user.id}/${req.body.member.user.avatar}.png` : null) : (req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null) }
          }],
          components: [{
            type: 1,
            components: [{ type: 2, style: 1, label: 'Regenerate', custom_id: `regenerate_write_${encodeURIComponent(prompt)}` }]
          }]
        }
      });
    } else if (componentId.startsWith('regenerate_code_')) {
      const encodedPrompt = componentId.replace('regenerate_code_', '');
      const prompt = decodeURIComponent(encodedPrompt);
      await res.send({ type: 6 });
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      try {
        const output = await replicate.run("codellama/codellama-34b-instruct", { input: { prompt, max_tokens: 500 } });
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "Your Prompt:",
              description: `**${prompt}**`,
              fields: [{ name: "Generated Code:", value: `\`\`\`\n${output.join('')}\n\`\`\`` }],
              color: 0x757d8c,
              footer: { text: `Requested by: ${req.body.member ? req.body.member.user.username : req.body.user.username}`, icon_url: req.body.member ? (req.body.member.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.member.user.id}/${req.body.member.user.avatar}.png` : null) : (req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null) }
            }],
            components: [{
              type: 1,
              components: [{ type: 2, style: 1, label: 'Regenerate', custom_id: `regenerate_code_${encodeURIComponent(prompt)}` }]
            }]
          }
        });
      } catch (error) {
        console.error('Code regenerate error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to regenerate code. Please try again.",
              color: 0xff0000
            }]
          }
        });
      }
    } else if (componentId.startsWith('regenerate_music_')) {
      const encodedPrompt = componentId.replace('regenerate_music_', '');
      const prompt = decodeURIComponent(encodedPrompt);
      await res.send({ type: 6 });
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
      try {
        const output = await replicate.run("meta/musicgen", { input: { prompt_a: prompt, duration: 10 } });
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "🎵 Your Music Prompt:",
              description: `**${prompt}**`,
              color: 0xff6b6b,
              footer: { text: `Requested by: ${req.body.member ? req.body.member.user.username : req.body.user.username}`, icon_url: req.body.member ? (req.body.member.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.member.user.id}/${req.body.member.user.avatar}.png` : null) : (req.body.user.avatar ? `https://cdn.discordapp.com/avatars/${req.body.user.id}/${req.body.user.avatar}.png` : null) }
            }],
            components: [{
              type: 1,
              components: [
                { type: 2, style: 5, label: '🎧 Play/Download', url: output },
                { type: 2, style: 1, label: '🔄 Regenerate', custom_id: `regenerate_music_${encodeURIComponent(prompt)}` }
              ]
            }]
          }
        });
      } catch (error) {
        console.error('Music regenerate error:', error);
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: {
            embeds: [{
              title: "❌ Error",
              description: "Failed to regenerate music. Please try again.",
              color: 0xff0000
            }]
          }
        });
      }
    }
  }

console.error('unknown interaction type', type);
return res.status(400).json({ error: 'unknown interaction type' });

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

module.exports = app;
