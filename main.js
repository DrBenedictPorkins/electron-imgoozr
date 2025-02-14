const {app, BrowserWindow, ipcMain, shell, dialog} = require('electron')
const path = require('path')
const fs = require('fs')

let imageDir = ''

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true
    }
  })

  console.log("loading index.html");

  // win.webContents.openDevTools();
  win.loadFile('index.html')

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      imageDir = result.filePaths[0];
      return true;
    }
    return false;
  });

  ipcMain.on('get-image-files', (event) => {
    console.log('Reading images from:', imageDir) // Debug log
    fs.readdir(imageDir, (err, files) => {
      if (err) {
        console.error('Could not list the directory.', err)
        event.reply('image-files', [])
        return
      }

      console.log('Files in directory:', files) // Debug log

      const imageFiles = files
        .filter(file => ['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase()))
        .map(file => {
          const filePath = path.join(imageDir, file)
          const stats = fs.statSync(filePath)
          return {
            path: filePath,
            created: stats.birthtime,
            name: path.basename(filePath),
            category: 'original'
          }
        })

      console.log("replying with image files", imageFiles);
      event.reply('image-files', imageFiles)
    })
  })

  ipcMain.on('show-dialog', (event, arg) => {

    const controller = new AbortController();

    dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['OK'],
      title: 'Warning',
      message: arg,
      detail: 'This is a warning dialog.',
      signal: controller.signal
    }).then(result => {
      console.log("show-warning-dialog result", result);
      // event.reply('show-warning-dialog-result', result.response === 0)
    })

    // Auto-close the message box after 3 seconds
    setTimeout(() => controller.abort(), 3000)
  });

  ipcMain.on('move-files', (event, allImages) => {

    (!fs.existsSync('./trash')) && fs.mkdirSync('./trash');
    (!fs.existsSync('./archive')) && fs.mkdirSync('./archive');

    // Move the files to their respective folders
    let trashCount = 0;
    let archiveCount = 0;
    allImages.forEach(image => {
      if (image.category === 'trash') {
        const newLocation = path.join('./trash', path.basename(image.path));
        fs.renameSync(image.path, newLocation);
        trashCount++;
      } else if (image.category === 'archive') {
        const newLocation = path.join('./archive', path.basename(image.path));
        fs.renameSync(image.path, newLocation);
        archiveCount++;
      }
    });

    // Send a message back to the renderer process with the number of files moved
    event.sender.send('files-moved', {trashCount, archiveCount});
  });

  // handle "open-image-file" event
  ipcMain.on('open-image-file', (event, filePath) => {
    console.log("open-image-file: ", filePath);

    // open the image file add catch with error message
    shell.openPath(filePath).catch(err => {
      console.error(`Could not open the file [${filePath}]`, err);
    });
  });
}

app.whenReady().then(createWindow)
