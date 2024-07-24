const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const videoSelect = document.getElementById('videoSource');
const audioSelect = document.getElementById('audioSource');
const usersList = document.getElementById('users');

let localStream;
let peerConnection;
let currentCall;
const socket = io();

const servers = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

// Get media devices
navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

function gotDevices(deviceInfos) {
    videoSelect.innerHTML = '';
    audioSelect.innerHTML = '';
    for (let i = 0; i !== deviceInfos.length; ++i) {
        const deviceInfo = deviceInfos[i];
        const option = document.createElement('option');
        option.value = deviceInfo.deviceId;
        if (deviceInfo.kind === 'audioinput') {
            option.text = deviceInfo.label || `Microphone ${audioSelect.length + 1}`;
            audioSelect.appendChild(option);
        } else if (deviceInfo.kind === 'videoinput') {
            option.text = deviceInfo.label || `Camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);
        }
    }
}

function handleError(error) {
    console.error('Error: ', error);
}

// Initialize WebRTC peer connection
function initPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('message', { iceCandidate: event.candidate, to: currentCall });
        }
    };
    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };
}

// Start video call
startCallButton.addEventListener('click', async () => {
    const videoSource = videoSelect.value;
    const audioSource = audioSelect.value;
    const constraints = {
        video: { deviceId: videoSource ? { exact: videoSource } : undefined },
        audio: { deviceId: audioSource ? { exact: audioSource } : undefined }
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    initPeerConnection();
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('message', { offer: offer, to: currentCall });
});

// End video call
endCallButton.addEventListener('click', () => {
    localStream.getTracks().forEach(track => track.stop());
    peerConnection.close();
});

// Handle incoming signaling messages
socket.on('message', async message => {
    if (message.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('message', { answer: answer, to: message.from });
        currentCall = message.from;
    } else if (message.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
    } else if (message.iceCandidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(message.iceCandidate));
    }
});

// Handle incoming invites
socket.on('invite', from => {
    const accept = confirm(`Accept call from ${from}?`);
    if (accept) {
        currentCall = from;
        startCallButton.click();
    }
});

// Update users list
socket.on('users', users => {
    usersList.innerHTML = '';
    users.forEach(user => {
        if (user !== socket.id) {
            const li = document.createElement('li');
            li.textContent = user;
            const inviteButton = document.createElement('button');
            inviteButton.textContent = 'Invite';
            inviteButton.onclick = () => {
                socket.emit('invite', user);
            };
            li.appendChild(inviteButton);
            usersList.appendChild(li);
        }
    });
});
