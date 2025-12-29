const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Get user data path for storing database
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'db.json');

// Default empty database structure
const defaultDb = {
  portfolios: [],
  retirementAccounts: [],
  bankAccounts: []
};

// Initialize database file if it doesn't exist
function initDatabase() {
  if (!fs.existsSync(dbPath)) {
    // Copy bundled db.json to user data directory if it exists
    const bundledDbPath = path.join(__dirname, 'db.json');
    if (fs.existsSync(bundledDbPath)) {
      fs.copyFileSync(bundledDbPath, dbPath);
      console.log('Copied bundled database to:', dbPath);
    } else {
      fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));
      console.log('Created new database at:', dbPath);
    }
  }
}

// Read database
function readData() {
  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return defaultDb;
  }
}

// Write database
function writeData(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error writing database:', error);
    return { success: false, error: error.message };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove DevTools in production
  // win.webContents.openDevTools();

  const indexPath = path.join(__dirname, 'dist/portfolio-manager/browser/index.html');
  console.log("Loading path:", indexPath);
  console.log("Database path:", dbPath);

  win.loadFile(indexPath).catch(err => console.error("Failed to load:", err));
}

app.whenReady().then(() => {
  initDatabase();

  // Handle IPC calls from renderer
  ipcMain.handle('read-data', () => readData());
  ipcMain.handle('write-data', (event, data) => writeData(data));

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});