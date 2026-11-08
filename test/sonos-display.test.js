const test = require('node:test');
const assert = require('node:assert/strict');
const { sourceOf, formatDuration, describe, RECORD_PLAYER_URI } = require('../sonos-display.js');

const tvTrack = { uri: 'x-sonos-htastream:RINCON_000E58123456701400:spdif', title: '', artist: '', duration: 0 };

test('detects the home theater TV input', () => {
    assert.equal(sourceOf(tvTrack), 'tv');
});

test('detects the record player stream', () => {
    assert.equal(sourceOf({ uri: RECORD_PLAYER_URI }), 'vinyl');
});

test('treats everything else as music, including a missing uri', () => {
    assert.equal(sourceOf({ uri: 'x-sonos-spotify:spotify%3atrack%3a123' }), 'music');
    assert.equal(sourceOf({}), 'music');
    assert.equal(sourceOf(undefined), 'music');
});

test('TV row is labelled TV with a tile icon and no duration', () => {
    assert.deepEqual(describe(tvTrack), {
        source: 'tv', title: 'TV', artist: null, album: null, art: null, icon: 'tv', duration: null
    });
});

test('music row keeps its track data and formats the length', () => {
    const row = describe({ uri: 'x-sonos-spotify:abc', title: 'So What', artist: 'Miles Davis', album: 'Kind of Blue', albumArtURI: 'https://i.scdn.co/x', duration: 562 });
    assert.equal(row.title, 'So What');
    assert.equal(row.artist, 'Miles Davis');
    assert.equal(row.album, 'Kind of Blue');
    assert.equal(row.art, 'https://i.scdn.co/x');
    assert.equal(row.icon, null);
    assert.equal(row.duration, '9:22');
});

test('music without artwork falls back to an icon tile', () => {
    const row = describe({ uri: 'x-sonos-spotify:abc', title: 'Track', duration: 60 });
    assert.equal(row.art, null);
    assert.equal(row.icon, 'music');
});

test('formatDuration hides zero or missing lengths instead of showing 0:00', () => {
    assert.equal(formatDuration(0), null);
    assert.equal(formatDuration(undefined), null);
    assert.equal(formatDuration('abc'), null);
});

test('formatDuration pads seconds and never rolls to :60', () => {
    assert.equal(formatDuration(65), '1:05');
    assert.equal(formatDuration(119.6), '1:59');
});
