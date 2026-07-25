import { SCENES } from './scenes.js';
import { initCanvas } from './canvas.js';
import { generateImage } from './api.js';

const sections = {
  sceneSelect: document.getElementById('sceneSelect'),
  canvasPage: document.getElementById('canvasPage'),
  loadingPage: document.getElementById('loadingPage'),
  resultPage: document.getElementById('resultPage'),
};

const state = {
  currentScreen: 'sceneSelect',
};

let currentCanvas = null;
let currentSceneId = null;
let currentImageUrl = null;

function showScreen(name) {
  state.currentScreen = name;
  Object.values(sections).forEach(el => el.classList.remove('active'));
  sections[name].classList.add('active');
}

function renderSceneCards() {
  const grid = document.querySelector('.scene-grid');
  grid.innerHTML = '';

  SCENES.forEach(scene => {
    const card = document.createElement('div');
    card.className = `scene-card scene-card--${scene.id}`;
    card.innerHTML = `
      <img src="${scene.silhouette}" alt="${scene.name}" loading="lazy">
      <span class="scene-name">${scene.name}</span>
    `;
    card.addEventListener('click', () => {
      document.querySelector('.canvas-scene-name').textContent = scene.name;
      currentSceneId = scene.id;
      showScreen('canvasPage');
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      document.querySelector('.color-dot--black').classList.add('active');
      currentCanvas = initCanvas(document.querySelector('.canvas-wrapper'), scene.id);
    });
    grid.appendChild(card);
  });
}

document.querySelector('.btn-back').addEventListener('click', () => {
  if (currentCanvas) {
    currentCanvas.cleanup();
    currentCanvas = null;
  }
  showScreen('sceneSelect');
});

document.querySelector('.canvas-toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || !currentCanvas) return;

  if (btn.classList.contains('color-dot')) {
    document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
    btn.classList.add('active');
    currentCanvas.setColor(btn.dataset.color);
  }

  if (btn.classList.contains('btn-undo')) {
    currentCanvas.undo();
  }

  if (btn.classList.contains('btn-clear')) {
    currentCanvas.clearDrawing();
  }

  if (btn.classList.contains('btn-generate')) {
    const prevZoom = currentCanvas.getZoom();
    const prevW = currentCanvas.width;
    const prevH = currentCanvas.height;
    currentCanvas.setZoom(1);
    currentCanvas.setWidth(720);
    currentCanvas.setHeight(1280);
    currentCanvas.renderAll();
    const canvasBase64 = currentCanvas.toDataURL({ format: 'png', multiplier: 1 });
    currentCanvas.setZoom(prevZoom);
    currentCanvas.setWidth(prevW);
    currentCanvas.setHeight(prevH);
    currentCanvas.renderAll();
    showScreen('loadingPage');
    generateImage(canvasBase64, currentSceneId)
      .then(data => {
        if (data.success) {
          currentImageUrl = data.image_url;
          document.querySelector('.result-image').src = currentImageUrl;
          showScreen('resultPage');
        } else {
          alert(data.error_message || '生成失败，请重试');
          showScreen('canvasPage');
        }
      })
      .catch(() => {
        alert('网络出错，请重试');
        showScreen('canvasPage');
      });
  }
});

document.querySelector('.result-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.classList.contains('btn-redraw')) {
    if (currentCanvas) {
      currentCanvas.clearDrawing();
    }
    showScreen('canvasPage');
  }

  if (btn.classList.contains('btn-print')) {
    window.print();
  }

  if (btn.classList.contains('btn-save-qr')) {
    if (!currentImageUrl) return;
    const modal = document.getElementById('qrModal');
    const qrCanvas = modal.querySelector('.qr-canvas');
    QRCode.toCanvas(qrCanvas, currentImageUrl, { width: 240 });
    modal.classList.add('active');
  }
});

renderSceneCards();

document.getElementById('qrModal').addEventListener('click', (e) => {
  if (e.target.classList.contains('qr-modal-mask') || e.target.classList.contains('qr-modal-close')) {
    document.getElementById('qrModal').classList.remove('active');
  }
});
