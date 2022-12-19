<script>
  import { onMount } from "svelte";
  import { ATEM } from "./atem.js";
  import Feather from "./Feather.svelte";
  import WebMidi from "webmidi";

  let switchers = [];

  let ws;
  let intervalID = 0;

  function doConnect() {
    console.debug("Opening websocket...");
    let url  = window.location + "";
    url = url.slice(0, url.lastIndexOf("/"));
    url = url.replace("http", "ws");
    ws = new WebSocket(url + "/ws");
    ws.addEventListener("open", function(event) {
      console.log("Websocket opened");
      intervalID = clearTimeout(intervalID);
      switchers[0] = new ATEM();
      switchers[0].setWebsocket(ws);
      // update svelte
      ws = ws;
    });
    ws.addEventListener("message", function(event) {
      let data = JSON.parse(event.data);

      let device = data.device || 0;
      switch (data.method) {
        case 'connect':
          switchers[device].connected = true;
        break;
        case 'disconnect':
          switchers[device].connected = false;
        break;

        case 'ranMacro':
          try {
            var macro = switchers[device].state.macros[parseInt(data.macro)];
            if (backgroundWindow) {
              backgroundWindow.postMessage(macro.name, '*');
            }
          } catch (e) {
            // do nothing
            console.log(e);
          }
          break;

        default:
          switchers[device].connected = true;
          switchers[device].state = data;
      }
      return data;
    });
    ws.addEventListener("error", function() {
      console.log("Websocket error");
      intervalID = setTimeout(doConnect, 1000);
    });
    ws.addEventListener("close", function() {
      console.log("Websocket closed");
      intervalID = setTimeout(doConnect, 1000);
    });
  }

  function onKeyUp(event) {
    var key = event.key || event.keyCode;
    if (key === " " || key === 32) {
      event.preventDefault();
      switchers[0].cutTransition();
    } else if (key === "Enter" || key === 13) {
      switchers[0].autoTransition();
    } else if (key >= "0" && key <= "9") {
      if (event.getModifierState("Control")) {
        switchers[0].changeProgramInput(key);
      } else {
        switchers[0].changePreviewInput(key);
      }
    }
  }

  onMount(() => {
    doConnect();
    document.addEventListener("keyup", onKeyUp);
    midiConnect();
  });

  function midiConnect() {

    WebMidi.enable(function (err) {
      if (err) {
        console.log("WebMidi could not be enabled.", err);
        return;
      }

      WebMidi.inputs.forEach(function(input) {
        addMidiInput(input);
      });
    });

  }

  var midiLearningButton = null;
  var midiMap = {};
  var midiPaused = false;

  function addMidiInput(input) {
    input.addListener("noteon", "all", function(e) {

      var noteNumber = e.note.number;
      if (midiLearningButton) {
        midiLearningButton(noteNumber);
        midiLearningButton = null;
        return;
      }

      if (typeof(midiMap[noteNumber]) !== 'undefined') {
        if (!midiPaused) {
          midiMap[noteNumber].atem.runMacro(midiMap[noteNumber].macro)
        }
      }
    });
  }

  function pauseMidi(atem) {
    midiPaused = true;
    document.getElementById('midi-status').innerHTML = 'Midi input paused';
  }

  function resumeMidi(atem) {
    midiPaused = false;
    document.getElementById('midi-status').innerHTML = 'Midi input active';
  }

  function midiLearn(atem, macroId) {

    document.getElementById('macro-' + macroId + '-learn').innerHTML = 'Learning...';
    midiLearningButton = function(note) {
      console.log('Assigning note ' + note);

      midiMap[note] = {
        macro: macroId,
        atem : atem
      }

      document.getElementById('macro-' + macroId + '-learn').innerHTML = 'Midi learn';

      // show all midi notes
      var notes = [];
      for (var k in midiMap) {
        if (midiMap.hasOwnProperty(k) && midiMap[k].macro === macroId) {
          notes.push(k);
        }
      }
      document.getElementById('macro-' + macroId).innerHTML = 'Note ' + notes.join(',');
    };
  }

  function midiClear(atem, macroId) {
    for (var k in midiMap) {
      if (midiMap.hasOwnProperty(k)) {
        if (midiMap[k].macro === macroId && midiMap[k].atem === atem) {
          delete midiMap[k];
        }
      }

      console.log(midiMap);
    }

    document.getElementById('macro-' + macroId).innerHTML = '';
  }

  var backgroundWindow = null;
  var videoToken = null;
  function openBackground() {
    backgroundWindow = window.open('https://regie.catlab.eu/videoAtemStage.html?token=' + videoToken)
    //backgroundWindow = window.open('http://regie.catlab.local.com/videoAtemStage.html?token=' + videoToken)
  }

  function runMacro(atem, macro) {
    return atem.runMacro(macro[0])
  }
</script>

{#each switchers as atem}
<header>
  <h1>{atem.state._pin}</h1>
  <a href="#switcher" class="tab"><Feather icon="grid"/>Switcher</a>
  <a href="#media" class="tab"><Feather icon="film"/>Media</a>
  <a href="#macros" class="tab"><Feather icon="box"/>Macros</a>
  <span class="tab connection-status" class:connected={ws.readyState === 1}
        title="Connection status: green=connected, red=disconnected">
    {#if ws.readyState === 1}<Feather icon="zap"/>{:else}<Feather icon="alert-triangle"/>{/if}
    Server
  </span>
  <span class="tab connection-status" class:connected={atem.connected}
        title="Connection status: green=connected, red=disconnected">
    {#if atem.connected}<Feather icon="zap"/>{:else}<Feather icon="alert-triangle"/>{/if}
    ATEM
  </span>
</header>

<div id="switcher" class="screen">
  <section class="channels">
    <h3>Program & Preview</h3>
    <div class="well">
      {#each atem.visibleChannels as channel}
        <div
          class="button"
          class:red={atem.isProgramChannel(channel)}
          class:green={atem.isPreviewChannel(channel)}
          on:click={e => atem.changePreview(channel)}>
          <p>{channel.label}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="transition">
    <h3>Transition</h3>
    <div class="well">
      <div class="button" on:click={e=>atem.cutTransition()}>
        <p>CUT</p>
      </div>
      <div
        class="button"
        class:red={atem.state.video.ME[0].transitionPosition > 0}
        on:click={e=>atem.autoTransition()}>
        <p>AUTO</p>
      </div>
      <input class="slider" type="range"
        min="0" max="1" step="0.001"
        bind:value={atem.state.video.ME[0].transitionPosition}
        on:input={e => atem.changeTransitionPosition(atem.state.video.ME[0].transitionPosition)}
        />
    </div>
  </section>

  <section class="next-transition">
    <h3>Next Transition</h3>
    <div class="well">
      <div
        class="button"
        class:yellow={atem.state.video.ME[0].upstreamKeyNextBackgroundState}
        on:click={e => atem.toggleUpstreamKeyNextBackground()}>
        <p>BKGD</p>
      </div>
      <div
        class="button"
        class:red={atem.state.video.ME[0].upstreamKeyState[0]}
        on:click={e => atem.toggleUpstreamKeyState(0)}>
        <p>ON<br />AIR</p>
      </div>
      <div
        class="button"
        class:yellow={atem.state.video.ME[0].upstreamKeyNextState[0]}
        on:click={e => atem.toggleUpstreamKeyNextState(0)}>
        <p>Key 1</p>
      </div>
    </div>
  </section>

  <section class="transition-style">
    <h3>Transition style</h3>
    <div class="well">
      <div
        class="button"
        class:yellow={atem.state.video.ME[0].transitionStyle == 0}
        on:click={e => atem.changeTransitionType(0)}>
        <p>MIX</p>
      </div>
      <div
        class="button"
        class:yellow={atem.state.video.ME[0].transitionStyle == 1}
        on:click={e => atem.changeTransitionType(1)}>
        <p>DIP</p>
      </div>
      <div
        class="button"
        class:yellow={atem.state.video.ME[0].transitionStyle == 2}
        on:click={e => atem.changeTransitionType(2)}>
        <p>WIPE</p>
      </div>
      {#if atem.state.topology.numberOfStingers > 0}
        <div
          class="button"
          class:yellow={atem.state.video.ME[0].transitionStyle == 3}
          on:click={e => atem.changeTransitionType(3)}>
          <p>STING</p>
        </div>
      {/if}
      {#if atem.state.topology.numberOfDVEs > 0}
        <div
          class="button"
          class:yellow={atem.state.video.ME[0].transitionStyle == 4}
          on:click={e => atem.changeTransitionType(4)}>
          <p>DVE</p>
        </div>
      {/if}
      <div class="button" on:click={atem.changeTransitionPreview}>
        <p>PREV<br />TRAN</p>
      </div>
    </div>
  </section>

  <section class="downstream-key">
    <h3>Downstream Key 1</h3>
    <div class="well">
      <div
        class="button"
        class:yellow={atem.state.video.downstreamKeyTie[0]}
        on:click={e => atem.toggleDownstreamKeyTie(0)}>
        <p>TIE</p>
      </div>
      <div
        class="button"
        class:red={atem.state.video.downstreamKeyOn[0]}
        on:click={e => atem.toggleDownstreamKeyOn(0)}>
        <p>ON<br />AIR</p>
      </div>
      <div
        class="button"
        class:red={false}
        on:click={e => atem.autoDownstreamKey(0)}>
        <p>AUTO</p>
      </div>
    </div>
  </section>
  <section class="downstream-key">
    <h3>Downstream Key 2</h3>
    <div class="well">
      <div
        class="button"
        class:yellow={atem.state.video.downstreamKeyTie[1]}
        on:click={e => atem.toggleDownstreamKeyTie(1)}>
        <p>TIE</p>
      </div>
      <div
        class="button"
        class:red={atem.state.video.downstreamKeyOn[1]}
        on:click={e => atem.toggleDownstreamKeyOn(1)}>
        <p>ON<br />AIR</p>
      </div>
      <div
        class="button"
        class:red={false}
        on:click={e => atem.autoDownstreamKey(1)}>
        <p>AUTO</p>
      </div>
    </div>
  </section>

  <section class="fade-to-black">
    <h3>Fade to Black</h3>
    <div class="well">
      <div
        class="button"
        class:red={atem.state.video.ME[0].fadeToBlack}
        on:click={e=>atem.fadeToBlack()}>
        <p>FTB</p>
      </div>
    </div>
  </section>
</div><!-- screen switcher-->

<div id="media" class="screen">
  <h2>Media</h2>
  <div class="media-thumb well"
       on:drop={e=>atem.uploadMediaFile(e.dataTransfer.files[0], 1)}>
    <img alt="Upload Media 1"
     on:click={e=>e.target.parentNode.querySelector('input').click()}
    />
    <input type="file" name="media" on:change={e=>atem.uploadMediaFile(e.target.files[0], 0)}/>
  </div>
  <div class="media-thumb well"
       on:drop={e=>atem.uploadMediaFile(e.dataTransfer.files[0], 2)}>
    <img alt="Upload Media 2"
     on:click={e=>e.target.parentNode.querySelector('input').click()}
    />
    <input type="file" name="media" on:change={e=>atem.uploadMediaFile(e.target.files[0], 1)}/>
  </div>
</div><!-- screen media-->

<div id="macros" class="screen">
  <h2>Macros</h2>
  <div class="well">
    {#if atem.state.macros}
      {#each Object.entries(atem.state.macros) as macro }
        <div class="button button-wide"
          class:red={false}
          on:click={e=>runMacro(atem, macro)}
          title={macro[1].description}>
        <p>{macro[1].name}</p>

        </div>

        <div class="midi">
          <span id="macro-{macro[0]}"></span><br />
          <button on:click={e=>midiLearn(atem, macro[0])} id="macro-{macro[0]}-learn">Midi learn</button><br />
          <button on:click={e=>midiClear(atem, macro[0])} id="macro-{macro[0]}-clear">Midi clear</button>
        </div>
      {/each}
    {/if}
  </div>
</div> <!-- screen macros -->

<div id="midi" class="screen">
    <p id="midi-status">Active</p>openPopup
     <button on:click={e=>pauseMidi(atem)} id="macro-pause">Pause midi control</button><br />
     <button on:click={e=>resumeMidi(atem)} id="macro-pause">Resume midi control</button><br />
</div>

<div id="popupBackground" class="screen">
  <h2>Greenscreen background</h2>
  Regie code: <input id="popupBackgroundVideoToken" bind:value={videoToken} /><br />
  <button on:click={e=>openBackground()} id="openPopup">Open video popup</button><br />
</div>

{/each}

