var CONNECTIONS = {};
var SPRITES = {};
var GAINS = {};
var FILTERS = {};
var MY_PEER_ID = null;
var ATTRACTOR = null;
var MY_VELOCITY = [0,0];
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

function graphicsAttractOn(data){
  ATTRACTOR = [data.offsetX,data.offsetY];
}

function graphicsAttractOff(){
  ATTRACTOR = null;
}

function graphicsOnRemove(peerId){
  delete CONNECTIONS[peerId];

  GAINS[peerId].disconnect();
  delete GAINS[peerId];

  app.stage.removeChild(SPRITES[peerId]);
  delete SPRITES[peerId];
}

function graphicsOnStream(connection, stream){
  console.log("On Stream")
  var peerId = connection.peer;
  if( !peerId ){
    peerId = MY_PEER_ID;
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
  container.x = app.screen.width / 2;
  container.y = app.screen.width / 2;
  container.width = window.VIDEO_WIDTH;
  container.height = window.VIDEO_DIAMETER;
  SPRITES[peerId] = container;
  app.stage.addChild(container);

  const graphics = new PIXI.Graphics();
  graphics.beginFill(0x55555555);
  graphics.drawCircle(
    sprite.x + window.VIDEO_RADIUS,
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

function setup(){
  app = new PIXI.Application({
    width: document.documentElement.offsetWidth,
    height: document.documentElement.offsetWidth,
    antialias: true,
  });
  app.renderer.backgroundColor = 0xefefef;
  app.renderer.autoResize = true;
  app.renderer.resize(SCREEN_DIMENSIONS[0], SCREEN_DIMENSIONS[1]);
  app.view.addEventListener('mousedown', graphicsAttractOn);
  app.view.addEventListener('mouseup', graphicsAttractOff);
  document.body.appendChild(app.view);
}


function redrawAudio(sprite, peerId){
  var mySprite = SPRITES[MY_PEER_ID];
  var dx = mySprite.x - sprite.x;
  var dy = mySprite.y - sprite.y;
  var distance = Math.sqrt(
    (dx * dx) + (dy * dy)
  );
  var gainNode = GAINS[peerId];
  if( gainNode ){
    gainNode.gain.value = Math.pow(Math.E, -0.005 * distance);
  }
  var filterNode = FILTERS[peerId];
  if( filterNode ){
    filterNode.frequency.value = 10000 * Math.pow(Math.E, -0.001 * distance);
  }
}

function frame(time){
  // calculate where I ought to be
  var sprite = SPRITES[MY_PEER_ID]
  if( sprite && LAST_TIME ){
    var timeDiff = (time - LAST_TIME) / 1000;
    oldPosition = [sprite.x, sprite.y]

    var ax, ay;
    if( ATTRACTOR ){
      ax = (ATTRACTOR[0] - sprite.x) * 1.5;
      ay = (ATTRACTOR[1] - sprite.y) * 1.5;
    } else {
      ax = -(FRICTION * Math.sign(MY_VELOCITY[0]));
      ay = -(FRICTION * Math.sign(MY_VELOCITY[1]));
    }
    vx = MY_VELOCITY[0] + (ax * timeDiff);
    vy = MY_VELOCITY[1] + (ay * timeDiff);
    if(Math.abs(vx) < 0.2){
      vx = 0;
    }
    if(Math.abs(vy) < 0.2){
      vy = 0;
    }
    sprite.x = Math.max( window.VIDEO_RADIUS,
      Math.min(
        app.screen.width - window.VIDEO_RADIUS,
        sprite.x + (vx * timeDiff)
      )
    );
    sprite.y = Math.max( window.VIDEO_RADIUS,
      Math.min(
        app.screen.height - window.VIDEO_RADIUS,
        sprite.y + (vy * timeDiff)
      )
    );
    MY_VELOCITY = [vx, vy];

    if( oldPosition[0] !== sprite.x || oldPosition[1] !== sprite.y ){
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
  }

  LAST_TIME = time;
  requestAnimationFrame(frame);
}

function graphicsInitialize(){
  audioCtx = new AudioContext();
  setup();
  frame();
}
