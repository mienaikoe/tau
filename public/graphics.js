var CONNECTIONS = {};
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

window.VIDEO_DIAMETER = 64;
window.VIDEO_RADIUS = window.VIDEO_DIAMETER / 2;
window.VIDEO_WIDTH = window.VIDEO_DIAMETER * (4/3);

SCREEN_DIMENSIONS = [800, 600];



function graphicsOnMe(peerId){
  console.log('My peer ID is: ' + peerId);
  MY_PEER_ID = peerId;
}

function graphicsOnRemove(peerId){
  delete CONNECTIONS[peerId];

  GAINS[peerId].disconnect();
  delete GAINS[peerId];

  app.stage.removeChild(SPRITES[peerId]);
  delete SPRITES[peerId];
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
  for( peerId in CONNECTIONS ){
    var connection = CONNECTIONS[peerId]
    connection.send({
      x: sprite.x,
      y: sprite.y
    });
    var peerSprite = SPRITES[peerId];
    if( peerSprite ){
      redrawAudio(peerSprite, peerId);
    }
  }
}

function onMouseUp(){
  MOUSE_DOWN = false;
  var sprite = SPRITES[MY_PEER_ID];
  sprite.scale.set(1, 1);
}

function graphicsOnStream(connection, stream){
  console.log("On Stream")
  var peerId;
  if( connection ){
    peerId = connection.peer
    if( peerId === MY_PEER_ID ){
      return;
    }
    if( peerId in SPRITES ){
      return;
    }
  } else {
    peerId = MY_PEER_ID;
  }

  if( !peerId ){
    return;
  }

  // hook up video sprite
  var video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  videoTexture = PIXI.Texture.fromVideo(video);
  var sprite = new PIXI.Sprite(videoTexture);

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
      sprite.x + window.VIDEO_WIDTH / 2,
      sprite.y + window.VIDEO_RADIUS,
      window.VIDEO_RADIUS + 5);
    bg.endFill();
    container.addChild(bg);
  }
  SPRITES[peerId] = container;
  app.stage.addChild(container);

  const graphics = new PIXI.Graphics();
  graphics.beginFill(0x000000);
  graphics.drawCircle(
    sprite.x + window.VIDEO_WIDTH / 2,
    sprite.y + window.VIDEO_RADIUS,
    window.VIDEO_RADIUS);
  graphics.endFill();
  sprite.mask = graphics;
  container.addChild(sprite);
  container.addChild(graphics);

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

function graphicsOnConnection(connection){
  console.log("On Connection");
  CONNECTIONS[connection.peer] = connection;
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
