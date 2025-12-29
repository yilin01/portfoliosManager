const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    // Read database
    readData: () => ipcRenderer.invoke('read-data'),

    // Write database
    writeData: (data) => ipcRenderer.invoke('write-data', data)
});
