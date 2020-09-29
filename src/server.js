const express    = require('express');
const fileUpload = require('express-fileupload');
const { Atem, Commands } = require('atem-connection')
const config     = require('../config.json');
const fs         = require('fs');

const app = express();
var expressWs = require('express-ws')(app);

let atem;
const switchers = [];

let CLIENTS = expressWs.getWss().clients;

let device = 0;
for (var switcher of config.switchers) {
  console.log('Initializing switcher', switcher.addr, switcher.port)
  atem = new Atem({ externalLog: console.log, debug: false })
  atem.connect(switcher.addr);
  atem.state.device = device;
  atem.connected = false;
  switchers.push(atem);

  atem.on('stateChanged', function (atemstate, paths) {
    // console.log('atem paths', paths);
    for (let path of paths) {
      let state = atemstate;
      if (path != 'info.lastTime') {
        // console.log('atem path', path, state);
        let parts = ['state'];
        for (let a of path.split('.')) {
          const parent = state;
          if (Array.isArray(state)) {
            state = state[+a];
          } else {
            state = state[a];
          }
          if (typeof state === 'undefined') {
            // console.log('undefined', parts, a);
            if (a === 'ME') {
              // XXX - maybe it should be fixed in atem-connection lib
              a = 'mixEffects'
              state = parent[a];
            } else {
              state = parent;
              break;
            }
          }
          parts.push(a);
        }
      
        console.log('changed', parts.join('.'))
        broadcast(JSON.stringify({
          path: parts.join('.'),
          state: state
        }));
      }
    }
  });
  atem.on('connected', () => {
    console.log('atem connected');
    atem.connected = true;
    broadcast(JSON.stringify({ path: 'connected', state: true }));
  });
  atem.on('disconnected', (err) => {
    console.log('atem disconnected');
    atem.connected = false;
    broadcast(JSON.stringify({ path: 'connected', state: false }));
  });
  atem.on('error', (err) => {
    console.log('atem error', err);
  });
  device += 1;
}

function broadcast(message) {
  for (var client of CLIENTS) {
    client.send(message);
  }
}

app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
}));

app.post('/uploadMedia', function (req, res) {
  console.log(req.files.media); // the uploaded file object
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
  }
  // let fileUploader = new ATEM.FileUploader(switchers[0]);
  // fileUploader.uploadFromPNGBuffer(req.files.media.data, req.params.bankIndex || 0);
  return res.status(200).send('Media was successfuly uploaded.');
});

app.use(express.static(__dirname + '/../public', {
  index: 'index.html',
}));

app.ws('/ws', function (ws, req) {
  const ip = req.connection.remoteAddress;
  console.log(ip, 'connected');
  // initialize client with switcher state
  ws.send(JSON.stringify({ path: "state", state: switchers[0].state }));
  ws.send(JSON.stringify({ path: 'connected', state: switchers[0].connected }));

  ws.on('message', function incoming(message) {
    console.log(message.slice(0, 500));
    const [method, ...args] = JSON.parse(message);
    const atem = switchers[0];

    if ('uploadStill' === method) {
      let matches = args[1].match(/^data:(\w+\/\w+);base64,(.*)$/);
      if (matches[1] == 'image/png') {
        args[1] = Buffer.from(matches[2], 'base64');
        fs.writeFile("upload.png", buffer, "binary");
      } else {
        console.error('Uploaded image is not png');
        return;
      }
    }

    try {
      atem[method](...args);
    } catch (error) {
      console.error(error);
    }
  });
});

app.listen(config.server.port, config.server.host);
