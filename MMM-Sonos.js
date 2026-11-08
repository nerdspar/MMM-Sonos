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
        return [
            this.file('node_modules/feather-icons/dist/feather.min.js'),
            this.file('sonos-display.js')
        ];
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
            .map(item => this.renderRow(item)));

        return container;
    },

    renderRow: function (item) {
        const row = SonosDisplay.describe(item.track);

        const wrapper = document.createElement('div');
        wrapper.className = `sonos-row source-${row.source}`;

        // Artwork, or an icon tile the same size so every row lines up
        if (row.art) {
            const art = document.createElement('img');
            art.src = row.art;
            art.className = 'album-art';
            wrapper.appendChild(art);
        } else {
            const tile = document.createElement('div');
            tile.className = 'album-art icon-tile';
            tile.innerHTML = this.getIcon(row.icon, 'dimmed');
            wrapper.appendChild(tile);
        }

        const textWrapper = document.createElement('div');
        textWrapper.className = 'sonos-text';

        const track = document.createElement('div');
        track.className = 'track';
        track.innerHTML = `<strong class="bright ticker">${row.title}</strong>`;
        textWrapper.appendChild(track);

        const artist = [];
        if (this.config.showArtist && row.artist) {
            artist.push(`<span class="bright">${row.artist}</span>`);
        }
        if (this.config.showAlbum && row.album) {
            artist.push(row.album);
        }
        if (artist.length > 0) {
            const artistElement = document.createElement('div');
            artistElement.className = 'artist small ticker';
            artistElement.innerHTML = artist.join('&nbsp;\u25CB&nbsp;');
            textWrapper.appendChild(artistElement);
        }

        if (this.config.showMetadata) {
            const volume = item.isMuted === true
                ? this.getIcon('volume-x', 'dimmed')
                : `${this.getIcon(item.volume < 50 ? 'volume-1' : 'volume-2', 'dimmed')}&nbsp;<span>${item.volume}</span>`;

            const groupName = this.config.showFullGroupName
                ? item.group.ZoneGroupMember.map(member => member.ZoneName).join(' + ')
                : item.group.Name;

            const parts = [
                `<span>${this.getIcon('speaker', 'dimmed')}&nbsp;<span class="group-name ticker">${groupName}</span></span>`,
                `<span>${volume}</span>`
            ];
            if (row.duration) {
                parts.push(`<span>${this.getIcon('activity', 'dimmed')}&nbsp;<span>${row.duration}</span></span>`);
            }

            const metadata = document.createElement('div');
            metadata.className = 'metadata small normal';
            metadata.innerHTML = parts.join('&nbsp;');
            textWrapper.appendChild(metadata);
        }

        wrapper.appendChild(textWrapper);
        return wrapper;
    },

    getIcon: function (iconId, classes) {
        return `<svg class="feather ${classes}"><use xlink:href="${this.file('node_modules/feather-icons/dist/feather-sprite.svg')}#${iconId}"/></svg>`;
    }
});