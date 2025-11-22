import 'dotenv/config';
import { getRPSChoices } from './game.js';
import { capitalize, InstallGlobalCommands } from './utils.js';

// Get the game choices from game.js
function createCommandChoices() {
  const choices = getRPSChoices();
  const commandChoices = [];

  for (let choice of choices) {
    commandChoices.push({
      name: capitalize(choice),
      value: choice.toLowerCase(),
    });
  }

  return commandChoices;
}

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
const CHALLENGE_COMMAND = {
  name: 'challenge',
  description: 'Challenge to a match of rock paper scissors',
  options: [
    {
      type: 3,
      name: 'object',
      description: 'Pick your object',
      required: true,
      choices: createCommandChoices(),
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};

// Imagine command
const IMAGINE_COMMAND = {
  name: 'imagine',
  description: 'Generate art from your prompt',
  options: [
    {
      type: 3,
      name: 'prompt',
      description: 'Your prompt to generate the art',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Write command
const WRITE_COMMAND = {
  name: 'write',
  description: 'Generate text content from your prompt',
  options: [
    {
      type: 3,
      name: 'prompt',
      description: 'Your prompt to generate text',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Code command
const CODE_COMMAND = {
  name: 'code',
  description: 'Generate code from your prompt',
  options: [
    {
      type: 3,
      name: 'prompt',
      description: 'Your prompt to generate code',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Music command
const MUSIC_COMMAND = {
  name: 'music',
  description: 'Generate music from your prompt',
  options: [
    {
      type: 3,
      name: 'prompt',
      description: 'Your prompt to generate music',
      required: true,
    },
  ],
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// History command
const HISTORY_COMMAND = {
  name: 'history',
  description: 'View your recent generation history',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Prompts command
const PROMPTS_COMMAND = {
  name: 'prompts',
  description: 'Get helpful prompts to get started',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Help command
const HELP_COMMAND = {
  name: 'help',
  description: 'Get help with available commands',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const ALL_COMMANDS = [TEST_COMMAND, CHALLENGE_COMMAND, IMAGINE_COMMAND, WRITE_COMMAND, CODE_COMMAND, MUSIC_COMMAND, HISTORY_COMMAND, PROMPTS_COMMAND, HELP_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
