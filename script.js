const grid = document.getElementById('grid');
const colorPicker = document.getElementById('colorPicker');
const colorHexText = document.querySelector('.color-hex');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const sizeSelect = document.getElementById('sizeSelect');
const brushSizeSelect = document.getElementById('brushSizeSelect');
const brushBtn = document.getElementById('brushBtn');
const eraserBtn = document.getElementById('eraserBtn');
const bucketBtn = document.getElementById('bucketBtn');
const eyedropperBtn = document.getElementById('eyedropperBtn');
const mirrorBtn = document.getElementById('mirrorBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const paletteContainer = document.getElementById('palette');
const addLayerBtn = document.getElementById('addLayerBtn');
const layersList = document.getElementById('layersList');

let gridSize = parseInt(sizeSelect.value);
let brushSize = parseInt(brushSizeSelect.value);
let isMouseDown = false;
let currentTool = 'brush'; // 'brush', 'eraser', 'bucket', 'eyedropper'
let isMirrorEnabled = false;

let history = [];
let historyIndex = -1;
let isRestoring = false;

// Sistema de Capas simplificado 
let layers = [
    { name: 'Capa 1', visible: true, data: Array(gridSize * gridSize).fill('white') }
];
let activeLayerIndex = 0;

const colors = [
    '#000000', '#ffffff', '#7f7f7f', '#c3c3c3',
    '#880015', '#b97a57', '#ed1c24', '#ff7f27',
    '#ffc90e', '#fff200', '#22b14c', '#00a2e8',
    '#3f48cc', '#a349a4', '#ffaec9', '#b5e61d'
];

document.addEventListener('mouseup', () => {
    if (isMouseDown) {
        isMouseDown = false;
        saveState();
    }
});

colorPicker.addEventListener('input', (e) => {
    colorHexText.textContent = e.target.value.toUpperCase();
});

brushSizeSelect.addEventListener('change', (e) => {
    brushSize = parseInt(e.target.value);
});

// --- HISTORIAL ---
function saveState() {
    if (isRestoring) return;
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    // Guardamos una copia profunda de las capas
    const currentState = layers.map(layer => [...layer.data]);
    history.push(currentState);
    historyIndex = history.length - 1;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
    }
}

function restoreState(state) {
    isRestoring = true;
    layers = state.map((layerData, idx) => ({
        ...layers[idx],
        data: [...layerData]
    }));
    renderGridFromLayers();
    isRestoring = false;
}

undoBtn.addEventListener('mousedown', (e) => { e.preventDefault(); undo(); });
redoBtn.addEventListener('mousedown', (e) => { e.preventDefault(); redo(); });

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
    } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
    }
});

// --- HERRAMIENTAS ---
function setActiveTool(tool) {
    currentTool = tool;
    brushBtn.classList.remove('active');
    eraserBtn.classList.remove('active');
    bucketBtn.classList.remove('active');
    eyedropperBtn.classList.remove('active');

    if (tool === 'brush') brushBtn.classList.add('active');
    if (tool === 'eraser') eraserBtn.classList.add('active');
    if (tool === 'bucket') bucketBtn.classList.add('active');
    if (tool === 'eyedropper') eyedropperBtn.classList.add('active');
}

brushBtn.addEventListener('click', () => setActiveTool('brush'));
eraserBtn.addEventListener('click', () => setActiveTool('eraser'));
bucketBtn.addEventListener('click', () => setActiveTool('bucket'));
eyedropperBtn.addEventListener('click', () => setActiveTool('eyedropper'));

mirrorBtn.addEventListener('click', () => {
    isMirrorEnabled = !isMirrorEnabled;
    mirrorBtn.classList.toggle('mirror-active', isMirrorEnabled);
});

function getPixelIndex(x, y) {
    return y * gridSize + x;
}

// Aplicar herramienta en las coordenadas con soporte de tamaño de pincel y espejo
function applyToolAt(x, y) {
    const activeLayer = layers[activeLayerIndex];
    if (!activeLayer.visible) return;

    const halfBrush = Math.floor(brushSize / 2);

    for (let bx = 0; bx < brushSize; bx++) {
        for (let by = 0; by < brushSize; by++) {
            const targetX = x + bx - halfBrush;
            const targetY = y + by - halfBrush;

            if (targetX >= 0 && targetX < gridSize && targetY >= 0 && targetY < gridSize) {
                const idx = getPixelIndex(targetX, targetY);

                if (currentTool === 'brush') {
                    activeLayer.data[idx] = colorPicker.value;
                    if (isMirrorEnabled) {
                        const mirrorX = gridSize - 1 - targetX;
                        const mirrorIdx = getPixelIndex(mirrorX, targetY);
                        activeLayer.data[mirrorIdx] = colorPicker.value;
                    }
                } else if (currentTool === 'eraser') {
                    activeLayer.data[idx] = 'white';
                    if (isMirrorEnabled) {
                        const mirrorX = gridSize - 1 - targetX;
                        const mirrorIdx = getPixelIndex(mirrorX, targetY);
                        activeLayer.data[mirrorIdx] = 'white';
                    }
                }
            }
        }
    }
    renderGridFromLayers();
}

// Gotero: Seleccionar color del lienzo
function pickColor(x, y) {
    // Buscamos de arriba hacia abajo en las capas visibles
    for (let i = layers.length - 1; i >= 0; i--) {
        if (layers[i].visible) {
            const idx = getPixelIndex(x, y);
            const color = layers[i].data[idx];
            if (color && color !== 'white') {
                colorPicker.value = color;
                colorHexText.textContent = color.toUpperCase();
                setActiveTool('brush'); // Regresa automáticamente al pincel
                break;
            }
        }
    }
}

// Cubeta de pintura
function floodFill(startX, startY) {
    const activeLayer = layers[activeLayerIndex];
    if (!activeLayer.visible) return;

    const startIdx = getPixelIndex(startX, startY);
    const targetColor = activeLayer.data[startIdx] || 'white';
    const fillColor = colorPicker.value;

    if (targetColor === fillColor) return;

    const queue = [[startX, startY]];
    const visited = new Set();

    while (queue.length > 0) {
        const [x, y] = queue.shift();
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;

        const idx = getPixelIndex(x, y);
        if (visited.has(idx)) continue;
        visited.add(idx);

        if (activeLayer.data[idx] === targetColor) {
            activeLayer.data[idx] = fillColor;

            if (isMirrorEnabled) {
                const mirrorX = gridSize - 1 - x;
                const mirrorIdx = getPixelIndex(mirrorX, y);
                activeLayer.data[mirrorIdx] = fillColor;
            }

            queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
    }
    renderGridFromLayers();
    saveState();
}

// --- RENDERIZADO DE CAPAS ---
function renderGridFromLayers() {
    const pixelElements = document.querySelectorAll('.pixel');
    
    for (let i = 0; i < gridSize * gridSize; i++) {
        let finalColor = 'white';

        // Combinar capas de abajo hacia arriba
        for (let l = 0; l < layers.length; l++) {
            if (layers[l].visible && layers[l].data[i] && layers[l].data[i] !== 'white') {
                finalColor = layers[l].data[i];
            }
        }
        if (pixelElements[i]) {
            pixelElements[i].style.backgroundColor = finalColor;
        }
    }
}

// --- GESTIÓN DE CAPAS ---

addLayerBtn.onclick = (e) => {
    e.stopPropagation();
    const newLayerIndex = layers.length + 1;
    layers.push({
        name: `Capa ${newLayerIndex}`,
        visible: true,
        data: Array(gridSize * gridSize).fill('white')
    });
    activeLayerIndex = layers.length - 1;
    renderLayersUI();
    renderGridFromLayers();
    saveState();
};

function renderLayersUI() {
    layersList.innerHTML = '';
    
    // Recorremos desde el último al primero para que la capa superior se muestre arriba en la UI
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const actualIndex = i; 

        const item = document.createElement('div');
        item.classList.add('layer-item');
        
        if (actualIndex === activeLayerIndex) {
            item.classList.add('active');
        }

        // Selección de capa activa al hacer clic en el contenedor
        item.addEventListener('click', () => {
            activeLayerIndex = actualIndex;
            renderLayersUI();
        });

        // Nombre de la capa
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('layer-name');
        nameSpan.textContent = layer.name;

        // Contenedor de acciones
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('layer-actions');

        // Botón Renombrar (Solución definitiva con un clic en vez de doble clic)
        const renameBtn = document.createElement('button');
        renameBtn.classList.add('layer-action-btn');
        renameBtn.title = "Renombrar Capa";
        renameBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita que se seleccione la capa accidentalmente al hacer clic en el lápiz
            const newName = prompt("Nuevo nombre para la capa:", layer.name);
            if (newName && newName.trim() !== "") {
                layer.name = newName.trim();
                renderLayersUI();
                saveState();
            }
        });

        // Botón Subir Capa (Mover hacia arriba en la pila)
        const moveUpBtn = document.createElement('button');
        moveUpBtn.classList.add('layer-action-btn');
        moveUpBtn.title = "Subir Capa";
        moveUpBtn.innerHTML = `▲`;
        moveUpBtn.disabled = (actualIndex === layers.length - 1);
        if (moveUpBtn.disabled) moveUpBtn.style.opacity = '0.3';

        moveUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (actualIndex < layers.length - 1) {
                const temp = layers[actualIndex];
                layers[actualIndex] = layers[actualIndex + 1];
                layers[actualIndex + 1] = temp;
                
                if (activeLayerIndex === actualIndex) {
                    activeLayerIndex = actualIndex + 1;
                } else if (activeLayerIndex === actualIndex + 1) {
                    activeLayerIndex = actualIndex;
                }

                renderLayersUI();
                renderGridFromLayers();
                saveState();
            }
        });

        // Botón Bajar Capa (Mover hacia abajo en la pila)
        const moveDownBtn = document.createElement('button');
        moveDownBtn.classList.add('layer-action-btn');
        moveDownBtn.title = "Bajar Capa";
        moveDownBtn.innerHTML = `▼`;
        moveDownBtn.disabled = (actualIndex === 0);
        if (moveDownBtn.disabled) moveDownBtn.style.opacity = '0.3';

        moveDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (actualIndex > 0) {
                const temp = layers[actualIndex];
                layers[actualIndex] = layers[actualIndex - 1];
                layers[actualIndex - 1] = temp;
                
                if (activeLayerIndex === actualIndex) {
                    activeLayerIndex = actualIndex - 1;
                } else if (activeLayerIndex === actualIndex - 1) {
                    activeLayerIndex = actualIndex;
                }

                renderLayersUI();
                renderGridFromLayers();
                saveState();
            }
        });

        // Botón Visibilidad
        const visibilityBtn = document.createElement('button');
        visibilityBtn.classList.add('layer-action-btn');
        visibilityBtn.title = layer.visible ? "Ocultar Capa" : "Mostrar Capa";
        visibilityBtn.innerHTML = layer.visible 
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

        visibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            renderLayersUI();
            renderGridFromLayers();
        });

        // Botón Duplicar Capa
        const duplicateBtn = document.createElement('button');
        duplicateBtn.classList.add('layer-action-btn');
        duplicateBtn.title = "Duplicar Capa";
        duplicateBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        duplicateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const duplicatedLayer = {
                name: `${layer.name} (Copia)`,
                visible: true,
                data: [...layer.data]
            };
            layers.splice(actualIndex + 1, 0, duplicatedLayer);
            activeLayerIndex = actualIndex + 1;
            renderLayersUI();
            renderGridFromLayers();
            saveState();
        });

        // Botón Eliminar Capa
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('layer-action-btn');
        deleteBtn.title = "Eliminar Capa";
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (layers.length > 1) {
                layers.splice(actualIndex, 1);
                if (activeLayerIndex >= layers.length) {
                    activeLayerIndex = layers.length - 1;
                }
                renderLayersUI();
                renderGridFromLayers();
                saveState();
            } else {
                alert("Debes mantener al menos una capa.");
            }
        });

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(moveUpBtn);
        actionsDiv.appendChild(moveDownBtn);
        actionsDiv.appendChild(visibilityBtn);
        actionsDiv.appendChild(duplicateBtn);
        actionsDiv.appendChild(deleteBtn);

        item.appendChild(nameSpan);
        item.appendChild(actionsDiv);
        layersList.appendChild(item);
    }
}

// --- EXPORTAR A PNG ---
exportBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = gridSize;
    canvas.height = gridSize;

    // Dibujar combinando todas las capas visibles
    for (let i = 0; i < gridSize * gridSize; i++) {
        let finalColor = null;
        for (let l = 0; l < layers.length; l++) {
            if (layers[l].visible && layers[l].data[i] && layers[l].data[i] !== 'white') {
                finalColor = layers[l].data[i];
            }
        }
        if (finalColor) {
            const x = i % gridSize;
            const y = Math.floor(i / gridSize);
            ctx.fillStyle = finalColor;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const link = document.createElement('a');
    link.download = `pixel-art-${gridSize}x${gridSize}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// --- INICIALIZAR CUADRÍCULA ---
function createPalette() {
    paletteContainer.innerHTML = '';
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.classList.add('color-swatch');
        swatch.style.backgroundColor = color;

        swatch.addEventListener('click', () => {
            colorPicker.value = color;
            colorHexText.textContent = color.toUpperCase();
            if (currentTool === 'eraser') setActiveTool('brush');
        });

        paletteContainer.appendChild(swatch);
    });
}

function createGrid() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

    // Reinicializar datos de capas según el nuevo tamaño
    layers = layers.map(layer => ({
        ...layer,
        data: Array(gridSize * gridSize).fill('white')
    }));

    for (let i = 0; i < gridSize * gridSize; i++) {
        const pixel = document.createElement('div');
        pixel.classList.add('pixel');

        const index = i;
        const x = index % gridSize;
        const y = Math.floor(index / gridSize);

        pixel.addEventListener('mousedown', () => {
            isMouseDown = true;
            saveState();
            if (currentTool === 'bucket') {
                floodFill(x, y);
            } else if (currentTool === 'eyedropper') {
                pickColor(x, y);
            } else {
                applyToolAt(x, y);
            }
        });

        pixel.addEventListener('mouseover', () => {
            if (isMouseDown && currentTool !== 'bucket' && currentTool !== 'eyedropper') {
                applyToolAt(x, y);
            }
        });

        grid.appendChild(pixel);
    }

    renderGridFromLayers();
    renderLayersUI();
    history = [];
    historyIndex = -1;
    saveState();
}

sizeSelect.addEventListener('change', (e) => {
    gridSize = parseInt(e.target.value);
    createGrid();
});

clearBtn.addEventListener('click', () => {
    layers[activeLayerIndex].data.fill('white');
    renderGridFromLayers();
    saveState();
});

// --- CURSOR DINÁMICO DE VISTA PREVIA ---
const canvasArea = document.querySelector('.canvas-area');
const cursorPreview = document.createElement('div');
cursorPreview.style.position = 'absolute';
cursorPreview.style.border = '1px dashed rgba(255, 255, 255, 0.8)';
cursorPreview.style.pointerEvents = 'none';
cursorPreview.style.display = 'none';
cursorPreview.style.zIndex = '100';
canvasArea.appendChild(cursorPreview);

grid.addEventListener('mouseenter', () => {
    if (currentTool === 'brush' || currentTool === 'eraser') {
        cursorPreview.style.display = 'block';
    }
});

grid.addEventListener('mouseleave', () => {
    cursorPreview.style.display = 'none';
});

grid.addEventListener('mousemove', (e) => {
    if (currentTool !== 'brush' && currentTool !== 'eraser') {
        cursorPreview.style.display = 'none';
        return;
    }
    
    const pixelElement = grid.querySelector('.pixel');
    if (!pixelElement) return;
    
    const pixelSize = pixelElement.getBoundingClientRect().width;
    const sizePx = pixelSize * brushSize;
    
    cursorPreview.style.width = `${sizePx}px`;
    cursorPreview.style.height = `${sizePx}px`;
    cursorPreview.style.backgroundColor = currentTool === 'brush' ? colorPicker.value + '66' : 'rgba(255, 255, 255, 0.4)';
    
    const gridRect = grid.getBoundingClientRect();
    const x = e.clientX - gridRect.left;
    const y = e.clientY - gridRect.top;
    
    // Centrar el cursor respecto al pincel seleccionado
    const offsetX = Math.floor(brushSize / 2) * pixelSize;
    const alignedX = Math.floor(x / pixelSize) * pixelSize - (brushSize > 1 ? pixelSize / 2 : 0);
    const alignedY = Math.floor(y / pixelSize) * pixelSize - (brushSize > 1 ? pixelSize / 2 : 0);

    cursorPreview.style.left = `${alignedX + grid.offsetLeft}px`;
    cursorPreview.style.top = `${alignedY + grid.offsetTop}px`;
});


// --- ATAJOS DE TECLADO ---
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    const key = e.key.toLowerCase();

    if (e.ctrlKey) {
        if (key === 'z') {
            e.preventDefault();
            if (e.shiftKey) { redo(); } else { undo(); }
        } else if (key === 'y') {
            e.preventDefault();
            redo();
        }
        return;
    }

    if (key === 'b') {
        setActiveTool('brush');
    } else if (key === 'e') {
        setActiveTool('eraser');
    } else if (key === 'g') {
        setActiveTool('bucket');
    } else if (key === 'i') {
        setActiveTool('eyedropper');
    } else if (key === 'm') {
        mirrorBtn.click(); // Alternar espejo
    }
});

// Inicializar aplicación
createPalette();
createGrid();s