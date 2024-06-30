'use strict';

var main = main || {};

let selectedFrameIndex = -1;

document.addEventListener('DOMContentLoaded', evt => {
  evt.target.getElementById('toggleButton').firstChild.src = assets['images']['off'];
  evt.target.getElementById('captureButton').firstChild.src = assets['images']['capture'];
  evt.target.getElementById('undoButton').firstChild.src = assets['images']['undo'];
  evt.target.getElementById('playButton').firstChild.src = assets['images']['playpause'];
  evt.target.getElementById('clearButton').firstChild.src = assets['images']['clear'];
  evt.target.getElementById('saveButton').firstChild.src = assets['images']['save'];
  evt.target.getElementById('loadButton').firstChild.src = assets['images']['load'];
});

window.addEventListener('load', evt => {
  console.log("Window load event fired");
  // Create Animator object and set up callbacks.
  let video = document.getElementById('video');
  let snapshotCanvas = document.getElementById('snapshot-canvas');
  let playCanvas = document.getElementById('play-canvas');
  let videoMessage = document.getElementById('video-message');
  let an = new animator.Animator(video, snapshotCanvas, playCanvas, videoMessage);

  main.animator = an;

  // Move duplicateFrameButton initialization here
  let duplicateFrameButton = document.getElementById('duplicateFrameButton');
  if (duplicateFrameButton) {
    duplicateFrameButton.addEventListener("click", duplicateFrame);
  } else {
    console.error("Duplicate frame button not found");
  }

  let playbackSpeedSelector = document.getElementById('playbackSpeed');
  let playbackSpeed = (() => {
    return Number(playbackSpeedSelector.value);
  });
  let fps = document.getElementById('fps');
  playbackSpeedSelector.addEventListener("input", evt => {
    an.setPlaybackSpeed(playbackSpeed());
    fps.innerText = '  ' + playbackSpeed().toFixed(1);
  });
  an.setPlaybackSpeed(playbackSpeed());
  let captureClicks = (e => { e.stopPropagation() });
  let showSpinner = (() => {
    let topContainer = document.getElementById('top-container');
    topContainer.style.opacity = 0.5;
    topContainer.addEventListener('click', captureClicks, true);
  });
  let hideSpinner = (() => {
    let topContainer = document.getElementById('top-container');
    topContainer.style.opacity = null;
    topContainer.removeEventListener('click', captureClicks, true);
  });
  let saveDialog = document.getElementById('saveDialog');
  let fileNameInput = saveDialog.querySelector('input');
  let saveCB = () => {
    let value = fileNameInput.value;
    if (!value.length)
      value = 'StopMotion';
    value = value.replace(/\s+/g, '_');
    value = value.replace(/[^\w\-\.]+/g, '');
    if (value.endsWith('.mng'))
      value = value.substring(0, value.length - 4);
    if (!value.endsWith('.webm'))
      value += '.webm';
    saveDialog.close();
    let topContainer = document.getElementById('top-container');
    topContainer.style.opacity = 0.5;
    topContainer.addEventListener('click', captureClicks, true);
    an.save(value).then(() => {
      topContainer.style.opacity = null;
      topContainer.removeEventListener('click', captureClicks, true);
    }).catch(err => {
      console.log(err);
      topContainer.style.opacity = null;
      topContainer.removeEventListener('click', captureClicks, true);
    });
  };

  let captureButton = document.getElementById('captureButton');
  let undoButton = document.getElementById('undoButton');
  let clearConfirmDialog = document.getElementById('clearConfirmDialog');
  window.addEventListener("keydown", (e => {
    if (e.altKey || e.ctrlKey || e.shiftKey || clearConfirmDialog.open || saveDialog.open)
      return;
    if (e.code == "Space") {
      e.preventDefault();
      captureButton.click();
    }
    if (e.code == "Backspace") {
      e.preventDefault();
      undoButton.click();
    }
    if (e.code == "KeyD") {
      e.preventDefault();
      duplicateFrame();
    }
  }));
  let toggleButton = document.getElementById('toggleButton');
  toggleButton.addEventListener("click", evt => {
    an.toggleVideo().then(isPlaying => {
      if (isPlaying) {
        toggleButton.firstChild.src = assets['images']['off'];
      } else {
        toggleButton.firstChild.src = assets['images']['on'];
      }
    }).catch(err => {
      toggleButton.firstChild.src = assets['images']['off'];
    });
  });

  let pressButton = (button => {
    button.classList.add('pressed');
    setTimeout(() => { button.classList.remove('pressed') }, 250);
  });

  let thumbnailContainer = document.getElementById('thumbnail-container');
  let thumbnailWidth = 96;
  let thumbnailHeight = 72;

  function selectThumbnail(evt) {
    thumbnailContainer.querySelectorAll('canvas').forEach(thumb => {
      thumb.classList.remove('selected');
    });
    evt.target.classList.add('selected');
    selectedFrameIndex = parseInt(evt.target.dataset.frameIndex);
  }

  captureButton.addEventListener("click", evt => {
    let insertIndex = selectedFrameIndex === -1 ? an.frames.length : selectedFrameIndex + 1;
    an.captureAt(insertIndex);
    let thumbnail = document.createElement('canvas');
    thumbnail.width = thumbnailWidth;
    thumbnail.height = thumbnailHeight;
    thumbnail.getContext('2d', { alpha: false }).drawImage(
      an.frames[insertIndex], 0, 0, thumbnailWidth, thumbnailHeight);
    thumbnail.dataset.frameIndex = insertIndex;
    thumbnail.addEventListener('click', selectThumbnail);
    
    if (insertIndex < thumbnailContainer.children.length) {
      thumbnailContainer.insertBefore(thumbnail, thumbnailContainer.children[insertIndex]);
    } else {
      thumbnailContainer.appendChild(thumbnail);
    }
    
    // Update frame indices for all thumbnails after the insertion point
    for (let i = insertIndex + 1; i < thumbnailContainer.children.length; i++) {
      thumbnailContainer.children[i].dataset.frameIndex = i;
    }
    
    selectedFrameIndex = insertIndex;
    pressButton(captureButton);
  });

  undoButton.addEventListener("click", evt => {
    an.undoCapture();
    if (thumbnailContainer.lastElementChild)
      thumbnailContainer.removeChild(thumbnailContainer.lastElementChild);
    pressButton(undoButton);
  });
  let progressMarker = document.getElementById("progress-marker");
  progressMarker.addEventListener("animationend", () => {
    progressMarker.classList.toggle("slide-right");
    progressMarker.style.transform = "translateX(0px)";
    setTimeout(() => {
      progressMarker.style.transform = "";
    }, 1000);
  });

  let flipButton = document.getElementById('flipButton');
  flipButton.addEventListener("click", evt => {
    let style = video.attributeStyleMap;
    let transform = style.get("transform");
    if (!transform) {
      transform = new CSSTransformValue([new CSSRotate(CSS.deg(0))]);
    }
    let angle = transform[0].angle.value;
    angle = (angle + 180) % 360;
    transform[0] = new CSSRotate(CSS.deg(angle));
    style.set("transform", transform);
    an.flip();
  });

  let clockContainer = document.getElementById('clockContainer');
  let clockHand = document.getElementById("clock-hand");
  let clockNumRotations = 1000;
  let clockZeroTime = 0;

  let startClock = ((t, skew) => {
    skew = (skew ? Number(skew) : 0);
    clockZeroTime = t - skew;
    let angle = 360 * clockNumRotations;
    let duration = clockNumRotations - (skew/1000);
    clockHand.style.transition = "transform " + String(duration) + "s linear";
    clockHand.style.transform = "rotate(" + String(angle) + "deg)";
  });

  let stopClock = (() => {
    clockHand.style.transform = getComputedStyle(clockHand).transform;
  });
  
  let resetClock = (() => {
    clockHand.style.transition = "";
    clockHand.style.transform = "";
  });
  
  clockHand.addEventListener("transitionend", evt => {
    resetClock();
    requestAnimationFrame(() => { requestAnimationFrame(() => {
      let t = performance.now();
      let skew = (t - clockZeroTime) % 1000;
      startClock(t, skew);
    }) });
  });

  let clockButton = document.getElementById('clockButton');
  clockButton.addEventListener("click", evt => {
    if (clockContainer.style.display == "none") {
      clockContainer.style.display = "";
    } else {
      clockContainer.style.display = "none";
    }
  });
  let playButton = document.getElementById('playButton');
  playButton.addEventListener("click", evt => {
    let p = an.togglePlay();
    if (an.isPlaying) {
      progressMarker.style.animationDuration = (an.frames.length / playbackSpeed()) + "s";
      progressMarker.classList.add("slide-right");
      startClock(performance.now(), 0);
      p.then(resetClock);
    } else {
      progressMarker.classList.remove("slide-right");
      resetClock();
    }
  });

  let clearButton = document.getElementById('clearButton');
  clearButton.addEventListener("click", evt => {
    if (!an.frames.length)
      return;
    clearConfirmDialog.showModal();
  });

  let clearConfirmButton = document.getElementById('clearConfirmButton');
  clearConfirmButton.addEventListener("click", evt => {
    an.clear();
    thumbnailContainer.innerHTML = "";
    clearConfirmDialog.close();
  });

  let clearCancelButton = document.getElementById('clearCancelButton');
  clearCancelButton.addEventListener("click", evt => {
    clearConfirmDialog.close();
  });

  let saveButton = document.getElementById('saveButton');
  saveButton.addEventListener("click", evt => {
    if (!an.frames.length)
      return;
    if (an.name)
      fileNameInput.value = an.name;
    let saveConfirmButton = document.getElementById('saveConfirmButton');
    saveConfirmButton.addEventListener("click", saveCB);
    saveDialog.showModal();
  });

  let saveCancelButton = document.getElementById('saveCancelButton');
  saveCancelButton.addEventListener("click", evt => {
    saveDialog.close();
  });

  let loadButton = document.getElementById('loadButton');
  loadButton.addEventListener("click", evt => {
    let fileInput = document.createElement('input');
    fileInput.type = "file";
    fileInput.addEventListener("change", evt => {
      if (evt.target.files[0]) {
        showSpinner();
        an.load(evt.target.files[0], hideSpinner, frameRate => {
          playbackSpeedSelector.value = frameRate;
        });
      }
    }, false);
    fileInput.click();
  });

  // ... (audio recording code remains unchanged)

  let deleteFrameButton = document.getElementById('deleteFrameButton');
  deleteFrameButton.addEventListener("click", evt => {
    if (selectedFrameIndex === -1) {
      alert("Please select a frame to delete.");
      return;
    }
    
    an.deleteFrame(selectedFrameIndex);
    
    // Remove the thumbnail
    let thumbnailToRemove = thumbnailContainer.children[selectedFrameIndex];
    thumbnailContainer.removeChild(thumbnailToRemove);
    
    // Update remaining thumbnails' frame indices
    for (let i = selectedFrameIndex; i < thumbnailContainer.children.length; i++) {
      thumbnailContainer.children[i].dataset.frameIndex = i;
    }
    
    selectedFrameIndex = -1;
    
    pressButton(deleteFrameButton);
  });

  // ... (camera setup code remains unchanged)

  // Add event listener for thumbnail container to handle frame selection
  thumbnailContainer.addEventListener('click', evt => {
    if (evt.target.tagName === 'CANVAS') {
      selectThumbnail(evt);
    }
  });

  function duplicateFrame() {
    if (selectedFrameIndex === -1) {
      alert("Please select a frame to duplicate.");
      return;
    }
    
    let insertIndex = selectedFrameIndex + 1;
    an.duplicateFrame(selectedFrameIndex, insertIndex);
    
    let thumbnail = document.createElement('canvas');
    thumbnail.width = thumbnailWidth;
    thumbnail.height = thumbnailHeight;
    thumbnail.getContext('2d', { alpha: false }).drawImage(
      an.frames[insertIndex], 0, 0, thumbnailWidth, thumbnailHeight);
    thumbnail.dataset.frameIndex = insertIndex;
    thumbnail.addEventListener('click', selectThumbnail);
    
    thumbnailContainer.insertBefore(thumbnail, thumbnailContainer.children[insertIndex]);
    
    // Update frame indices for all thumbnails after the insertion point
    for (let i = insertIndex + 1; i < thumbnailContainer.children.length; i++) {
      thumbnailContainer.children[i].dataset.frameIndex = i;
    }
    
    selectedFrameIndex = insertIndex;
    pressButton(duplicateFrameButton);
  }
});