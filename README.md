# ATEM Live Controller
The customizable video switchers web controller.

# Features
- Switching program/preview inputs
- keyboard shortcuts as in original ATEM switchers app: 1-8 changes preview, Ctrl+1-8 changes program, Spacebar for CUT transition and Enter for AUTO transition.
- websocket communication with server for more efficient and faster reactions
- Svelte reactive frontend for simpler development

# Installation
- Copy `config.json.sample` to `config.json`
- Install dependencies with npm `npm install` or `pnpm install` or `yarn install`

```sh
cp config.json.sample config.json
npm install
```

# Run
- Run the app server

```sh
npm start
```
or 
```sh
node ./src/server.js
```
or run with [PM2](http://pm2.keymetrics.io/)
```sh
pm2 start process.yml
```
or when in development mode
```sh
npm start dev
```
Then go to this address in your browser: `http://localhost:8080/` or `http://host:port/` which is set in config.json.

# Screenshots
<img src="docs/screen-desktop.png" width="800">
<img src="docs/screen-mobile.png" width="200">

# Contributing
1. Fork it ( https://github.com/filiphanes/atem-live-controller )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Implement your feature
4. Commit your changes (`git commit -am 'Add some feature'`)
5. Push to the branch (`git push origin my-new-feature`)
6. Create new Pull Request

# TODO
- media uploads
- settings tab
- audio control tab
- camera control tab
- support more atem functionality

1. Macros
    - [x]  12-16 compact buttons to trigger Macros.
    - [~]  A method to save a macro?
    - [~]  Method to change Macro button label or fetch button name from ATEM?
2. Media Players/HyperDeck Control
    - [x]  Control Media player clip selection for Media Players 1-4
    - [x]  Play/pause control
    - [~]  Ability to upload media?
    - [ ]  Same abilities for HyperDeck control?
3. Integrate additional controls
    - [x]  Add tabs for other ME’s of the Constellation (tab for ME/2.ME/3 and ME/4) {"device":1} , {"device":2},{"device":3}
    - [x]  Add 2 rows of Camera input buttons looking to get the buttons that are currently there + up to camera 20
    - [x]  Add Super Source buttons to ME/1
    - [x]  Add Downstream Key 3 and 4
    - [x]  Add Next Transition Key 3 and 4
4. Remove Controls
    - [ ]  Transition style to just have DVE and MIX
    - [ ]  Remove Fade to Black

# Thanks
- Font made by "とろ庵" http://www.trojanbear.net/s/category/font
- svelte framework
- atem-connection library for communication with atem hardware

# License
The MIT License (MIT)

Copyright (c) 2019 Filip Hanes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
