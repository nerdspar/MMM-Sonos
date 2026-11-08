/*
 * Pure display logic for MMM-Sonos, shared by the browser module (loaded as a
 * script, exposes `SonosDisplay`) and the tests (required as CommonJS).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SonosDisplay = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    // Home theater (soundbar TV input), e.g. "x-sonos-htastream:RINCON_XXX01400:spdif"
    const TV_URI_PREFIX = 'x-sonos-htastream:';
    const RECORD_PLAYER_URI = 'x-rincon-mp3radio://http://sonos.local:8000/rapi.mp3';
    const RECORD_PLAYER_ART = '/modules/MMM-Sonos/record.png';

    function sourceOf(track) {
        const uri = (track && track.uri) || '';
        if (uri.startsWith(TV_URI_PREFIX)) return 'tv';
        if (uri === RECORD_PLAYER_URI) return 'vinyl';
        return 'music';
    }

    // "3:07" for a positive length in seconds; null when there is no length (TV, streams).
    function formatDuration(seconds) {
        const total = Math.floor(Number(seconds));
        if (!Number.isFinite(total) || total <= 0) return null;
        return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
    }

    // What a row shows for a playing item. `art` is an image URL; `icon` is a
    // feather icon drawn in a tile when there is no artwork.
    function describe(track) {
        switch (sourceOf(track)) {
            case 'tv':
                return { source: 'tv', title: 'TV', artist: null, album: null, art: null, icon: 'tv', duration: null };
            case 'vinyl':
                return { source: 'vinyl', title: 'Record Player', artist: 'Vinyl', album: 'Now Spinning', art: RECORD_PLAYER_ART, icon: null, duration: null };
            default:
                return {
                    source: 'music',
                    title: track.title || '',
                    artist: track.artist || null,
                    album: track.album || null,
                    art: track.albumArtURI || null,
                    icon: track.albumArtURI ? null : 'music',
                    duration: formatDuration(track.duration)
                };
        }
    }

    return { sourceOf, formatDuration, describe, TV_URI_PREFIX, RECORD_PLAYER_URI };
}));
