const NodeHelper = require('node_helper');
const { AsyncDeviceDiscovery, Listener: listener } = require('sonos');

module.exports = NodeHelper.create({

    discovery: null,
    asyncDevice: null,
    config: null,

    init: function () {
        this.discovery = new AsyncDeviceDiscovery();
    },

    stop: function () {
        if (listener.isListening()) {
            listener.stopListener().then(() => {
                this.debugLog('Stopped all listeners to Sonos devices');
            }).catch(error => {
                console.error(`Failed to stop listeners to Sonos devices, connections might be dangling: ${error.message}`);
            });
        }
    },

    socketNotificationReceived: function (id, payload) {
        switch (id) {
            case 'SONOS_START':
                this.config = payload;
                this.debug = payload.debug === true;
                this.discoverGroups();
                break;
            default:
                this.debugLog(`Notification with ID "${id}" unsupported. Ignoring...`);
                break;
        }
    },

    discoverGroups: function (attempts = 0) {
        if (!this.asyncDevice) {
            this.asyncDevice = this.discovery.discover().then(device => {
                listener.on('ZonesChanged', () => {
                    this.debugLog(`Zones have changed. Rediscovering all groups...`);
                    this.discoverGroups();
                });
                return listener.subscribeTo(device).then(() => device);
            });
        }

        this.asyncDevice.then(device => {
            return device.getAllGroups();
        }).then(groups => {
            this.setGroups(groups);
        }).catch(error => {
            attempts++;
            const timeout = Math.min(Math.pow(attempts, 2), 30);
            console.error(`Failed to get groups: ${error.message}. Retrying in ${timeout} seconds...`);
            if (listener.isListening()) {
                listener.stopListener().then(() => {
                    this.debugLog('Stopped all listeners to Sonos devices');
                }).catch(error => {
                    console.error(`Failed to stop listeners to Sonos devices, connections might be dangling: ${error.message}`);
                });
            }
            this.asyncDevice = null;
            setTimeout(() => {
                this.discoverGroups(attempts);
            }, timeout * 1000);
        });
    },

    setGroups(groups) {
        Promise.all(groups.map(group => {
            const sonos = group.CoordinatorDevice();
            return Promise.all([
                sonos.currentTrack(),
                sonos.getCurrentState(),
                sonos.getVolume(),
                sonos.getMuted()
            ]).then(data => {
                return {
                    group,
                    track: data[0],
                    state: data[1],
                    volume: data[2],
                    isMuted: data[3],
                };
            });
        })).then(items => {
            this.sendSocketNotification('SET_SONOS_GROUPS', items.reduce((map, item) => {
                map[item.group.ID] = item;
                return map;
            }, {}));
            return items;
        }).then(groups => {
            if (this.config && this.config.listenWithPolling) {
                this.debugLog("Listening with polling");
                this.setListenersPolling(groups.map(item => item.group), this.config.pollingTime);
            } else {
                this.debugLog("Listening with events");
                this.setListeners(groups.map(item => item.group));
            }
        });
    },

    setListenersPolling: function (groups, pollingTimeout) {
        groups.forEach(group => {
            this.debugLog(`Registering listeners for group "${group.Name}" (host "${group.host}")`);

            const sonos = group.CoordinatorDevice();
            let lastTrack = null;
            let lastVolume = null;
            let lastMute = null;
            let lastState = null;

            setInterval(() => {
                sonos.currentTrack().then(track => {
                    if (lastTrack && lastTrack.title === track.title && lastTrack.artist === track.artist)
                        return;
                    this.debugLog(`[Group ${group.Name} - ${group.host}] Track changed to "${track.title}" by "${track.artist}"`);
                    lastTrack = track;
                    this.sendSocketNotification('SET_SONOS_CURRENT_TRACK', {
                        group,
                        track
                    });
                }).catch(() => { });

                sonos.getVolume().then(volume => {
                    if (lastVolume && lastVolume === volume)
                        return;
                    this.debugLog(`[Group ${group.Name} - ${group.host}] Volume changed to "${volume}"`);
                    lastVolume = volume;
                    this.sendSocketNotification('SET_SONOS_VOLUME', {
                        group,
                        volume
                    });
                }).catch(() => { });

                sonos.getMuted().then(isMuted => {
                    const currentIsMuted = isMuted ? 'muted' : 'unmuted';
                    if (lastMute && lastMute === currentIsMuted)
                        return;
                    this.debugLog(`[Group ${group.Name} - ${group.host}] Group is ${currentIsMuted}`);
                    lastMute = currentIsMuted;
                    this.sendSocketNotification('SET_SONOS_MUTE', {
                        group,
                        isMuted
                    });
                }).catch(() => { });

                sonos.getCurrentState().then(state => {
                    if (lastState && lastState === state)
                        return;
                    this.debugLog(`[Group ${group.Name} - ${group.host}] Play state change to "${state}"`);
                    lastState = state;
                    this.sendSocketNotification('SET_SONOS_PLAY_STATE', {
                        group,
                        state
                    });
                }).catch(() => { });

            }, pollingTimeout);
        });
    },

    setListeners: function (groups) {
        groups.forEach(group => {
            this.debugLog(`Registering listeners for group "${group.Name}" (host "${group.host}")`);

            const sonos = group.CoordinatorDevice();

            sonos.on('Mute', isMuted => {
                this.debugLog(`[Group ${group.Name} - ${group.host}] Group is ${isMuted ? 'muted' : 'unmuted'}`);
                this.sendSocketNotification('SET_SONOS_MUTE', {
                    group,
                    isMuted
                });
            });

            sonos.on('CurrentTrack', track => {
                this.debugLog(`[Group ${group.Name} - ${group.host}] Track changed to "${track.title}" by "${track.artist}"`);
                this.sendSocketNotification('SET_SONOS_CURRENT_TRACK', {
                    group,
                    track
                });
            });

            sonos.on('Volume', volume => {
                this.debugLog(`[Group ${group.Name} - ${group.host}] Volume changed to "${volume}"`);
                this.sendSocketNotification('SET_SONOS_VOLUME', {
                    group,
                    volume
                });
            });

            sonos.on('PlayState', state => {
                this.debugLog(`[Group ${group.Name} - ${group.host}] Play state change to "${state}"`);
                this.sendSocketNotification('SET_SONOS_PLAY_STATE', {
                    group,
                    state
                });
            });
        });
    },

    debugLog(message) {
        if (this.config?.debug) {
            console.log(`[MMM-Sonos] ${message}`);
        }
    }
});