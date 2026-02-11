#!/bin/bash

# Cleanup previous socket if exists
rm -rf /tmp/pulseaudio.socket

# Start PulseAudio
# We run it as daemon.
pulseaudio -D --exit-idle-time=-1 --verbose --load="module-native-protocol-unix socket=/tmp/pulseaudio.socket auth-anonymous=1"

# Wait for PA to start
sleep 2

# Create a null sink (virtual output device)
# The browser will output audio to this sink.
pactl load-module module-null-sink sink_name=ZoomAudio sink_properties=device.description=ZoomAudio

# Set it as the default sink for all apps (like Chrome)
pactl set-default-sink ZoomAudio

# Set the default source to the monitor of that sink
# This allows 'soundcard' or 'pyaudio' to record what is being played to the sink.
pactl set-default-source ZoomAudio.monitor

echo "PulseAudio initialized. Default Sink: ZoomAudio"

# Execute the bot command passed as arguments
exec python bot.py "$@"
