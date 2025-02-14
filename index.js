let images = []
let currentIndex = 0

function selectDirectory() {
  window.ipcRenderer.invoke('select-directory').then((selected) => {
    if (selected) {
      document.getElementById('initialScreen').style.display = 'none';
      document.getElementById('mainApp').style.display = 'block';
      window.ipcRenderer.send('get-image-files');
    }
  });
}

function relativeTime(past) {
  const diffInSeconds = Math.floor((new Date() - past) / 1000)

  const units = [
    ['week', 60 * 60 * 24 * 14],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ]

  for (const [unit, secondsInUnit] of units) {
    if (diffInSeconds >= secondsInUnit || unit === 'second') {
      const count = Math.floor(diffInSeconds / secondsInUnit)
      return `${count} ${unit}${count !== 1 ? 's' : ''} ago <span class="timestamp">(${new Date(past).toLocaleString()})</span>`
    }
  }
}

function getCategoryTotals() {
  let countOriginals = 0
  let countTrash = 0
  let countArchives = 0

  for (let image of images) {
    if (image.category === 'original') {
      countOriginals++
    } else if (image.category === 'trash') {
      countTrash++
    } else if (image.category === 'archive') {
      countArchives++
    }
  }

  return {
    countOriginals: countOriginals,
    countTrash: countTrash,
    countArchives: countArchives
  }
}

function notify(message, timeout = 5000) {
  const notificationText = document.getElementById('notificationText');
  notificationText.textContent = message
  notificationText.classList.add('marquee')

  setTimeout(() => {
    notificationText.classList.remove('marquee')
    notificationText.classList.add('fadeOut')

    notificationText.addEventListener('animationend', () => {
      notificationText.textContent = ''
      notificationText.classList.remove('fadeOut', 'marquee')
    })
  }, timeout)
}

function resizeImage() {
  const img = document.getElementById('imgDisplay')
  const container = document.getElementById('imgContainer')
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight

  if (img.naturalWidth > containerWidth || img.naturalHeight > containerHeight) {
    if (img.naturalWidth / containerWidth > img.naturalHeight / containerHeight) {
      img.style.width = '100%'
      img.style.height = 'auto'
    } else {
      img.style.width = 'auto'
      img.style.height = '100%'
    }
  } else {
    img.style.width = 'auto'
    img.style.height = 'auto'
  }
}


function updateImage(shouldAddShake = false) {
  const img = document.getElementById('imgDisplay')
  img.src = `file://${images[currentIndex].path}`

  img.onload = function () {
    const nameInfo = document.getElementById('nameInfo')
    nameInfo.textContent = images[currentIndex].name
    const createdInfo = document.getElementById('createdInfo')
    createdInfo.innerHTML = relativeTime(new Date(images[currentIndex].created))
    const dimensionsInfo = document.getElementById('dimensionsInfo')
    dimensionsInfo.textContent = `${this.naturalWidth}x${this.naturalHeight}`
    const indexDisplay = document.getElementById('indexDisplay')
    indexDisplay.textContent = `${currentIndex + 1} of ${images.length}`
  }

  const indexDisplay = document.getElementById('indexDisplay')
  indexDisplay.textContent = `${currentIndex + 1} of ${images.length}`

  const categoryDisplay = document.getElementById('categoryDisplay')
  categoryDisplay.textContent = images[currentIndex].category.toUpperCase()

  categoryDisplay.className = images[currentIndex].category
  shouldAddShake && categoryDisplay.classList.add('shake')

  categoryDisplay.addEventListener('animationend', () => {
    categoryDisplay.classList.remove('shake')
  })

  const totals = getCategoryTotals()
  document.getElementById('archiveTotal').textContent = totals.countArchives;
  document.getElementById('originalTotal').textContent = totals.countOriginals;
  document.getElementById('trashTotal').textContent = totals.countTrash;
}

function handleArrowKeys(event) {
  if (event.key === 'ArrowRight') {
    currentIndex = (currentIndex + 1) % images.length;
    document.getElementById('nextLabel').classList.add('highlight');
    setTimeout(() => document.getElementById('nextLabel').classList.remove('highlight'), 200);
  } else if (event.key === 'ArrowLeft') {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    document.getElementById('prevLabel').classList.add('highlight');
    setTimeout(() => document.getElementById('prevLabel').classList.remove('highlight'), 200);
  } else if (event.key === 'ArrowDown') {
    let newIndex = currentIndex;
    do {
      newIndex = (newIndex + 1) % images.length;
    } while (images[newIndex].category !== 'original' && newIndex !== currentIndex);

    if (images[newIndex].category !== 'original') {
      window.ipcRenderer.send('show-dialog', 'All images have been sorted');
      return;
    }

    currentIndex = newIndex;
  } else {
    return;
  }
  updateImage();
}

function handleCategorization(category) {
  const image = images[currentIndex];
  image.category = image.category === category ? 'original' : category;
  updateImage(image.category === 'original')
}

function handleResetCategorization() {
  images.forEach(image => image.category = 'original');
  notify('All images have been reset');
  updateImage(true);
}

document.addEventListener('keydown', function (event) {
  if (event.key.startsWith('Arrow')) {
    handleArrowKeys(event);
    return;
  }

  if (event.key.toUpperCase() === 'A') {
    handleCategorization('archive');
    document.getElementById('archiveLabel').classList.add('highlight');
    setTimeout(() => document.getElementById('archiveLabel').classList.remove('highlight'), 200);
    return;
  }

  if (event.key.toUpperCase() === 'D') {
    handleCategorization('trash');
    document.getElementById('deleteLabel').classList.add('highlight');
    setTimeout(() => document.getElementById('deleteLabel').classList.remove('highlight'), 200);
    return;
  }

  if (event.key.toUpperCase() === 'R') {
    handleResetCategorization();
    document.getElementById('resetLabel').classList.add('highlight');
    setTimeout(() => document.getElementById('resetLabel').classList.remove('highlight'), 200);
    return;
  }

  if (event.key === ' ') {
    const imagePath = images[currentIndex].path;
    console.log(`Opening file [${imagePath}]`);
    window.ipcRenderer.send('open-image-file', imagePath);
    document.getElementById('previewLabel').classList.add('highlight');
    setTimeout(() => document.getElementById('previewLabel').classList.remove('highlight'), 200);
    return;
  }

  if (event.metaKey && event.key === 'Enter') {
    if (images.every(image => image.category === 'original')) {
      notify('Start tagging files, first!');
      return;
    }
    window.ipcRenderer.send('move-files', images);
    document.getElementById('moveFilesLabel').classList.add('highlight');
    setTimeout(() => document.getElementById('moveFilesLabel').classList.remove('highlight'), 200);
  }
});

window.addEventListener('DOMContentLoaded', (event) => {
  document.getElementById('selectDirectoryBtn').addEventListener('click', selectDirectory);
});

window.addEventListener('resize', debounce(resizeImage, 250));

window.ipcRenderer.on('image-files', (event, imageFiles) => {
  images = imageFiles.map(imageFile => ({
    ...imageFile,
    category: 'original'
  }))
  if (images.length > 0) {
    updateImage()
  } else {
    notify('No images found in the selected directory.');
  }
})

window.ipcRenderer.on('files-moved', (event, {trashCount, archiveCount}) => {
  notify(`Moved ${trashCount} files to trash and ${archiveCount} files to archive.`);
  window.ipcRenderer.send('get-image-files');
});

function changeDirectory() {
  window.ipcRenderer.invoke('select-directory').then(() => {
    window.ipcRenderer.send('get-image-files')
  })
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showWelcomeScreen() {
  document.getElementById('welcomeScreen').style.display = 'flex';
}

function hideWelcomeScreen() {
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
}

// Modify your existing selectDirectory function:
function selectDirectory() {
  window.ipcRenderer.invoke('select-directory').then((selected) => {
    if (selected) {
      document.getElementById('initialScreen').style.display = 'none';
      showWelcomeScreen();
      window.ipcRenderer.send('get-image-files');
    }
  });
}

// Add this to your existing DOMContentLoaded event listener:
document.getElementById('startApp').addEventListener('click', hideWelcomeScreen);
