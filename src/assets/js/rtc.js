import h from "./helpers.js";

window.addEventListener("load", () => {
  const room = h.getQString(location.href, "room");
  var username = sessionStorage.getItem("username");

  if (!room) {
    document.querySelector("#room-create").attributes.removeNamedItem("hidden");
  } else if (!username) {
    document
      .querySelector("#username-set")
      .attributes.removeNamedItem("hidden");
  } else {
    let commElem = document.getElementsByClassName("room-comm");

    for (let i = 0; i < commElem.length; i++) {
      commElem[i].attributes.removeNamedItem("hidden");
    }

    var pc = [];

    let socket = io("/stream");
    var randomNumber = `__${h.generateRandomString()}__${h.generateRandomString()}__`;
    var myStream = "";
    var screen = "";

    //Get user video by default
    getAndSetUserStream();

    socket.on("connect", () => {
      document.getElementById("randomNumber").innerText = randomNumber;
      socket.emit("subscribe", {
        room: room,
        username: username,
      });
      socket.on("new user", (data) => {
        socket.emit("newUserStart", { to: data.username, sender: username });
        pc.push(data.username);
        init(true, data.username);
      });
      const processedPageLoadIds = new Set();

      socket.on('newUserStart', (data) => {
        if (!processedPageLoadIds.has(data.pageLoadId)) {
            console.log("Processing new user event for", data.sender);
            pc.push(data.sender);
           init(false, data.sender);
            processedPageLoadIds.add(data.pageLoadId);
        } else {
            console.log("Ignoring duplicate event for", data.sender);
        }
    });
    console.log(" -----------peers array",pc);
      socket.on("ice candidates", async (data) => {
        data.candidate
          ? await pc[data.sender].addIceCandidate(
              new RTCIceCandidate(data.candidate)
            )
          : "";
      });

      socket.on("sdp", async (data) => {
        if (data.description.type === "offer") {
          // Check if the peer connection for this sender exists
          if (!pc[data.sender]) {
            console.error(
              `Peer connection for sender ${data.sender} not found.`
            );
            return;
          }

          try {
            // Set the remote description (offer)
            await pc[data.sender].setRemoteDescription(
              new RTCSessionDescription(data.description)
            );

            // Get user media and add tracks to the peer connection
            const stream = await h.getUserFullMedia();
            if (!document.getElementById("local").srcObject) {
              h.setLocalStream(stream);
            }

            // Save my stream
            myStream = stream;

            stream.getTracks().forEach((track) => {
              pc[data.sender].addTrack(track, stream);
            });

            // Create and set the local description (answer)
            const answer = await pc[data.sender].createAnswer();
            await pc[data.sender].setLocalDescription(answer);

            // Send the answer back to the sender
            socket.emit("sdp", {
              description: pc[data.sender].localDescription,
              to: data.sender,
              sender: username,
            });
          } catch (error) {
            console.error("Error handling SDP offer:", error);
          }
        } else if (data.description.type === "answer") {
          // Check if the peer connection for this sender exists
          if (!pc[data.sender]) {
            console.error(
              `Peer connection for sender ${data.sender} not found.`
            );
            return;
          }

          try {
            // Set the remote description (answer)
            await pc[data.sender].setRemoteDescription(
              new RTCSessionDescription(data.description)
            );
          } catch (error) {
            console.error("Error handling SDP answer:", error);
          }
        }
      });
    });

    function getAndSetUserStream() {
      h.getUserFullMedia()
        .then((stream) => {
          //save my stream
          myStream = stream;

          h.setLocalStream(stream);
        })
        .catch((e) => {
          console.error(`stream error: ${e}`);
        });
    }

    function init(createOffer, partnerName) {
      pc[partnerName] = new RTCPeerConnection(h.getIceServer());
      if (screen && screen.getTracks().length) {
        screen.getTracks().forEach((track) => {
          pc[partnerName].addTrack(track, screen); //should trigger negotiationneeded event
        });
      } else if (myStream) {
        myStream.getTracks().forEach((track) => {
          pc[partnerName].addTrack(track, myStream); //should trigger negotiationneeded event
        });
      } else {
        h.getUserFullMedia()
          .then((stream) => {
            //save my stream
            myStream = stream;

            stream.getTracks().forEach((track) => {
              pc[partnerName].addTrack(track, stream); //should trigger negotiationneeded event
            });

            h.setLocalStream(stream);
          })
          .catch((e) => {
            console.error(`stream error: ${e}`);
          });
      }

      //create offer
      if (createOffer) {
        pc[partnerName].onnegotiationneeded = async () => {
          let offer = await pc[partnerName].createOffer();

          await pc[partnerName].setLocalDescription(offer);

          socket.emit("sdp", {
            description: pc[partnerName].localDescription,
            to: partnerName,
            sender: username,
          });
        };
      }

      //send ice candidate to partnerNames
      pc[partnerName].onicecandidate = ({ candidate }) => {
        socket.emit("ice candidates", {
          candidate: candidate,
          to: partnerName,
          sender: username,
        });
      };

      //add
      pc[partnerName].ontrack = (e) => {
        let str = e.streams[0];
        if (document.getElementById(`${partnerName}-video`)) {
          document.getElementById(`${partnerName}-video`).srcObject = str;
        } else {
          //video elem
          let newVid = document.createElement("video");
          newVid.id = `${partnerName}-video`;
          newVid.srcObject = str;
          newVid.autoplay = true;
          newVid.controls = true;
          newVid.className = "remote-video";

          //video controls elements
          let controlDiv = document.createElement("div");
          controlDiv.className = "remote-video-controls";
          controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                          <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

          //create a new div for card
          let cardDiv = document.createElement("div");
          cardDiv.className = "card card-sm";
          cardDiv.id = partnerName;
          cardDiv.appendChild(newVid);
          cardDiv.appendChild(controlDiv);

          // Create a Bootstrap-styled button for the speaker's page
          let speakerButton = document.createElement("a");
          speakerButton.href = `${window.location.origin}/speaker/${partnerName}`;
          speakerButton.textContent = "View Speaker's Page";
          speakerButton.target = "_blank"; // Open in a new tab
          speakerButton.className = "btn btn-primary speaker-link"; // Bootstrap classes for styling

          // Append the button to the cardDiv
          cardDiv.appendChild(speakerButton);

          //put div in main-section elem
          document.getElementById("videos").appendChild(cardDiv);

          h.adjustVideoElemSize();
        }
      };

      pc[partnerName].onconnectionstatechange = (d) => {
        switch (pc[partnerName].iceConnectionState) {
          case "disconnected":
          case "failed":
            h.closeVideo(partnerName);
            break;

          case "closed":
            h.closeVideo(partnerName);
            break;
        }
      };

      pc[partnerName].onsignalingstatechange = (d) => {
        switch (pc[partnerName].signalingState) {
          case "closed":
            console.log("Signalling state is 'closed'");
            h.closeVideo(partnerName);
            break;
        }
      };
    }
  }
});
