const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadNotes: () => ipcRenderer.invoke('notes:load'),
  saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  openStorageFolder: () => ipcRenderer.invoke('storage:openFolder'),
  exportMarkdown: (payload) => ipcRenderer.invoke('notes:exportMarkdown', payload),
  generateWithGemini: (payload) => ipcRenderer.invoke('gemini:generate', payload),
});
