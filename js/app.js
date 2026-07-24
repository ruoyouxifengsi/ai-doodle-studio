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
    const canvasBase64 = currentCanvas.toDataURL('image/png');
    showScreen('loadingPage');
    generateImage(canvasBase64, currentSceneId)
      .then(data => {
        if (data.success) {
          document.querySelector('.result-image').src = data.image_url;
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
    alert('二维码保存功能稍后开放');
  }
});

renderSceneCards();
