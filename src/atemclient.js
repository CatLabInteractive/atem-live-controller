/*
    This class is very similar to atem-connection AtemClient class
    but this communicates via websocket to node server
*/
const defaultState = require('./state.constellation.json');


class AtemClient {
    constructor(websocket) {
        this.state = defaultState;
        this.visibleInputs = this.getVisibleInputs()
        this.websocket = websocket;
    }

    reconnect() {
        this.websocket = new WebSocket(this.websocketUrl);
        this.websocket.addEventListener("open", function (event) {
            console.log("Websocket opened");
            this.intervalID = clearTimeout(this.intervalID);
            atem.connected = true;
        });
        this.websocket.addEventListener("message", (event) => {
            const { path, state } = JSON.parse(event.data);
            if (path === 'state') return;
            console.log(path, state);
            deepSet(atem, path, state)
            if (path === 'state' || path === 'state.inputs' || path == 'connected') {
                atem.visibleInputs = atem.getVisibleInputs();
            }
        });
        this.websocket.addEventListener("error", () => {
            console.log("Websocket error");
            this.websocket.close();
            this.intervalID = setTimeout(this.reconnect, 1000);
            // Svelte update connected status
            atem.connected = false;
        });
        this.websocket.addEventListener("close", () => {
            console.log("Websocket closed");
            this.intervalID = setTimeout(this.reconnect, 1000);
            // Svelte update connected status
            atem.store.set(this);
            atem.connected = false;
        });
    }

    sendMessage(data) {
        if (this.websocket.readyState == WebSocket.OPEN) {
            console.log('sendMessage', data);
            const message = JSON.stringify(data);
            this.websocket.send(message);
        } else {
            console.warn('Websocket is closed. Cannot send message.')
        }
    }

    getVisibleInputs() {
        const visibleInputs = [];
        let input;
        let meInputs;

        if (!this.state.info.capabilities)
            return visibleInputs;

        for (let me = this.state.info.capabilities.MEs || 0; me >= 0; me--) {
            const bitME = 1 << me;
            visibleInputs[me] = meInputs = [];

            // standard inputs
            for (let i = 1; i <= 20; i++) {
                input = this.state.inputs[i];
                if (input && input.meAvailability & bitME) {
                    meInputs.push(i);
                } else {
                    break;
                }
            }
            // Black
            input = this.state.inputs[0];
            if (input && input.meAvailability & bitME) {
                meInputs.push(0);
            }
            // MixEffects
            for (let i = 10010; i < 11000; i += 10) {
                input = this.state.inputs[i];
                if (input && input.meAvailability & bitME) {
                    meInputs.push(i);
                } else {
                    break;
                }
            }
            // Super Sources
            for (let i = 6000; i < 6010; i++) {
                input = this.state.inputs[i];
                if (input && input.meAvailability & bitME) {
                    meInputs.push(i);
                } else {
                    break;
                }
            }
            // Colors
            for (let i = 2001; i < 3000; i++) {
                input = this.state.inputs[i];
                if (input && input.meAvailability & bitME) {
                    meInputs.push(i);
                } else {
                    break;
                }
            }
            // Color Bars
            input = this.state.inputs[1000];
            if (input && input.meAvailability & bitME) {
                meInputs.push(1000);
            }
            // Media Players
            for (let i = 3010; i < 4000; i += 10) {
                input = this.state.inputs[i];
                if (input && input.meAvailability & bitME) {
                    meInputs.push(i);
                } else {
                    break;
                }
            }
        }

        return visibleInputs;
    }

    changeProgramInput(source, mixEffect) {
        this.sendMessage(['changeProgramInput', source, mixEffect])
        this.state.video.mixEffects[0].programInput = source;
    }
    changePreviewInput(source, mixEffect) {
        this.sendMessage(['changePreviewInput', source, mixEffect])
        this.state.video.mixEffects[0].previewInput = source;
    }
    cut(mixEffect) {
        this.sendMessage(['cut', mixEffect]);
    }
    autoTransition(mixEffect) {
        this.sendMessage(['autoTransition', mixEffect]);
    }
    fadeToBlack(mixEffect) {
        this.sendMessage(['fadeToBlack', mixEffect]);
    }

    togglePreviewTransition(mixEffect) {
        const on = !this.state.video.mixEffects[mixEffect].transitionPreview;
        this.sendMessage(['previewTransition', on, mixEffect]);
    }

    setTransitionPosition(position, mixEffect) {
        this.sendMessage(['setTransitionPosition', position, mixEffect]);
    }

    setDownstreamKeyTie(tie, downstreamKeyerId) {
        this.sendMessage(['setDownstreamKeyTie', tie, downstreamKeyerId]);
    };

    setDownstreamKeyOnAir(onAir, downstreamKeyerId) {
        this.sendMessage(['setDownstreamKeyOnAir', onAir, downstreamKeyerId]);
    };

    autoDownstreamKey(downstreamKeyerId, isTowardsOnAir) {
        this.sendMessage(['autoDownstreamKey', downstreamKeyerId, isTowardsOnAir]);
    }

    toggleUpstreamKeyNext(index, mixEffect) {
        const nextSelection = this.state.video.mixEffects[mixEffect].transitionProperties.selection ^ (1 << index);
        this.sendMessage(['setTransitionStyle', {nextSelection}, mixEffect]);
    }

    setTransitionStyle(nextStyle, mixEffect) {
        this.sendMessage(['setTransitionStyle', {nextStyle}, mixEffect]);
    }

    setUpstreamKeyerFly(flyEnabled, mixEffect, upstreamKeyerId) {
        this.sendMessage(['setUpstreamKeyerType', {flyEnabled}, mixEffect, upstreamKeyerId]);
    }

    setUpstreamKeyerOnAir(onAir, mixEffect, upstreamKeyerId) {
        this.sendMessage(['setUpstreamKeyerOnAir', onAir, mixEffect, upstreamKeyerId])
    }

    macroRun(index) {
        console.log("macroRun ", index);
        this.sendMessage(['macroRun', index]);
    }
    macroStop() {
        this.sendMessage(['macroStop']);
    }
    macroStopRecord() {
        this.sendMessage(['macroStopRecord']);
    }
    macroDelete(index) {
        this.sendMessage(['macroDelete', index]);
    }
    macroSetName(index, name) {
        this.sendMessage({ method: 'MacroPropertiesCommand', params: { index, updateProps: {name} } });
        this.sendMessage(['macroUpdateProperties', {name}, index]);
    }
    macroStartRecord(index, name, description) {
        this.sendMessage(['macroStartRecord', index, name, description]);
    }
    macroToggleLoop() {
        this.sendMessage(['macroSetLoop', !atem.state.macro.macroPlayer.loop]);
    }

    mediaPlayerStart(mediaPlayerId) {
        this.sendMessage(['setMediaPlayerSettings', {playing: 1}, mediaPlayerId]);
    }
    mediaPlayerStop(mediaPlayerId) {
        this.sendMessage(['setMediaPlayerSettings', {playing: 0}, mediaPlayerId]);
    }
    mediaPlayerToggleLoop(mediaPlayerId) {
        const loop = !atem.state.media.players[mediaPlayerId].loop;
        this.sendMessage(['setMediaPlayerSettings', {loop}, mediaPlayerId]);
    }
    setPlayerStillSource(stillIndex, mediaPlayerId) {
        this.sendMessage(['setMediaPlayerSource', {stillIndex, sourceType: 1}, mediaPlayerId]);
    }
    setPlayerClipSource(clipIndex, mediaPlayerId) {
        this.sendMessage(['setMediaPlayerSource', {stillIndex, sourceType: 1}, mediaPlayerId]);
    }
    uploadStill(file, index) {
        let img, reader;
        let atem = this;
        let [width, height] = getResolution(this.state.settings.videoMode)
        if (file.type.match(/image.*/)) {
            img = document.querySelectorAll('.media-thumb img')[index];
            reader = new FileReader();
            reader.onload = function (e) {
                img.onload = function () {
                    let canvas, ctx;
                    canvas = document.createElement("canvas");
                    canvas.width = width
                    canvas.height = height
                    ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);
                    console.log('drawing Image', width, height)
                    // upload to server
                    atem.sendMessage(["uploadStill", index || 0, canvas.toDataURL("image/png"), file.name, '']);
                }
                img.src = e.target.result;
            }
            reader.readAsDataURL(file);
        } else {
            alert('This file is not an image.');
        }
    }
}

function getResolution(videoMode) {
    const PAL = [720, 576];
    const NTSC = [640, 480];
    const HD = [1280, 720];
    const FHD = [1920, 1080];
    const UHD = [3840, 2160];
    const enumToResolution = [
        NTSC, PAL, NTSC, PAL,
        HD, HD,
        FHD, FHD, FHD, FHD, FHD, FHD, FHD, FHD,
        UHD, UHD, UHD, UHD,
        UHD, UHD
    ];
    return enumToResolution[videoMode];
}

module.exports = {
    AtemClient,
};
