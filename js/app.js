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
let currentScene = null;
let currentImageUrl = null;
let selectedTags = [];

function showScreen(name) {
  state.currentScreen = name;
  Object.values(sections).forEach(el => el.classList.remove('active'));
  sections[name].classList.add('active');
}

function renderSceneCards() {
  const grid = document.querySelector('.scene-grid');
  grid.innerHTML = '';

  SCENES.forEach(scene => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `scene-card scene-card--${scene.id}`;
    card.style.setProperty('--scene-bg', scene.bgColor);
    card.innerHTML = `
      <span class="scene-icon" aria-hidden="true">${scene.icon}</span>
      <span class="scene-card-copy">
        <span class="scene-name">${scene.name}</span>
        <span class="scene-hint">${scene.hint}</span>
      </span>
      <span class="scene-arrow" aria-hidden="true">→</span>
    `;
    card.addEventListener('click', () => {
      document.querySelector('.canvas-scene-name').textContent = scene.name;
      currentScene = scene;
      showScreen('canvasPage');
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      document.querySelector('.color-dot--black').classList.add('active');
      currentCanvas = initCanvas(document.querySelector('.canvas-wrapper'), scene.id, scene.bgColor);
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
    openTagOverlay();
  }
});

document.querySelector('.result-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.classList.contains('btn-redraw')) {
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

function openTagOverlay() {
  if (!currentScene) return;
  const overlay = document.getElementById('tagOverlay');
  const grid = overlay.querySelector('.tag-grid');
  grid.innerHTML = '';

  selectedTags = [];
  currentScene.tags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'btn-tag';
    btn.textContent = tag.name;
    btn.dataset.tagId = tag.id;
    btn.addEventListener('click', () => {
      if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        selectedTags = selectedTags.filter(t => t !== tag.id);
      } else if (selectedTags.length < 3) {
        btn.classList.add('selected');
        selectedTags.push(tag.id);
      }
      const confirmBtn = overlay.querySelector('.btn-tag-confirm');
      confirmBtn.disabled = selectedTags.length === 0;
    });
    grid.appendChild(btn);
  });

  overlay.querySelector('.btn-tag-confirm').disabled = true;
  overlay.classList.add('active');
}

document.getElementById('tagOverlay').addEventListener('click', (e) => {
  const overlay = document.getElementById('tagOverlay');

  if (e.target.classList.contains('tag-overlay-mask') || e.target.classList.contains('btn-tag-cancel')) {
    overlay.classList.remove('active');
    selectedTags = [];
  }

  if (e.target.classList.contains('btn-tag-confirm') && !e.target.disabled) {
    overlay.classList.remove('active');

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
    generateImage(canvasBase64, currentScene.id, selectedTags)
      .then(data => {
        selectedTags = [];
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
        selectedTags = [];
        alert('网络出错，请重试');
        showScreen('canvasPage');
      });
  }
});

renderSceneCards();

document.getElementById('qrModal').addEventListener('click', (e) => {
  if (e.target.classList.contains('qr-modal-mask') || e.target.classList.contains('qr-modal-close')) {
    document.getElementById('qrModal').classList.remove('active');
  }
});
