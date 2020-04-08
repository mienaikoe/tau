var CONNECTIONS = {};
var STREAMS = {};
var SPRITES = {};
var GAINS = {};
var FILTERS = {};
var MY_PEER_ID = null;
var MY_VELOCITY = [0,0];
var MOUSE_DOWN = false;
var FRICTION = 100; // velocity / s
var LAST_TIME = null;
var app;
var audioCtx;

window.VIDEO_DIAMETER = 72;
window.VIDEO_RADIUS = window.VIDEO_DIAMETER / 2;
window.VIDEO_WIDTH = window.VIDEO_DIAMETER * (4/3);

SCREEN_DIMENSIONS = [1200, 800];

var colorArray = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6',
		  '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
		  '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
		  '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
		  '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
		  '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
		  '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680',
		  '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
		  '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3',
		  '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'];


function graphicsOnMe(peerId){
  console.log('My peer ID is: ' + peerId);
  MY_PEER_ID = peerId;
  graphicsCreateConnectionContainer(peerId);
}

function graphicsOnRemove(peerId){
  delete CONNECTIONS[peerId];

  if( peerId in GAINS ){
    GAINS[peerId].disconnect();
    delete GAINS[peerId];
  }

  if( peerId in SPRITES ){
    app.stage.removeChild(SPRITES[peerId]);
    delete SPRITES[peerId];
  }
}

function onMouseDown(){
  MOUSE_DOWN = true;
  var sprite = SPRITES[MY_PEER_ID];
  sprite.scale.set(1.2, 1.2);
}

function onMouseMove(ev){
  if( !MOUSE_DOWN ){
    return;
  }
  var sprite = SPRITES[MY_PEER_ID];
  sprite.x = ev.data.originalEvent.offsetX;
  sprite.y = ev.data.originalEvent.offsetY;

  for( peerId in SPRITES ){
    var peerSprite = SPRITES[peerId];
    redrawAudio(peerSprite, peerId);
  }
}

function onMouseUp(){
  MOUSE_DOWN = false;
  var sprite = SPRITES[MY_PEER_ID];
  sprite.scale.set(1, 1);

  for( peerId in CONNECTIONS ){
    var connection = CONNECTIONS[peerId]
    connection.send({
      x: sprite.x,
      y: sprite.y
    });
  }

  redrawStreams();
}

function graphicsOnStream(mediaConnection, stream){
  console.log("On Stream")
  var peerId;
  if( mediaConnection ){
    peerId = mediaConnection.peer
    if( peerId === MY_PEER_ID ){
      return;
    }
    if( peerId in STREAMS ){
      return;
    }
    STREAMS[peerId] = mediaConnection;
  } else {
    peerId = MY_PEER_ID;
  }

  if( !peerId ){
    return;
  }

  graphicsCreateStreamSprite(peerId, stream);
}


function graphicsCreateStreamSprite(peerId, stream){
  console.log("Creating Stream Sprite");
  // hook up video sprite
  var video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  videoTexture = PIXI.Texture.fromVideo(video);
  var sprite = new PIXI.Sprite(videoTexture);

  const graphics = new PIXI.Graphics();
  graphics.beginFill(0x000000);
  graphics.drawCircle(
    sprite.x + window.VIDEO_WIDTH / 2,
    sprite.y + window.VIDEO_RADIUS,
    window.VIDEO_RADIUS);
  graphics.endFill();
  sprite.mask = graphics;

  const container = SPRITES[peerId];
  if( container ){
    container.addChild(sprite);
    container.addChild(graphics);
  } else {
    console.warn("container not found for peerId " + peerId);
  }

  // hook up audio
  if( peerId !== MY_PEER_ID ){
    var sourceNode = audioCtx.createMediaStreamSource(stream)
    var gainNode = audioCtx.createGain();
    var filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    GAINS[peerId] = gainNode;
    FILTERS[peerId] = filterNode;
    redrawAudio(sprite, peerId);
    sourceNode.connect(gainNode);
    gainNode.connect(filterNode);
    filterNode.connect(audioCtx.destination);
  }
}

function graphicsCreateConnectionContainer(peerId){
  var container = new PIXI.Container()
  container.pivot.x = window.VIDEO_RADIUS;
  container.pivot.y = window.VIDEO_RADIUS;
  container.x = app.renderer.width / 2;
  container.y = app.renderer.width / 2;
  container.width = window.VIDEO_WIDTH;
  container.height = window.VIDEO_DIAMETER;
  if( peerId === MY_PEER_ID ){
    container.interactive = true;
    container.buttonMode = true;
    container.on('mousedown', onMouseDown);
    container.on('mousemove', onMouseMove);
    // container.on('mouseout', onMouseUp);
    container.on('mouseup', onMouseUp);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x2288CC);
    bg.drawCircle(
      container.x + window.VIDEO_WIDTH / 2,
      container.y + window.VIDEO_RADIUS,
      window.VIDEO_RADIUS + 5);
    bg.endFill();
    container.addChild(bg);
  } else {
    const bg = new PIXI.Graphics();
    bg.beginFill(colorArray[Math.floor(Math.random() * colorArray.length)]);
    bg.drawCircle(
      container.x + window.VIDEO_WIDTH / 2,
      container.y + window.VIDEO_RADIUS,
      window.VIDEO_RADIUS
    );
    bg.endFill();
    container.addChild(bg);
  }
  SPRITES[peerId] = container;
  app.stage.addChild(container);
}

function graphicsOnConnection(connection){
  console.log("On Connection");
  const peerId = connection.peer;
  CONNECTIONS[peerId] = connection;
  graphicsCreateConnectionContainer(peerId);
}

function graphicsOnRefresh(peerId){
  var connection = CONNECTIONS[peerId];
  var mySprite = SPRITES[MY_PEER_ID];
  if( mySprite ){
    console.log("Sending Data");
    connection.send({
      x: mySprite.x,
      y: mySprite.y
    });
  }
}

function graphicsOnStreamDisconnect(connection){
  // TODO
}

function graphicsOnData(connection, data){
  console.log("On Data");
  var peerId = connection.peer;
  if( peerId in SPRITES ){
    var sprite = SPRITES[peerId];
    sprite.x = data.x;
    sprite.y = data.y;
    redrawAudio(sprite, peerId);
  }
}

function redrawAudio(sprite, peerId){
  if( !sprite ){
    return;
  }
  var mySprite = SPRITES[MY_PEER_ID];
  if( !mySprite ){
    return;
  }
  var dx = mySprite.x - sprite.x;
  var dy = mySprite.y - sprite.y;
  var distance = Math.sqrt(
    (dx * dx) + (dy * dy)
  );
  var gainNode = GAINS[peerId];
  if( gainNode ){
    gainNode.gain.value = Math.pow(Math.E, -0.01 * distance);
  }
  var filterNode = FILTERS[peerId];
  if( filterNode ){
    filterNode.frequency.value = 10000 * Math.pow(Math.E, -0.01 * distance);
  }
}

function redrawStreams(){
  const peersToConnectTo = [];

  var mySprite = SPRITES[MY_PEER_ID];
  if( !mySprite ){
    return;
  }

  for( peerId in SPRITES ){
    if( peerId === MY_PEER_ID ){
      continue;
    }
    sprite = SPRITES[peerId];

    var dx = mySprite.x - sprite.x;
    var dy = mySprite.y - sprite.y;
    var distance = Math.sqrt(
      (dx * dx) + (dy * dy)
    );

    if( distance > 200 ){
      if( peerId in STREAMS ){
        STREAMS[peerId].close()
        delete STREAMS[peerId];
      }
    } else if( Object.keys(STREAMS).length < 12 ){
      if( !(peerId in STREAMS) ){
        peersToConnectTo.push(peerId);
      }
    }
  }
  if( peersToConnectTo.length > 0 ){
    streamToOthers(peersToConnectTo);
  }
}

function setup(){
  app = new PIXI.Application({
    width: document.documentElement.offsetWidth,
    height: document.documentElement.offsetWidth,
    antialias: true,
  });
  app.renderer.backgroundColor = 0xefefef;
  app.renderer.autoResize = true;
  app.renderer.resize(SCREEN_DIMENSIONS[0], SCREEN_DIMENSIONS[1]);
  document.body.appendChild(app.view);
}

function graphicsInitialize(){
  audioCtx = new AudioContext();
  setup();
}
