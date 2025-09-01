import React, { useRef, useState, useEffect } from "react";
import { useParams } from 'react-router-dom';
import './Video.css'
import io from 'socket.io-client'

import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Input from '@mui/material/Input';
import Button from '@mui/material/Button';

import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ChatIcon from '@mui/icons-material/Chat';

import { message } from 'antd'
import Row from 'react-bootstrap/Row'
import Modal from 'react-bootstrap/Modal'
import 'bootstrap/dist/css/bootstrap.css'

const server_url = process.env.NODE_ENV === 'production' ? 'https://video.sebastienbiollo.com' : "http://localhost:4001"

const peerConnectionConfig = {
  'iceServers': [
    { 'urls': 'stun:stun.l.google.com:19302' },
  ]
}

function Video() {
  const { url} =  useParams();
  // --- State ---
  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [li, setLi] = useState(false);
  const [streamState, setStreamState] = useState({
    video: false,
    audio: false,
    screen: false,
    showModal: false,
    screenAvailable: false,
    messages: [],
    message: "",
    newmessages: 0,
    askForUsername: true,
    username: "John Doe",
  });

  // --- Refs for globals ---
  const localVideoref = useRef(null);
  const connectionsRef = useRef({});
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const elmsRef = useRef(0);
  const videoRef = useRef(null);

  // --- Permissions and Initial Media ---
  useEffect(() => {
    const getPermissions = async () => {
      try {
        const videoPerm = await navigator.mediaDevices.getUserMedia({ video: true }).then(() => true).catch(() => false);
        setVideoAvailable(videoPerm);
        const audioPerm = await navigator.mediaDevices.getUserMedia({ audio: true }).then(() => true).catch(() => false);
        setAudioAvailable(audioPerm);

        setStreamState((prev) => ({
          ...prev,
          screenAvailable: !!navigator.mediaDevices.getDisplayMedia,
        }));
      } catch (e) {
        console.log(e);
      }
    };
    getPermissions();
  }, []);

  // --- Manage stream when toggling video/audio/screen ---
  useEffect(() => {
    if (!streamState.askForUsername || li) {
      if (streamState.screen) {
        getDisplayMedia();
      } else if (streamState.video || streamState.audio) {
        getUserMedia();
      } else {
        stopMediaTracks();
      }
    }
    // eslint-disable-next-line
  }, [streamState.video, streamState.audio, streamState.screen, streamState.askForUsername, li]);

  // --- Socket connection ---
  useEffect(() => {
    if (!streamState.askForUsername || li) {
      connectToSocketServer();
      return () => {
        if (socketRef.current) socketRef.current.disconnect();
      }
    }
    // eslint-disable-next-line
  }, [streamState.askForUsername, li]);

   useEffect(() => {
    // Request camera access and set the video stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        console.error("Camera access denied:", err);
      });

    // Optional: stop the stream when component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- Helper functions ---
  const stopMediaTracks = () => {
    try {
      const tracks = localVideoref.current?.srcObject?.getTracks();
      tracks && tracks.forEach(track => track.stop());
    } catch (e) {}
  };
 const vidSee = () => {
   setLi(true)
 }
  const getUserMedia = () => {
    if ((streamState.video && videoAvailable) || (streamState.audio && audioAvailable)) {
      navigator.mediaDevices.getUserMedia({ video: streamState.video, audio: streamState.audio })
        .then(getUserMediaSuccess)
        .catch((e) => console.log(e));
    } else {
      stopMediaTracks();
    }
  };

  const getUserMediaSuccess = (stream) => {
    stopMediaTracks();
    window.localStream = stream;
    localVideoref.current.srcObject = stream;

    for (const id in connectionsRef.current) {
      if (id === socketIdRef.current) continue;
      connectionsRef.current[id].addStream(window.localStream);
      connectionsRef.current[id].createOffer().then((description) => {
        connectionsRef.current[id].setLocalDescription(description)
          .then(() => {
            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connectionsRef.current[id].localDescription }));
          });
      });
    }

    stream.getTracks().forEach(track => track.onended = () => {
      setStreamState((prev) => ({ ...prev, video: false, audio: false }));
      stopMediaTracks();
      const blackSilence = (...args) => new MediaStream([black(...args), silence()]);
      window.localStream = blackSilence();
      localVideoref.current.srcObject = window.localStream;
      for (const id in connectionsRef.current) {
        connectionsRef.current[id].addStream(window.localStream);
        connectionsRef.current[id].createOffer().then((description) => {
          connectionsRef.current[id].setLocalDescription(description)
            .then(() => {
              socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connectionsRef.current[id].localDescription }));
            });
        });
      }
    });
  };

  const getDisplayMedia = () => {
    if (streamState.screen && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        .then(getDisplayMediaSuccess)
        .catch((e) => console.log(e));
    }
  };

  const getDisplayMediaSuccess = (stream) => {
    stopMediaTracks();
    window.localStream = stream;
    localVideoref.current.srcObject = stream;
    for (const id in connectionsRef.current) {
      if (id === socketIdRef.current) continue;
      connectionsRef.current[id].addStream(window.localStream);
      connectionsRef.current[id].createOffer().then((description) => {
        connectionsRef.current[id].setLocalDescription(description)
          .then(() => {
            socketRef.current.emit('signal', id, JSON.stringify({ 'sdp': connectionsRef.current[id].localDescription }));
          });
      });
    }
    stream.getTracks().forEach(track => track.onended = () => {
      setStreamState((prev) => ({ ...prev, screen: false }));
      stopMediaTracks();
      const blackSilence = (...args) => new MediaStream([black(...args), silence()]);
      window.localStream = blackSilence();
      localVideoref.current.srcObject = window.localStream;
      getUserMedia();
    });
  };

  // --- Socket and Peer Connection logic ---
  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: true });
    socketRef.current.on('signal', gotMessageFromServer);
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-call', window.location.href);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on('chat-message', addMessage);

      socketRef.current.on('user-left', (id) => {
        let video = document.querySelector(`[data-socket="${id}"]`);
        if (video !== null) {
          elmsRef.current--;
          video.parentNode.removeChild(video);
          let main = document.getElementById('main');
          changeCssVideos(main);
        }
      });

      socketRef.current.on('user-joined', (id, clients) => {
        clients.forEach((socketListId) => {
          if (!connectionsRef.current[socketListId]) {
            connectionsRef.current[socketListId] = new RTCPeerConnection(peerConnectionConfig);
            connectionsRef.current[socketListId].onicecandidate = function (event) {
              if (event.candidate != null) {
                socketRef.current.emit('signal', socketListId, JSON.stringify({ 'ice': event.candidate }));
              }
            };

            connectionsRef.current[socketListId].onaddstream = (event) => {
              var searchVideo = document.querySelector(`[data-socket="${socketListId}"]`);
              if (searchVideo !== null) {
                searchVideo.srcObject = event.stream;
              } else {
                elmsRef.current = clients.length;
                let main = document.getElementById('main');
                if (!main) return; // Prevent error if main is not yet in the DOM
                let cssMeasure = changeCssVideos(main);

                let video = document.createElement('video');
                let css = { minWidth: cssMeasure.minWidth, minHeight: cssMeasure.minHeight, maxHeight: "100%", margin: "10px", borderStyle: "solid", borderColor: "#bdbdbd", objectFit: "fill" };
                for (let i in css) video.style[i] = css[i];
                video.style.setProperty("width", cssMeasure.width);
                video.style.setProperty("height", cssMeasure.height);
                video.setAttribute('data-socket', socketListId);
                video.srcObject = event.stream;
                video.autoplay = true;
                video.playsinline = true;
                main.appendChild(video);
              }
            };

            if (window.localStream !== undefined && window.localStream !== null) {
              connectionsRef.current[socketListId].addStream(window.localStream);
            } else {
              let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
              window.localStream = blackSilence();
              connectionsRef.current[socketListId].addStream(window.localStream);
            }
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connectionsRef.current) {
            if (id2 === socketIdRef.current) continue;
            try {
              connectionsRef.current[id2].addStream(window.localStream);
            } catch (e) { }
            connectionsRef.current[id2].createOffer().then((description) => {
              connectionsRef.current[id2].setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit('signal', id2, JSON.stringify({ 'sdp': connectionsRef.current[id2].localDescription }));
                });
            });
          }
        }
      });
    });
  };

  const gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);

      // If connection does not exist, create it
      if (!connectionsRef.current[fromId]) {
    connectionsRef.current[fromId] = new RTCPeerConnection(peerConnectionConfig);
    connectionsRef.current[fromId].onicecandidate = function (event) {
      if (event.candidate != null) {
        socketRef.current.emit('signal', fromId, JSON.stringify({ 'ice': event.candidate }));
      }
    };
    connectionsRef.current[fromId].onaddstream = (event) => {
      var searchVideo = document.querySelector(`[data-socket="${fromId}"]`);
      if (searchVideo !== null) {
        searchVideo.srcObject = event.stream;
      } else {
        elmsRef.current++;
        let main = document.getElementById('main');
        if (!main) return; // Prevent error if main is not yet in the DOM
        let cssMeasure = changeCssVideos(main);

        let video = document.createElement('video');
        let css = { minWidth: cssMeasure.minWidth, minHeight: cssMeasure.minHeight, maxHeight: "100%", margin: "10px", borderStyle: "solid", borderColor: "#bdbdbd", objectFit: "fill"};
        for (let i in css) video.style[i] = css[i];
        video.style.setProperty("width", cssMeasure.width);
        video.style.setProperty("height", cssMeasure.height);
        video.setAttribute('data-socket', fromId);
        video.srcObject = event.stream;
        video.className = "upperCam"
        video.autoplay = true;
        video.playsinline = true;
        main.appendChild(video);
      }
    };

    // Add local stream if available
    if (window.localStream !== undefined && window.localStream !== null) {
      connectionsRef.current[fromId].addStream(window.localStream);
    } else {
      let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
      window.localStream = blackSilence();
      connectionsRef.current[fromId].addStream(window.localStream);
    }
  }


    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
          const pc = connectionsRef.current[fromId];
          const sdp = new RTCSessionDescription(signal.sdp);

          // Only set remote offer if in stable state
          if (sdp.type === 'offer' && pc.signalingState === 'stable') {
            pc.setRemoteDescription(sdp).then(() => {
              pc.createAnswer().then((description) => {
                pc.setLocalDescription(description).then(() => {
                  socketRef.current.emit('signal', fromId, JSON.stringify({ 'sdp': pc.localDescription }));
                });
              });
            });
          }
          // Only set remote answer if in have-local-offer state
          else if (sdp.type === 'answer' && pc.signalingState === 'have-local-offer') {
            pc.setRemoteDescription(sdp);
          }
        }
      if (signal.ice) {
        connectionsRef.current[fromId].addIceCandidate(new RTCIceCandidate(signal.ice));
      }
    }
  };

  // --- UI and Misc ---
  const changeCssVideos = (main) => {
     if (!main) return { minWidth: "300px", minHeight: "40%", width: "100%", height: "100%" }; // Prevent error if main is null

    let widthMain = main.offsetWidth;
    let minWidth = "30%";
    if ((widthMain * 30 / 100) < 300) {
      minWidth = "300px";
    }
    let minHeight = "40%";

    let height = String(100 / elmsRef.current) + "%";
    let width = "";
    if (elmsRef.current === 0 || elmsRef.current === 1) {
      width = "100%";
      height = "100%";
    } else if (elmsRef.current === 2) {
      width = "45%";
      height = "100%";
    } else if (elmsRef.current === 3 || elmsRef.current === 4) {
      width = "35%";
      height = "50%";
    } else {
      width = String(100 / elmsRef.current) + "%";
    }

    let videos = main.querySelectorAll("video");
    for (let a = 0; a < videos.length; ++a) {
      videos[a].style.minWidth = minWidth;
      videos[a].style.minHeight = minHeight;
      videos[a].style.setProperty("width", width);
      videos[a].style.setProperty("height", height);
    }

    return { minWidth, minHeight, width, height };
  };

  // --- Black and Silence streams for fallback ---
  const silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  // --- Handlers ---
  const handleFirstVideo = () => {
   setLi(true)
   setStreamState((prev) => ({ ...prev, video: !prev.video }));
  } 
  const handleVideo = () => setStreamState((prev) => ({ ...prev, video: !prev.video }));
  const handleAudio = () => setStreamState((prev) => ({ ...prev, audio: !prev.audio }));
  const handleScreen = () => setStreamState((prev) => ({ ...prev, screen: !prev.screen }));

  const handleEndCall = () => {
    stopMediaTracks();
    window.location.href = "/";
  };

  const openChat = () => setStreamState((prev) => ({ ...prev, showModal: true }));
  const closeChat = () => setStreamState((prev) => ({ ...prev, showModal: false }));
  const handleMessage = (e) => setStreamState((prev) => ({ ...prev, message: e.target.value }));

  const addMessage = (data, sender, socketIdSender) => {
    setStreamState((prev) => ({
      ...prev,
      messages: [...prev.messages, { "sender": sender, "data": data }],
      newmessages: socketIdSender !== socketIdRef.current ? prev.newmessages + 1 : prev.newmessages,
    }));
  };

  const handleUsername = (e) => setStreamState((prev) => ({ ...prev, username: e.target.value }));

  const sendMessage = () => {
    socketRef.current.emit('chat-message', streamState.message, streamState.username);
    setStreamState((prev) => ({ ...prev, message: "" }));
  };

  const copyUrl = () => {
    let text = window.location.href;
    if (!navigator.clipboard) {
      let textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        message.success("Link copied to clipboard!");
      } catch (err) {
        message.error("Failed to copy");
      }
      document.body.removeChild(textArea);
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      message.success("Link copied to clipboard!");
    }, () => {
      message.error("Failed to copy");
    });
  };

  const connect = () => setStreamState((prev) => ({ ...prev, askForUsername: false }));

  // --- Render ---
  return (
    <div>
      {streamState.askForUsername ? (
        <div className="firstVideo">
          <div className="vidFirst">
            <p className="setVideo">Set your username</p>
            <Input className="inputName" placeholder="Username" value={streamState.username} onChange={handleUsername} />
            <Button variant="contained" color="primary" onClick={connect} className='connect'>Connect</Button>
          </div>
          <div className="videoDiv">
           <video id="my-video" ref={videoRef} autoPlay playsInline muted className="videotag upperCam"></video>
          </div>
        </div>
      ) : (
        <div className="lastPartVideo firstVideo">
          <div className="btn-down camIcon">
            <IconButton className="realCam" onClick={handleVideo}>{streamState.video ? <VideocamIcon /> : <VideocamOffIcon />}</IconButton>
            <IconButton className="realICam" onClick={handleEndCall}><CallEndIcon /></IconButton>
            <IconButton className="realICamera" onClick={handleAudio}>{streamState.audio ? <MicIcon /> : <MicOffIcon />}</IconButton>
            {streamState.screenAvailable && (
              <IconButton className="realICamera" onClick={handleScreen}>
                {streamState.screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
              </IconButton>
            )}
            <Badge badgeContent={streamState.newmessages} max={999} color="secondary" onClick={openChat}>
              <IconButton className="realICamera" onClick={openChat}><ChatIcon /></IconButton>
            </Badge>
          </div>
          <Modal show={streamState.showModal} onHide={closeChat} className="chatRoom">
            <Modal.Header closeButton>
              <Modal.Title>Chat Room</Modal.Title>
            </Modal.Header>
            <Modal.Body className="chatBefore" >
              {streamState.messages.length > 0 ? (
                streamState.messages.map((item, index) => (
                  <div key={index} className="index">
                    <p className="indexUpper"><b>{item.sender}</b>: {item.data}</p>
                  </div>
                ))
              ) : (
                <p>No message yet</p>
              )}
            </Modal.Body>
            <Modal.Footer className="div-send-msg">
              <Input placeholder="Message" value={streamState.message} onChange={handleMessage} />
              <Button variant="contained" color="primary" onClick={sendMessage}>Send</Button>
            </Modal.Footer>
          </Modal>
          <div className="container">
            <div className="copyUpper">
              <Input className="copyInput" value={window.location.href} disabled color="white" />
              <Button id="copy" onClick={copyUrl}>Copy invite link</Button>
            </div>
            <Row id="main" className="vidContainer" >
              <video id="my-video" ref={localVideoref}  autoPlay muted className="lastRow upperCam"></video>
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}

export default Video;