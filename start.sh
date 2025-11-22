#!/bin/bash

# Start the Discord app on port 8080 in the background
PORT=8080 npm start &

# Wait a bit for the app to start
sleep 5

# Start ngrok on port 8080
../ngrok http 8080