Module.register('MMM-Sonos', {
    defaults: {
        animationSpeed: 1000,
        showFullGroupName: false,
        showArtist: true,
        showAlbum: true,
        showMetadata: true,
        listenWithPolling: false,
        pollingTimeout: 5000,
        debug: false
    },

    items: {},

    start: function () {
        this.debug = this.config.debug === true;
        if (this.debug) Log.log('Sonos frontend started');

        this.sendSocketNotification('SONOS_START', {
            listenWithPolling: this.config.listenWithPolling,
            pollingTime: this.config.pollingTimeout ?? 5000,
            debug: this.debug
        });
    },

    getStyles: function () {
        return ['MMM-Sonos.css'];
    },

    getScripts: function () {
        return [this.file('node_modules/feather-icons/dist/feather.min.js')];
    },

    socketNotificationReceived: function (id, payload) {
        if (this.debug) Log.log(`Notification received: ${id}`, payload);

        switch (id) {
            case 'SET_SONOS_GROUPS':
                this.items = payload;
                this.updateDom(this.config.animationSpeed);
                break;
            case 'SET_SONOS_CURRENT_TRACK':
                if (this.items.hasOwnProperty(payload.group.ID)) {
                    this.items[payload.group.ID] = {
                        ...this.items[payload.group.ID],
                        group: payload.group,
                        track: payload.track,
                    };
                    if (this.debug) {
                        Log.log('Received Sonos track data:', payload.track);
                    }
                    this.updateDom(this.config.animationSpeed);
                }
                break;
            case 'SET_SONOS_VOLUME':
                if (this.items.hasOwnProperty(payload.group.ID)) {
                    this.items[payload.group.ID] = {
                        ...this.items[payload.group.ID],
                        group: payload.group,
                        volume: payload.volume
                    };
                    this.updateDom();
                }
                break;
            case 'SET_SONOS_MUTE':
                if (this.items.hasOwnProperty(payload.group.ID)) {
                    this.items[payload.group.ID] = {
                        ...this.items[payload.group.ID],
                        group: payload.group,
                        isMuted: payload.isMuted
                    };
                    this.updateDom();
                }
                break;
            case 'SET_SONOS_PLAY_STATE':
                if (this.items.hasOwnProperty(payload.group.ID)) {
                    this.items[payload.group.ID] = {
                        ...this.items[payload.group.ID],
                        group: payload.group,
                        state: payload.state
                    };
                    this.updateDom(this.config.animationSpeed);
                }
                break;
            default:
                if (this.debug) Log.info(`Notification with ID "${id}" unsupported. Ignoring...`);
                break;
        }
    },

    getHeader: function () {
        if (this.data.header && Object.values(this.items).some(item => item.state === 'playing' && item.track)) {
            return this.data.header;
        }
    },

    getDom: function () {
        if (Object.values(this.items).length === 0) {
            return document.createElement('div');
        }

        const container = document.createElement('div');
        container.className = 'sonos light';
        container.append(...Object.values(this.items)
            .filter(item => item.state === 'playing' && item.track)
            .map(item => {
                const wrapper = document.createElement('div');
                const isRecordPlayer = item.track.uri === "x-rincon-mp3radio://http://sonos.local:8000/rapi.mp3";
                if (isRecordPlayer) {
                    item.track.title = "Record Player";
                    item.track.artist = "Vinyl";
                    item.track.album = "Now Spinning";
                    item.track.albumArtURI = "/modules/MMM-Sonos/record.png"; // You will need to place this image here
                }
                wrapper.className = 'sonos-row';

                // Album Art
                if (item.track.albumArtURI) {
                    const art = document.createElement('img');
                    art.src = item.track.albumArtURI;
                    art.className = 'album-art';
                    wrapper.appendChild(art);
                }

                // Text Container
                const textWrapper = document.createElement('div');
                textWrapper.className = 'sonos-text';

                const track = document.createElement('div');
                track.className = 'track';
                track.innerHTML = `<strong class="bright ticker">${item.track.title}</strong>`;
                textWrapper.appendChild(track);

                const artist = [];
                if (this.config.showArtist && item.track.artist) {
                    artist.push(`<span class="bright">${item.track.artist}</span>`);
                }
                if (this.config.showAlbum && item.track.album) {
                    artist.push(`${item.track.album}`);
                }
                if (artist.length > 0) {
                    const artistElement = document.createElement('div');
                    artistElement.className = 'artist small ticker';
                    artistElement.innerHTML = artist.join('&nbsp;â—‹&nbsp;');
                    textWrapper.appendChild(artistElement);
                }

                if (this.config.showMetadata) {
                    let volume;
                    if (item.isMuted === true) {
                        volume = `${this.getIcon('volume-x', 'dimmed')}`;
                    } else {
                        volume = `${this.getIcon(item.volume < 50 ? 'volume-1' : 'volume-2', 'dimmed')}&nbsp;<span>${item.volume}</span>`;
                    }

                    const groupName = this.config.showFullGroupName
                        ? item.group.ZoneGroupMember.map(member => member.ZoneName).join(' + ')
                        : item.group.Name;

                    const metadata = document.createElement('div');
                    metadata.className = 'metadata small normal';
                    metadata.innerHTML =
                        `<span>${this.getIcon('speaker', 'dimmed')}&nbsp;<span class="group-name ticker">${groupName}</span></span>` +
                        '&nbsp;' +
                        `<span>${volume}</span>` +
                        '&nbsp;' +
                        `<span>${this.getIcon('activity', 'dimmed')}&nbsp;<span>${Math.floor(item.track.duration / 60)}:${Math.ceil(item.track.duration % 60).toString().padStart(2, '0')}</span></span>`;
                    textWrapper.appendChild(metadata);
                }

                wrapper.appendChild(textWrapper);
                return wrapper;
            }));

        return container;
    },

    getIcon: function (iconId, classes) {
        return `<svg class="feather ${classes}"><use xlink:href="${this.file('node_modules/feather-icons/dist/feather-sprite.svg')}#${iconId}"/></svg>`;
    }
});