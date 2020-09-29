<script>
  import { onMount, onDestroy } from "svelte";
  import { AtemClient } from "./atemclient.js";
  import Feather from "./Feather.svelte";

  let websocket;
  let intervalID;
  let atem = new AtemClient(websocket);
  window.atem = atem;
  let currentME = 0;
  let activeMacro = 0;
  let activeMacroIsUsed = false;
  let unsubscribe;

  $: activeMacroIsUsed = atem.state.macro.macroProperties[activeMacro].isUsed;

  function deepSet(obj, path, value) {
      for (var i = 0, path = path.split('.'), len = path.length - 1; i < len; i++) {
          if (Array.isArray(obj)) {
              obj = obj[+path[i]];
          } else {
              obj = obj[path[i]];
          }
      };
      return obj[path[i]] = value;
  };

  function reconnect() {
    atem.websocket = new WebSocket(window.location.origin.replace("http", "ws") + "/ws")
    atem.wsconnected = false;
    atem.websocket.addEventListener("open", function (event) {
        console.log("Websocket opened");
        intervalID = clearTimeout(intervalID);
        atem.wsconnected = true;
    });
    atem.websocket.addEventListener("message", (event) => {
        const { path, state } = JSON.parse(event.data);
        console.log(path, state);
        deepSet(atem, path, state)
        if (path === 'state' || path === 'state.inputs' || path == 'connected') {
            atem.visibleInputs = atem.getVisibleInputs();
        }
        atem = atem;
    });
    atem.websocket.addEventListener("error", () => {
        console.log("Websocket error");
        atem.websocket.close();
        intervalID = setTimeout(reconnect, 1000);
        // Svelte update connected status
        atem.wsconnected = false;
    });
    atem.websocket.addEventListener("close", () => {
        console.log("Websocket closed");
        intervalID = setTimeout(reconnect, 1000);
        // Svelte update connected status
        atem.wsconnected = false;
    });
  }

  reconnect();

  onMount(() => {
    document.addEventListener("keyup", onKeyUp);
  });

  onDestroy(() => {
    unsubscribe();
  })

  function onKeyUp(event) {
    var key = event.key || event.keyCode;
    if (key === " " || key === 32) {
      event.preventDefault();
      atem.cut(currentME);
    } else if (key === "Enter" || key === 13) {
      atem.cut(currentME);
      atem.autoTransition(currentME);
    } else if (key >= "0" && key <= "9") {
      if (event.getModifierState("Control")) {
        atem.changeProgramInput(+key, currentME);
      } else {
        atem.changePreviewInput(+key, currentME);
      }
    }
  }
</script>

<header>
  <h1>{atem.state.info.productIdentifier}</h1>
  <a href="#switcher" class="tab"><Feather icon="grid"/>Switcher</a>
  <a href="#media" class="tab"><Feather icon="film"/>Media</a>
  <a href="#macros" class="tab"><Feather icon="box"/>Macros</a>
  <span class="tab connection-status" class:connected={atem.wsconnected}
        title="Connection status: green=connected, red=disconnected">
    {#if atem.wsconnected}<Feather icon="zap"/>{:else}<Feather icon="alert-triangle"/>{/if}
    Server
  </span>
  <span class="tab connection-status" class:connected={atem.connected}
        title="Connection status: green=connected, red=disconnected">
    {#if atem.connected}<Feather icon="zap"/>{:else}<Feather icon="alert-triangle"/>{/if}
    ATEM
  </span>
</header>

<div id="atem" class="screen">
  {#if Object.keys(atem.state.video.mixEffects).length > 1}
  <div class="button-group horizontal mix-effect-buttons" role="group" aria-label="Mix Effects">
  {#each Object.values(atem.state.video.mixEffects) as ME}
    <button type="button" class="gray-button"
      class:active={currentME == ME.index}
      on:click={e => {currentME = ME.index}}>
    Mix Effects {ME.index+1}</button>
  {/each}
  </div>
  {/if}
  {#each atem.state.video.mixEffects[currentME] && [atem.state.video.mixEffects[currentME]] as ME}
  <section class="channels">
    <h3>Mix Effects {ME.index+1} Program & Preview</h3>
    <div class="well row-buttons">
    {#each atem.visibleInputs[ME.index] as input}
      <div class="button"
        class:red={ME.programInput === input}
        class:green={ME.previewInput === input}
        on:click={e => atem.changePreviewInput(input, ME.index)}
        title={atem.state.inputs[input].longName}>
        <p>{atem.state.inputs[input].shortName}</p>
      </div>
    {/each}
    </div>
  </section>

  <section class="transition">
    <h3>Transition</h3>
    <div class="well row-buttons">
      <div class="button" on:click={e=>atem.cut(ME.index)}>
        <p>CUT</p>
      </div>
      <div class="button"
        class:red={ME.transitionPosition.inTransition}
        on:click={e=>atem.autoTransition(ME.index)}>
        <p>AUTO</p>
      </div>
      <input class="slider" type="range"
        min="0" max="10000" step="100"
        bind:value={ME.transitionPosition.handlePosition}
        on:input={e => atem.setTransitionPosition(ME.transitionPosition.handlePosition, ME.index)}
        />
    </div>
  </section>

  <section class="next-transition">
    <h3>Next Transition</h3>
    <div class="well row-buttons">
      <div class="button"
        class:yellow={ME.transitionProperties.selection & 1}
        on:click={e => atem.toggleUpstreamKeyNext(0, ME.index)}>
        <p>BKGD</p>
      </div>
      {#each ME.upstreamKeyers as keyer, i}
        <div class="button"
          class:red={keyer.onAir}
          on:click={e => atem.setUpstreamKeyerOnAir(!keyer.onAir, ME.index, keyer.upstreamKeyerId)}>
          <p>ON<br />AIR</p>
        </div>
        <div class="button"
          class:yellow={ME.transitionProperties.selection & (1<<(i+1))}
          on:click={e => atem.toggleUpstreamKeyNext(i+1, ME.index)}>
          <p>Key {keyer.upstreamKeyerId+1}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="transition-style">
    <h3>Transition style</h3>
    <div class="well row-buttons">
      <div class="button"
        class:yellow={ME.transitionProperties.style == 0}
        on:click={e => atem.setTransitionStyle(0, ME.index)}>
        <p>MIX</p>
      </div>
      <div class="button"
        class:yellow={ME.transitionProperties.style == 1}
        on:click={e => atem.setTransitionStyle(1, ME.index)}>
        <p>DIP</p>
      </div>
      <div class="button"
        class:yellow={ME.transitionProperties.style == 2}
        on:click={e => atem.setTransitionStyle(2, ME.index)}>
        <p>WIPE</p>
      </div>
      {#if atem.state.info.capabilities.stingers > 0}
        <div class="button"
          class:yellow={ME.transitionProperties.style == 3}
          on:click={e => atem.setTransitionStyle(3, ME.index)}>
          <p>STING</p>
        </div>
      {/if}
      {#if atem.state.info.DVEs > 0}
        <div class="button"
          class:yellow={ME.transitionProperties.style == 4}
          on:click={e => atem.setTransitionStyle(4, ME.index)}>
          <p>DVE</p>
        </div>
      {/if}
      <div class="button"
        class:yellow={ME.transitionPreview}
        on:click={e=>atem.togglePreviewTransition(ME.index)}>
        <p>PREV<br />TRAN</p>
      </div>
    </div>
  </section>

  <section class="fade-to-black">
    <h3>Fade to Black</h3>
    <div class="well row-buttons">
      <div class="button"
        class:red={ME.fadeToBlack.isFullyBlack}
        on:click={e=>atem.fadeToBlack(ME.index)}>
        <p>FTB</p>
      </div>
    </div>
  </section>
  {/each}

  <br/>
  {#each Object.keys(atem.state.video.downstreamKeyers) as key}
  <section class="downstream-key">
    <h3>Downstream Key {+key+1}</h3>
    <div class="well row-buttons">
      <div class="button"
        class:yellow={atem.state.video.downstreamKeyers[key].properties.tie}
        on:click={e => atem.setDownstreamKeyTie(!atem.state.video.downstreamKeyers[key].properties.tie, +key)}>
        <p>TIE</p>
      </div>
      <div class="button"
        class:red={atem.state.video.downstreamKeyers[key].onAir}
        on:click={e => atem.setDownstreamKeyOnAir(!atem.state.video.downstreamKeyers[key].onAir, +key)}>
        <p>ON<br />AIR</p>
      </div>
      <div class="button"
        class:red={atem.state.video.downstreamKeyers[key].inTransition}
        on:click={e => atem.autoDownstreamKey(+key, !atem.state.video.downstreamKeyers[key].onAir)}>
        <p>AUTO</p>
      </div>
    </div>
  </section>
  {/each}

</div><!-- screen switcher-->

<div id="media" class="screen">
  <h2>Media</h2>
  {#each atem.state.media.players as player, i}
    <div class="media-thumb well"
      on:drop={e=>atem.uploadStill(e.dataTransfer.files[0], i)}>
      <img alt={atem.state.media.stillPool[player.stillIndex].fileName || "Upload Media "+(i+1)}
        on:click={e=>e.target.parentNode.querySelector('input').click()}
      />
      <input type="file" name="media" on:change={e=>atem.uploadStill(e.target.files[0], i)}/>
      <select class="media-still-select"
        value={player.stillIndex}
        on:change={e=>atem.setPlayerStillSource(e.target.value, i)}>
      {#each atem.state.media.stillPool as still, i}
        <option value="{i}">Still {i+1}: {still.fileName}</option>
      {/each}
      </select>
      {#if atem.state.media.stillPool[player.stillIndex].isUsed}
      <div class="media-buttons">
        {#if player.playing}
        <div class="gray-button active"
          on:click={e=>atem.mediaPlayerStop(i)}>
          <Feather icon="square"/>
        </div>
        {:else}
        <div class="gray-button"
          on:click={e=>atem.mediaPlayerStart(i)}>
          <Feather icon="play"/>
        </div>
        {/if}
        <div class="gray-button"
          on:active={player.looping}
          on:click={e=>atem.mediaPlayerToggleLoop(i)}>
          <Feather icon="repeat"/>
        </div>
      </div>
      {/if}
    </div>
  {/each}
</div><!-- screen media-->

<div id="macros" class="screen" class:running={atem.state.macro.macroPlayer.isRunning}>
  <h2>Macros
    {#if atem.state.macro.macroPlayer.isRunning}
    <div class="gray-button active"
      on:click={e=>atem.macroStop()}>
      <Feather icon="square" size=14/> Stop
    </div>
    {:else}
    <div class="gray-button"
      on:click={e=>atem.macroRun(activeMacro)}>
      <Feather icon="play" size=14/> Play
    </div>
    {/if}

    <div class="gray-button"
      class:active={atem.state.macro.macroPlayer.loop}
      on:click={e=>atem.macroToggleLoop()}>
      <Feather icon="repeat" size=14/> Loop
    </div>

    {#if atem.state.macro.macroRecorder.isRecording}
      <div class="gray-button red"
        on:click={e=>atem.macroStopRecord()}>
        <Feather icon="stop-circle" size=14/> Stop Record
      </div>
    {:else}
      <div class="gray-button"
        on:click={e=>{
        let name;
        if (name = prompt('Name:', atem.state.macro.macroProperties[activeMacro].name))
            atem.macroStartRecord(activeMacro, name, '')
          }}>
        <Feather icon="plus-circle" size=14/> Record
      </div>
    {/if}

    <div class="gray-button"
      class:disabled={!activeMacroIsUsed}
      on:click={e=> {
        let name;
        if (activeMacroIsUsed &&
            (name = prompt('Name:', atem.state.macro.macroProperties[activeMacro].name)))
          atem.macroSetName(activeMacro, name)
      }}>
      <Feather icon="edit-3" size=14/> Name
    </div>

    <div class="gray-button"
      class:disabled={!activeMacroIsUsed}
      on:click={e=> {
        if (activeMacroIsUsed &&
            confirm('Are you sure, you want to delete this macro:'))
          atem.macroDelete(activeMacro)
      }}>
      <Feather icon="minus-circle" size=14/> Delete
    </div>
  </h2>

  <div class="macro-scroll">
    <div class="macro-row">
      <div class="macro-buttons">
      {#each atem.state.macro.macroProperties as macro, i}
        <div class="gray-button"
          class:red={macro.macroIndex == atem.state.macro.macroPlayer.macroIndex}
          class:disabled={!macro.isUsed}
          class:active={activeMacro == i}
          on:click={e=>activeMacro=i}
          title={macro.description}>{macro.name}</div>
      {/each}
      </div>
    </div>
  </div>
</div> <!-- screen macros -->
