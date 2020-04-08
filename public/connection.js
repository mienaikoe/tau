
var db = firebase.firestore();
var fireRoom = db.collection("rooms").doc("aca-eng-eng");
var peer = null;
var myId = null;
var myStream = null;


function getMyStream(){
  if( !myStream ){
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: {
          max: window.VIDEO_WIDTH,
          ideal: window.VIDEO_WIDTH,
        },
        height: {
          max: window.VIDEO_WIDTH,
          ideal: window.VIDEO_DIAMETER,
        }
      }
    }).then( stream => {
      myStream = stream;
      graphicsOnStream(null, myStream);
      return myStream;
    });
  }
  return Promise.resolve(myStream);
}

function removePeerFromRoom(peerId){
  fireRoom.update({
    members: firebase.firestore.FieldValue.arrayRemove(peerId)
  })
  graphicsOnRemove(peerId);
}

function streamToOthers(members){
  if( members.length){
    getMyStream().then(function (mediaStream) {
      members.forEach(memberId => {
        if( memberId === myId ){
          return;
        }
        var call = peer.call(memberId, mediaStream);
        call.on('stream', graphicsOnStream.bind(null, call));
      });
    })
  }
}

/**
 * Call other members to establish connections with them
 * @param {Array[String]} members
 */
function connectToOthers(members){
  if( members.length){
    members.forEach(memberId => {
      if( memberId == myId ){
        return;
      }
      var conn = peer.connect(memberId);
      graphicsOnConnection(conn);
      conn.on('open', function(){
        conn.on('data', graphicsOnData.bind(null, conn));
      });
      conn.on('close', removePeerFromRoom.bind(null, conn.peer));
    });
  } else {
    console.log("No Members in room");
  }
}

/**
 * set up peerjs listeners for incoming streams and connections
 */
function listenForConnections(){
  // on incoming data connections from new members
  peer.on('connection', function(conn) {
    graphicsOnConnection(conn);
    conn.on('close', removePeerFromRoom.bind(null, conn.peer));
    conn.on('data', graphicsOnData.bind(null, conn));
    graphicsOnRefresh();
  });

  // on incoming streams from new members
  peer.on('call', function(call) {
    // Answer the call, providing our mediaStream
    call.on('stream', graphicsOnStream.bind(null, call));
    getMyStream().then(function (mediaStream) {
      myStream = mediaStream;
      call.answer(mediaStream);
    });
  });
}

/**
 * sets up listeners for incoming data and calls,
 * then runs a call to all current members
 * @param {firebase} roomData
 */
function joinRoom(roomData){
  listenForConnections();
  connectToOthers(roomData.members);
  getMyStream().then(function (mediaStream) {
    graphicsOnStream(null, mediaStream);
  });
}

function connectionInitialize(){
  peer = new Peer();
  peer.on('open', function(id) {
    myId = id;
    graphicsOnMe(id);

    // add myself to firebase
    fireRoom.update({
      members: firebase.firestore.FieldValue.arrayUnion(id)
    });
    window.addEventListener("beforeunload", function(e){
      removePeerFromRoom(id);
    }, false);

    // join the room
    fireRoom.get().then(function(room){
      if( room.exists ){
        joinRoom(room.data())
      }
    });
  });
}